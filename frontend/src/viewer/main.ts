import { logout, renderNav, requireAuth } from "../auth";
import { mustGet } from "../dom";
import "./../style.css";
import { bindInk, redrawInk, sizeInkToPdf, type ViewerMode } from "./ink";
import { loadPdf, renderPdfPage } from "./pdf";
import { loadStrokesForPage } from "./strokes";
import type { PDFDocumentProxy } from "pdfjs-dist";

requireAuth();
renderNav();

const fileId = parseInt(new URLSearchParams(window.location.search).get("file") ?? "", 10);

const canvas = mustGet<HTMLCanvasElement>("pdfCanvas");
const ink = mustGet<HTMLCanvasElement>("inkCanvas");
const selBox = mustGet<HTMLElement>("selBox");
const pageInfo = mustGet<HTMLElement>("pageInfo");
const messageEl = mustGet<HTMLElement>("message");

let mode: ViewerMode = "draw";
let pdfDoc: PDFDocumentProxy | null = null;
let pageNum = 1;
let renderScale = 1.5;

function showMessage(message: string): void {
  messageEl.textContent = message;
}

async function renderPage(num: number): Promise<void> {
  if (!pdfDoc) return;
  const { scale } = await renderPdfPage(pdfDoc, num, canvas);
  renderScale = scale;
  pageInfo.textContent = num + "/" + pdfDoc.numPages;
  const inkCtx = sizeInkToPdf(ink, canvas);
  await loadStrokesForPage(fileId, num);
  redrawInk(inkCtx, ink, num, renderScale);
}

function setMode(next: ViewerMode): void {
  mode = next;
  document.body.dataset.mode = next;
  mustGet("modeDraw").classList.toggle("is-active", next === "draw");
  mustGet("modeSelect").classList.toggle("is-active", next === "select");
}

bindInk({
  fileId,
  pdfCanvas: canvas,
  ink,
  selBox,
  ocrScan: mustGet("ocrScan"),
  result: mustGet("result"),
  getPageNum: () => pageNum,
  getMode: () => mode,
  getRenderScale: () => renderScale,
});

mustGet("next").addEventListener("click", () => {
  if (pdfDoc == null || pageNum == pdfDoc.numPages) return;
  pageNum += 1;
  void renderPage(pageNum);
});
mustGet("prev").addEventListener("click", () => {
  if (pdfDoc == null || pageNum == 1) return;
  pageNum -= 1;
  void renderPage(pageNum);
});
mustGet("modeDraw").addEventListener("click", () => setMode("draw"));
mustGet("modeSelect").addEventListener("click", () => setMode("select"));

void (async () => {
  try {
    pdfDoc = await loadPdf(fileId);
    pageNum = 1;
    await renderPage(pageNum);
  } catch (err) {
    console.error(err);
    const status =
      err && typeof err === "object" && "status" in err
        ? Number(err.status)
        : undefined;
    if (status === 401) logout();
    else if (status === 404) showMessage("File not found.");
    else showMessage("Could not open this file.");
  }
})();
