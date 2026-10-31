pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";


const queryString = window.location.search;

const urlParams = new URLSearchParams(queryString);

const fileId = parseInt(urlParams.get('file'));

const canvas = document.querySelector("#pdfCanvas");
const ctx = canvas.getContext("2d");
const ink = document.getElementById("inkCanvas");
const inkCtx = ink.getContext("2d");
const strokesByPage = new Map();
const loadedPages = new Set();
const STROKE_COLOR = "#d00";
const DISPLAY_SCALE = 1.5;
const LINE_WIDTH_AT_SCALE_1 = 5 / DISPLAY_SCALE;
const PRESSURE_WIDTH_AT_SCALE_1 = 3 / DISPLAY_SCALE;

const selBox = document.getElementById("selBox");

let drawing = false;
let mode = "draw";
let selStart = null;

let currentStroke = null;

let pdfDoc = null;
let pageNum = 1;
let renderScale = DISPLAY_SCALE;

function showMessage(message){
    document.getElementById("message").textContent = message;
}

async function renderPage(num){
    const page = await pdfDoc.getPage(num);
    const viewport = page.getViewport({scale: DISPLAY_SCALE});
    renderScale = viewport.scale;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = viewport.width * dpr;
    canvas.height = viewport.height * dpr;
    canvas.style.width = viewport.width + "px";
    canvas.style.height = viewport.height + "px";
    
    await page.render({
        canvasContext : ctx, 
        viewport: viewport,
        transform: [dpr, 0, 0, dpr, 0, 0],
    }).promise
    document.getElementById("pageInfo").textContent = num +"/"+pdfDoc.numPages;

    ink.width = canvas.width;
    ink.height = canvas.height;
    ink.style.width = canvas.style.width;
    ink.style.height = canvas.style.height;
    inkCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    inkCtx.lineCap = "round";
    inkCtx.strokeStyle = STROKE_COLOR;

    await loadStrokesForPage(num);
    redrawInk();
}

function getStrokes(num){
    if (!strokesByPage.has(num)){
        strokesByPage.set(num, []) ;
    }
    return strokesByPage.get(num);
}

function pointsFromApi(points){
    return points.map(([x, y, pressure]) => ({x, y, pressure}));
}

function pointsToApi(points){
    return points.map((p) => [p.x, p.y, p.pressure ?? 0.5]);
}

async function loadStrokesForPage(num){
    if (loadedPages.has(num)) return;
    try {
        const res = await authFetch(`/files/${fileId}/pages/${num}/strokes`);
        if (!res.ok) return;
        const data = await res.json();
        const existing = getStrokes(num);
        const existingIds = new Set(existing.map((stroke) => stroke.id));
        for (const stroke of data){
            if (existingIds.has(stroke.id)) continue;
            existing.push({
                id: stroke.id,
                points: pointsFromApi(stroke.points),
                color: stroke.color || STROKE_COLOR,
            });
        }
        loadedPages.add(num);
    } catch (err) {
        console.error(err);
    }
}

async function persistStroke(stroke, page){
    try {
        const res = await authFetch(`/files/${fileId}/strokes`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                strokes: [{
                    id: stroke.id,
                    page,
                    points: pointsToApi(stroke.points),
                    color: stroke.color || STROKE_COLOR,
                }],
            }),
        });
        if (!res.ok) console.error("Failed to save stroke", res.status);
    } catch (err) {
        console.error(err);
    }
}

function dropCurrentStroke(){
    if (!currentStroke) return;
    const list = getStrokes(pageNum);
    const idx = list.indexOf(currentStroke);
    if (idx >= 0) list.splice(idx, 1);
}

function eventToPagePoint(e){
    return {
        x: e.offsetX / renderScale,
        y: e.offsetY / renderScale,
        pressure: e.pressure,
    };
}

function toScreen(p){
    return {
        x: p.x * renderScale,
        y: p.y * renderScale,
        pressure: p.pressure,
    };
}

function drawSegment(a, b){
    const from = toScreen(a);
    const to = toScreen(b);
    inkCtx.beginPath();
    inkCtx.moveTo(from.x, from.y);
    inkCtx.lineTo(to.x, to.y);
    inkCtx.lineWidth = (LINE_WIDTH_AT_SCALE_1 + to.pressure * PRESSURE_WIDTH_AT_SCALE_1) * renderScale;
    inkCtx.stroke();
}

