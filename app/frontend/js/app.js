pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

const file_input = document.getElementById("pdfInput");
const canvas = document.querySelector("#pdfCanvas");
const ctx = canvas.getContext("2d");
const ink = document.getElementById("inkCanvas");
const inkCtx = ink.getContext("2d");
let drawing = false;
let lastX = 0;
let lastY = 0;

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
}

file_input.addEventListener("change", async (event) => {
    const file = event.target.files[0];
    const buffer = await file.arrayBuffer();
    const data = new Uint8Array(buffer);
    pdfDoc = await pdfjsLib.getDocument({ data }).promise;
    pageNum = 1;
    renderPage(pageNum);
});

ink.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "touch") return;
    drawing = true;
    ink.setPointerCapture(e.pointerId);
    lastX = e.offsetX;
    lastY = e.offsetY;
});
ink.addEventListener("pointermove", (e) => {
    if (!drawing) return;
    inkCtx.beginPath();
    inkCtx.moveTo(lastX, lastY);
    inkCtx.lineTo(e.offsetX, e.offsetY);
    inkCtx.lineWidth = 5 + e.pressure * 3;
    inkCtx.stroke();
    lastX = e.offsetX;
    lastY = e.offsetY;
});
ink.addEventListener("pointerup", (e) => { drawing = false; });
ink.addEventListener("pointercancel", (e) => { drawing = false; });

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
