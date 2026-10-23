pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
const file_input = document.getElementById("pdfInput");
const canvas = document.querySelector("#pdfCanvas");
const ctx = canvas.getContext("2d");

file_input.addEventListener("change", async (event) => {
    const file = event.target.files[0];
    const buffer = await file.arrayBuffer();
    const data = new Uint8Array(buffer);
    const pdfDoc = await pdfjsLib.getDocument({ data }).promise;
    const page = await pdfDoc.getPage(1);
    const viewport = page.getViewport({scale: 1.5});
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({canvasContext : ctx, viewport: viewport }).promise;
});