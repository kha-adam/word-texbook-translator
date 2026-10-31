import { fetchPageStrokes, saveStroke } from "../api";
import type { Point, Stroke } from "../types";

const strokesByPage = new Map<number, Stroke[]>();
const loadedPages = new Set<number>();

export const STROKE_COLOR = "#E2001A";

export function getStrokes(page: number): Stroke[] {
  if (!strokesByPage.has(page)) {
    strokesByPage.set(page, []);
  }
  return strokesByPage.get(page)!;
}

export function eventToPagePoint(
  e: PointerEvent,
  renderScale: number,
): Point {
  return {
    x: e.offsetX / renderScale,
    y: e.offsetY / renderScale,
    pressure: e.pressure,
  };
}

export function toScreen(p: Point, renderScale: number): Point {
  return {
    x: p.x * renderScale,
    y: p.y * renderScale,
    pressure: p.pressure,
  };
}

export async function loadStrokesForPage(
  fileId: number,
  page: number,
): Promise<void> {
  if (loadedPages.has(page)) return;
  try {
    const data = await fetchPageStrokes(fileId, page);
    const existing = getStrokes(page);
    const existingIds = new Set(existing.map((stroke) => stroke.id));
    for (const stroke of data) {
      if (existingIds.has(stroke.id)) continue;
      existing.push({
        id: stroke.id,
        points: stroke.points.map(([x, y, pressure]) => ({ x, y, pressure })),
        color: stroke.color || STROKE_COLOR,
      });
    }
    loadedPages.add(page);
  } catch (err) {
    console.error(err);
  }
}

export async function persistStroke(
  fileId: number,
  stroke: Stroke,
  page: number,
): Promise<void> {
  try {
    await saveStroke(fileId, page, stroke);
  } catch (err) {
    console.error(err);
  }
}
