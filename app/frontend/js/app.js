pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

const file_input = document.getElementById("pdfInput");
const canvas = document.querySelector("#pdfCanvas");
const ctx = canvas.getContext("2d");
const ink = document.getElementById("inkCanvas");
const inkCtx = ink.getContext("2d");
const strokesByPage = new Map();

const selBox = document.getElementById("selBox");
const preview = document.getElementById("preview");

let drawing = false;
let mode = "draw";
let selStart = null;

let currentStroke = null;

let pdfDoc = null;
let pageNum = 1;

async function renderPage(num){
    const page = await pdfDoc.getPage(num);
    const viewport = page.getViewport({scale:1.5});
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
    inkCtx.strokeStyle =  "#d00";

    redrawInk()
}

function getStrokes(num){
    if (!strokesByPage.has(num)){
        strokesByPage.set(num, []) ;
    }
    return strokesByPage.get(num);
}

function drawSegment(a, b){
    inkCtx.beginPath();
    inkCtx.moveTo(a.x, a.y);
    inkCtx.lineTo(b.x, b.y);
    inkCtx.lineWidth = 5 + b.pressure * 3;
    inkCtx.stroke();
}

function redrawInk(){
    inkCtx.clearRect(0, 0, ink.width, ink.height);
    for (const stroke of getStrokes(pageNum)){
        for (let i = 1; i < stroke.length; i++){
            drawSegment(stroke[i-1], stroke[i]);
        }
    }
}

file_input.addEventListener("change", async (event) => {
    strokesByPage.clear()
    const file = event.target.files[0];
    const buffer = await file.arrayBuffer();
    const data = new Uint8Array(buffer);
    pdfDoc = await pdfjsLib.getDocument({ data }).promise;
    pageNum = 1;
    renderPage(pageNum);
});

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
    currentStroke = [{x: e.offsetX, y:e.offsetY, pressure: e.pressure}];
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
    const prev = currentStroke[currentStroke.length - 1];
    const point = {x:e.offsetX, y:e.offsetY, pressure: e.pressure};
    currentStroke.push(point);
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
        preview.src = crop.toDataURL("image/png");

        crop.toBlob(async(blob) => {
            const form = new FormData();
            form.append("file", blob, "crop.png");
            const res = await fetch("/api/ocr", {method: "POST", body: form});
            const data = await res.json();
            document.getElementById("result").textContent = data.text;
        }, "image/png");

        selBox.style.display = "none";
        selStart = null;

    }
    drawing = false; 
    currentStroke = null;
});
ink.addEventListener("pointercancel", (e) => { 
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
