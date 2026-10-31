import { authFetch } from "./auth";
import type { FileListResponse, Stroke, StrokeOut } from "./types";
import { errorDetail } from "./dom";

export const FILES_URL = "/files";

export function downloadUrl(id: number): string {
  return `/files/${id}/download`;
}

export function deleteUrl(id: number): string {
  return `/files/${id}`;
}

export async function listFiles(): Promise<FileListResponse> {
  const res = await authFetch(FILES_URL);
  if (!res.ok) {
    throw new Error(`Could not load files (${res.status}). ${await errorDetail(res)}`);
  }
  return res.json() as Promise<FileListResponse>;
}

export async function deleteFile(id: number): Promise<void> {
  const res = await authFetch(deleteUrl(id), { method: "DELETE" });
  if (!res.ok) {
    throw new Error(`Delete failed (${res.status}). ${await errorDetail(res)}`);
  }
}

export async function uploadPdf(file: File): Promise<void> {
  const form = new FormData();
  form.append("file", file);
  const res = await authFetch(FILES_URL, { method: "POST", body: form });
  if (!res.ok) {
    throw new Error(`Upload failed (${res.status}). ${await errorDetail(res)}`);
  }
}

export async function fetchPageStrokes(
  fileId: number,
  page: number,
): Promise<StrokeOut[]> {
  const res = await authFetch(`/files/${fileId}/pages/${page}/strokes`);
  if (!res.ok) {
    throw new Error(`Could not load strokes (${res.status})`);
  }
  return res.json() as Promise<StrokeOut[]>;
}

export async function saveStroke(
  fileId: number,
  page: number,
  stroke: Stroke,
): Promise<void> {
  const res = await authFetch(`/files/${fileId}/strokes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      strokes: [
        {
          id: stroke.id,
          page,
          points: stroke.points.map((p) => [p.x, p.y, p.pressure ?? 0.5]),
          color: stroke.color,
        },
      ],
    }),
  });
  if (!res.ok) {
    throw new Error(`Failed to save stroke (${res.status})`);
  }
}

export async function ocrCrop(blob: Blob): Promise<{
  text: string;
  translation?: string;
}> {
  const form = new FormData();
  form.append("file", blob, "crop.png");
  const res = await authFetch("/api/ocr", { method: "POST", body: form });
  if (!res.ok) {
    throw new Error(`OCR failed (${res.status})`);
  }
  return res.json() as Promise<{ text: string; translation?: string }>;
}
