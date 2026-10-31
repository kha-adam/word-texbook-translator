import { ocrCrop } from "../api";
import type { Point, Stroke } from "../types";
import { DISPLAY_SCALE } from "./pdf";
import {
  STROKE_COLOR,
  eventToPagePoint,
  getStrokes,
  persistStroke,
  toScreen,
} from "./strokes";

const LINE_WIDTH_AT_SCALE_1 = 5 / DISPLAY_SCALE;
const PRESSURE_WIDTH_AT_SCALE_1 = 3 / DISPLAY_SCALE;

export type ViewerMode = "draw" | "select";

type InkOptions = {
  fileId: number;
  pdfCanvas: HTMLCanvasElement;
  ink: HTMLCanvasElement;
  selBox: HTMLElement;
  ocrScan: HTMLElement;
  result: HTMLElement;
  getPageNum: () => number;
  getMode: () => ViewerMode;
  getRenderScale: () => number;
};

export function sizeInkToPdf(
  ink: HTMLCanvasElement,
  pdfCanvas: HTMLCanvasElement,
): CanvasRenderingContext2D {
  const inkCtx = ink.getContext("2d");
  if (!inkCtx) throw new Error("Could not get ink canvas context");
  const dpr = window.devicePixelRatio || 1;
  ink.width = pdfCanvas.width;
  ink.height = pdfCanvas.height;
  ink.style.width = pdfCanvas.style.width;
  ink.style.height = pdfCanvas.style.height;
  inkCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  inkCtx.lineCap = "round";
  inkCtx.strokeStyle = STROKE_COLOR;
  return inkCtx;
}

export function redrawInk(
  inkCtx: CanvasRenderingContext2D,
  ink: HTMLCanvasElement,
  pageNum: number,
  renderScale: number,
): void {
  inkCtx.clearRect(0, 0, ink.width, ink.height);
  for (const stroke of getStrokes(pageNum)) {
    inkCtx.strokeStyle = stroke.color || STROKE_COLOR;
    const points = stroke.points;
    for (let i = 1; i < points.length; i++) {
      drawSegment(inkCtx, points[i - 1], points[i], renderScale);
    }
  }
}

function drawSegment(
  inkCtx: CanvasRenderingContext2D,
  a: Point,
  b: Point,
  renderScale: number,
): void {
  const from = toScreen(a, renderScale);
  const to = toScreen(b, renderScale);
  inkCtx.beginPath();
  inkCtx.moveTo(from.x, from.y);
  inkCtx.lineTo(to.x, to.y);
  inkCtx.lineWidth =
    (LINE_WIDTH_AT_SCALE_1 + to.pressure * PRESSURE_WIDTH_AT_SCALE_1) *
    renderScale;
  inkCtx.stroke();
}

export function bindInk(options: InkOptions): void {
  const { ink, selBox } = options;
  const inkCtx = ink.getContext("2d");
  if (!inkCtx) throw new Error("Could not get ink canvas context");

  let drawing = false;
  let currentStroke: Stroke | null = null;
  let selStart: { x: number; y: number } | null = null;

  function dropCurrentStroke(): void {
    if (!currentStroke) return;
    const list = getStrokes(options.getPageNum());
    const idx = list.indexOf(currentStroke);
    if (idx >= 0) list.splice(idx, 1);
  }

  ink.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "touch") return;
    if (options.getMode() === "select") {
      selStart = { x: e.offsetX, y: e.offsetY };
      ink.setPointerCapture(e.pointerId);
      selBox.style.display = "block";
      return;
    }
    drawing = true;
    ink.setPointerCapture(e.pointerId);
    currentStroke = {
      id: crypto.randomUUID(),
      points: [eventToPagePoint(e, options.getRenderScale())],
      color: STROKE_COLOR,
    };
    getStrokes(options.getPageNum()).push(currentStroke);
  });

  ink.addEventListener("pointermove", (e) => {
    if (options.getMode() === "select" && selStart) {
      const left = Math.min(selStart.x, e.offsetX);
      const top = Math.min(selStart.y, e.offsetY);
      selBox.style.left = left + "px";
      selBox.style.top = top + "px";
      selBox.style.width = Math.abs(e.offsetX - selStart.x) + "px";
      selBox.style.height = Math.abs(e.offsetY - selStart.y) + "px";
      return;
    }
    if (!drawing || !currentStroke) return;
    const prev = currentStroke.points[currentStroke.points.length - 1];
    const point = eventToPagePoint(e, options.getRenderScale());
    currentStroke.points.push(point);
    drawSegment(inkCtx, prev, point, options.getRenderScale());
  });

  ink.addEventListener("pointerup", () => {
    if (options.getMode() === "select" && selStart) {
      finishSelect();
      return;
    }
    if (drawing && currentStroke) {
      if (currentStroke.points.length < 2) {
        dropCurrentStroke();
      } else {
        void persistStroke(options.fileId, currentStroke, options.getPageNum());
      }
    }
    drawing = false;
    currentStroke = null;
  });

  ink.addEventListener("pointercancel", () => {
    if (drawing) {
      dropCurrentStroke();
      redrawInk(inkCtx, ink, options.getPageNum(), options.getRenderScale());
    }
    drawing = false;
    currentStroke = null;
  });

  ink.addEventListener(
    "touchmove",
    (e) => {
      const touch = e.touches[0] as Touch & { touchType?: string };
      if (touch?.touchType === "stylus") e.preventDefault();
    },
    { passive: false },
  );

  function finishSelect(): void {
    const dpr = devicePixelRatio || 1;
    const left = parseFloat(selBox.style.left);
    const top = parseFloat(selBox.style.top);
    const width = parseFloat(selBox.style.width);
    const height = parseFloat(selBox.style.height);
    if (width < 5 || height < 5) {
      selBox.style.display = "none";
      selStart = null;
      return;
    }
    const crop = document.createElement("canvas");
    crop.width = width * dpr;
    crop.height = height * dpr;
    const cropCtx = crop.getContext("2d");
    if (!cropCtx) return;
    cropCtx.drawImage(
      options.pdfCanvas,
      left * dpr,
      top * dpr,
      width * dpr,
      height * dpr,
      0,
      0,
      width * dpr,
      height * dpr,
    );

    crop.toBlob((blob) => {
      if (!blob) return;
      options.ocrScan.textContent = "Translating...";
      options.result.textContent = "Reading...";
      void ocrCrop(blob)
        .then((data) => {
          options.ocrScan.textContent = data.text;
          options.result.textContent =
            data.translation ?? "Translation unavailable";
        })
        .catch((err: unknown) => {
          options.ocrScan.textContent =
            "Error: " + (err instanceof Error ? err.message : String(err));
        });
    }, "image/png");

    selBox.style.display = "none";
    selStart = null;
  }
}
