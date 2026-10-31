import type { PDFDocumentProxy, PDFPageProxy, RenderTask } from "pdfjs-dist";
import { getToken } from "../auth";
import { pdfjsLib } from "../pdfjs";

export const DISPLAY_SCALE = 1.5;

export async function loadPdf(fileId: number): Promise<PDFDocumentProxy> {
  const task = pdfjsLib.getDocument({
    url: `/files/${fileId}/download`,
    httpHeaders: { Authorization: "Bearer " + getToken() },
  });
  return task.promise;
}

export async function renderPdfPage(
  pdf: PDFDocumentProxy,
  pageNum: number,
  canvas: HTMLCanvasElement,
): Promise<{ page: PDFPageProxy; scale: number }> {
  const page = await pdf.getPage(pageNum);
  const viewport = page.getViewport({ scale: DISPLAY_SCALE });
  const dpr = window.devicePixelRatio || 1;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get PDF canvas context");

  canvas.width = viewport.width * dpr;
  canvas.height = viewport.height * dpr;
  canvas.style.width = viewport.width + "px";
  canvas.style.height = viewport.height + "px";

  const render: RenderTask = page.render({
    canvasContext: ctx,
    viewport,
    transform: [dpr, 0, 0, dpr, 0, 0],
  });
  await render.promise;
  return { page, scale: viewport.scale };
}
