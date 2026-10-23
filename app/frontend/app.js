pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
const file_input = document.getElementById("pdfInput");
const canvas = document.querySelector("#pdfCanvas");
const ctx = canvas.getContext("2d");

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
}

file_input.addEventListener("change", async (event) => {
    const file = event.target.files[0];
    const buffer = await file.arrayBuffer();
    const data = new Uint8Array(buffer);
    pdfDoc = await pdfjsLib.getDocument({ data }).promise;
    pageNum = 1;
    renderPage(pageNum);
});