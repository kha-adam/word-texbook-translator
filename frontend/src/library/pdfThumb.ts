import { getToken } from "../auth";
import { downloadUrl } from "../api";
import { pdfjsLib } from "../pdfjs";

class AuthenticatedPdfRangeTransport extends pdfjsLib.PDFDataRangeTransport {
  private controllers = new Set<AbortController>();

  constructor(
    private fileId: number,
    fileSize: number,
    private onRangeError: (error: unknown) => void,
  ) {
    super(fileSize, new Uint8Array(0));
  }

  requestDataRange(begin: number, end: number): void {
    const controller = new AbortController();
    this.controllers.add(controller);

    fetch(downloadUrl(this.fileId), {
      headers: {
        Authorization: `Bearer ${getToken() ?? ""}`,
        Range: `bytes=${begin}-${end - 1}`,
      },
      signal: controller.signal,
    })
      .then(async (response) => {
        if (response.status !== 206) {
          await response.body?.cancel();
          throw new Error(`Expected partial PDF response, got ${response.status}`);
        }

        const contentRange = response.headers.get("Content-Range");
        if (!contentRange?.startsWith(`bytes ${begin}-${end - 1}/`)) {
          await response.body?.cancel();
          throw new Error(`Unexpected PDF Content-Range: ${contentRange}`);
        }

        const data = new Uint8Array(await response.arrayBuffer());
        if (data.length !== end - begin) {
          throw new Error(
            `Expected ${end - begin} PDF bytes, received ${data.length}`,
          );
        }

        this.onDataRange(begin, data);
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === "AbortError") return;
        this.onRangeError(error);
      })
      .finally(() => {
        this.controllers.delete(controller);
      });
  }

  abort(): void {
    for (const controller of this.controllers) {
      controller.abort();
    }
    this.controllers.clear();
    super.abort();
  }
}

let thumbChain: Promise<void> = Promise.resolve();

export function queueThumb(
  fileId: number,
  fileSize: number,
  container: HTMLElement,
): void {
  thumbChain = thumbChain
    .then(() => renderThumb(fileId, fileSize, container))
    .catch((err: unknown) => {
      console.error("thumbnail failed for file", fileId, err);
      container.textContent = "Preview unavailable";
    });
}

async function renderThumb(
  fileId: number,
  fileSize: number,
  container: HTMLElement,
): Promise<void> {
  let failed = false;
  const rangeTransport = new AuthenticatedPdfRangeTransport(
    fileId,
    fileSize,
    (error) => {
      if (failed) return;
      failed = true;
      console.error("PDF range request failed for file", fileId, error);
      void loadingTask.destroy();
    },
  );
  const loadingTask = pdfjsLib.getDocument({
    range: rangeTransport,
    rangeChunkSize: 65536,
    disableStream: true,
    disableAutoFetch: true,
  });

  try {
    const pdf = await loadingTask.promise;
    const page = await pdf.getPage(1);
    const baseViewport = page.getViewport({ scale: 1 });
    const scale = Math.min(
      container.clientWidth / baseViewport.width,
      container.clientHeight / baseViewport.height,
    );
    const outputScale = Math.min(window.devicePixelRatio || 1, 2);
    const viewport = page.getViewport({ scale: scale * outputScale });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    canvas.style.width = `${baseViewport.width * scale}px`;
    canvas.style.height = `${baseViewport.height * scale}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not get thumbnail canvas context");
    await page.render({ canvasContext: ctx, viewport }).promise;
    container.replaceChildren(canvas);
  } finally {
    await loadingTask.destroy();
  }
}