function redrawInk(){
    inkCtx.clearRect(0, 0, ink.width, ink.height);
    for (const stroke of getStrokes(pageNum)){
        inkCtx.strokeStyle = stroke.color || STROKE_COLOR;
        const points = stroke.points;
        for (let i = 1; i < points.length; i++){
            drawSegment(points[i-1], points[i]);
        }
    }
}
async function loadDocument(id) {
  const task = pdfjsLib.getDocument({
    url: "/files/" + id + "/download",            
    httpHeaders: { Authorization: "Bearer " + getToken() }, 
  });
  pdfDoc = await task.promise;
  pageNum = 1;
  await renderPage(pageNum);
}
(async () => {
  try {
    await loadDocument(fileId);
  } catch (err) {
    console.error(err);
    // PDF.js errors may carry the HTTP status in err.status
    if (err.status === 401) logout();
    else if (err.status === 404) showMessage("File not found.");
    else showMessage("Could not open this file.");
  }
})();

ink.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "touch") return;
    if (mode === "select"){
        selStart = {x:e.offsetX, y:e.offsetY};
        ink.setPointerCapture(e.pointerId);
        selBox.style.display = "block";
        return;
    }
    drawing = true;
    ink.setPointerCapture(e.pointerId);
    currentStroke = {
        id: crypto.randomUUID(),
        points: [eventToPagePoint(e)],
        color: STROKE_COLOR,
    };
    getStrokes(pageNum).push(currentStroke);
});
ink.addEventListener("pointermove", (e) => {
    if (mode === "select" && selStart){
        const left = Math.min(selStart.x, e.offsetX);
        const top = Math.min(selStart.y, e.offsetY);
        selBox.style.left = left + "px";
        selBox.style.top = top + "px";
        selBox.style.width = Math.abs(e.offsetX - selStart.x) + "px";
        selBox.style.height = Math.abs(e.offsetY - selStart.y)+ "px";
        return;   
    }
    if (!drawing) return;
    const prev = currentStroke.points[currentStroke.points.length - 1];
    const point = eventToPagePoint(e);
    currentStroke.points.push(point);
    drawSegment(prev, point);

});
ink.addEventListener("pointerup", (e) => { 
    if (mode === "select" && selStart){
        const dpr = devicePixelRatio || 1;
        const left = parseFloat(selBox.style.left);
        const top = parseFloat(selBox.style.top);
        const width = parseFloat(selBox.style.width);
        const height = parseFloat(selBox.style.height);
        if (width < 5 || height < 5){
            selBox.style.display = "none";
            selStart = null;
            return;
        }
        const crop = document.createElement("canvas");
        crop.width = width * dpr;
        crop.height = height * dpr;

        crop.getContext("2d").drawImage(
            canvas,
            left * dpr, top * dpr, width * dpr, height * dpr,
            0, 0, width * dpr, height * dpr
        );

        crop.toBlob(async(blob) => {
            const ocrScan = document.getElementById("ocrScan");
            const result = document.getElementById("result");
            ocrScan.textContent = "Translating...";
            result.textContent = "Reading...";
            try{
            const form = new FormData();
            form.append("file", blob, "crop.png");
            const res = await authFetch("/api/ocr", {method: "POST", body: form});
            const data = await res.json();
            ocrScan.textContent = data.text;
            result.textContent = data.translation ?? "Translation unavailable";
            } catch (err) { ocrScan.textContent = "Error: " + err.message; }
        }, "image/png");

        selBox.style.display = "none";
        selStart = null;
        return;
    }
    if (drawing && currentStroke){
        if (currentStroke.points.length < 2){
            dropCurrentStroke();
        } else {
            persistStroke(currentStroke, pageNum);
        }
    }
    drawing = false; 
    currentStroke = null;
});
ink.addEventListener("pointercancel", (e) => { 
    if (drawing){
        dropCurrentStroke();
        redrawInk();
    }
    drawing = false; 
    currentStroke = null;
});
ink.addEventListener("touchmove", (e) => {
    if (e.touches[0].touchType === "stylus") e.preventDefault();
}, {passive: false});

document.getElementById("next").onclick = () => {
    if (pdfDoc == null || pageNum == pdfDoc.numPages){
        return;
    }else{
        pageNum += 1;
        renderPage(pageNum);
    }
};
document.getElementById("prev").onclick = () => {
    if (pdfDoc == null || pageNum == 1){
        return;
    }else{
        pageNum -= 1;
        renderPage(pageNum);
    }
};
document.getElementById("modeDraw").onclick = () => {mode = "draw"};
document.getElementById("modeSelect").onclick = () => {mode = "select"};
