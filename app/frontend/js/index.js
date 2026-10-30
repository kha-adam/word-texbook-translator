// Files page. Needs common.js loaded first (getToken, authFetch) and pdf.min.js.

// ---- Settings: match these to /docs ----
const FILES_URL = "/files";                              // list (GET) and upload (POST)
const DOWNLOAD_URL = (id) => `/files/${id}/download`;    // download route
const DELETE_URL = (id) => `/files/${id}`;               // delete route (DELETE)
const UPLOAD_FIELD = "file";                             // form field name your upload route expects
const NAME_FIELD = "filename";                           // filename field in the list response

pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

// ---- Elements (ids must exist in index.html) ----
const grid = document.getElementById("grid");
const statusEl = document.getElementById("status");
const fileInput = document.getElementById("fileInput");

function setStatus(message) {
  statusEl.textContent = message;
}

// Try to read the "detail" message FastAPI sends with errors.
async function errorDetail(res) {
  try {
    const data = await res.json();
    return typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail);
  } catch {
    return "";
  }
}

// ---- Thumbnails ----
class AuthenticatedPdfRangeTransport extends pdfjsLib.PDFDataRangeTransport {
  constructor(fileId, fileSize, onError) {
    super(fileSize, null);
    this.fileId = fileId;
    this.onError = onError;
    this.controllers = new Set();
  }

  requestDataRange(begin, end) {
    const controller = new AbortController();
    this.controllers.add(controller);

    fetch(DOWNLOAD_URL(this.fileId), {
      headers: {
        Authorization: `Bearer ${getToken()}`,
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
          throw new Error(`Expected ${end - begin} PDF bytes, received ${data.length}`);
        }

        this.onDataRange(begin, data);
      })
      .catch((error) => {
        if (error.name !== "AbortError") {
          this.onError(error);
        }
      })
      .finally(() => this.controllers.delete(controller));
  }

  abort() {
    for (const controller of this.controllers) {
      controller.abort();
    }
    this.controllers.clear();
  }
}

// Render one thumbnail at a time so the page never opens many connections at once.
let thumbChain = Promise.resolve();
function queueThumb(fileId, fileSize, container) {
  thumbChain = thumbChain
    .then(() => renderThumb(fileId, fileSize, container))
    .catch((err) => {
      console.error("thumbnail failed for file", fileId, err);
      container.textContent = "Preview unavailable";
    });
}

async function renderThumb(fileId, fileSize, container) {
  let loadingTask;
  let failed = false;
  const rangeTransport = new AuthenticatedPdfRangeTransport(
    fileId,
    fileSize,
    (error) => {
      if (failed) return;
      failed = true;
      console.error("PDF range request failed for file", fileId, error);
      void loadingTask?.destroy();
    }
  );
  loadingTask = pdfjsLib.getDocument({
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
      container.clientHeight / baseViewport.height
    );
    const outputScale = Math.min(window.devicePixelRatio || 1, 2);
    const viewport = page.getViewport({ scale: scale * outputScale });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    canvas.style.width = `${baseViewport.width * scale}px`;
    canvas.style.height = `${baseViewport.height * scale}px`;
    await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
    container.replaceChildren(canvas);
  } finally {
    await loadingTask.destroy();
  }
}

// Only start a thumbnail when its card scrolls into view.
const observer = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    observer.unobserve(entry.target);
    const thumb = entry.target.querySelector(".thumb");
    queueThumb(
      entry.target.dataset.fileId,
      Number(entry.target.dataset.fileSize),
      thumb
    );
  }
});

// ---- Cards ----
function createCard(file) {
  const card = document.createElement("div");
  card.className = "card file-card";
  card.dataset.fileId = file.id;
  card.dataset.fileSize = file.size;

  const thumb = document.createElement("div");
  thumb.className = "thumb";

  // textContent (not innerHTML): filenames are user-controlled
  const name = document.createElement("span");
  name.className = "file-name";
  name.textContent = file[NAME_FIELD];

  const footer = document.createElement("div");
  footer.className = "file-card-footer";

  const del = document.createElement("button");
  del.className = "deleteBtn";
  del.textContent = "✕";
  del.title = "Delete";
  del.addEventListener("click", (e) => {
    e.stopPropagation();      // do not open the file when deleting
    deleteFile(file, card);
  });

  footer.append(name, del);
  card.append(thumb, footer);
  card.addEventListener("click", () => {
    window.location.href = "/viewer.html?file=" + file.id;
  });

  observer.observe(card);
  return card;
}

// ---- Actions ----
async function loadFiles() {
  setStatus("Loading…");
  const res = await authFetch(FILES_URL);
  if (!res.ok) {
    setStatus("Could not load files (" + res.status + ").");
    return;
  }
  const { items: files } = await res.json();

  grid.querySelectorAll(".file-card").forEach((el) => el.remove());
  for (const file of files) {
    grid.appendChild(createCard(file));
  }
  setStatus(files.length ? "" : "No files yet. Upload your first PDF.");
}

async function deleteFile(file, card) {
  if (!confirm("Delete " + file[NAME_FIELD] + "?")) return;
  const res = await authFetch(DELETE_URL(file.id), { method: "DELETE" });
  if (!res.ok) {
    setStatus("Delete failed (" + res.status + "). " + (await errorDetail(res)));
    return;
  }
  card.remove();
  setStatus("");
}

fileInput.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  setStatus("Uploading…");
  const form = new FormData();
  form.append(UPLOAD_FIELD, file);          // no Content-Type: the browser sets it
  const res = await authFetch(FILES_URL, { method: "POST", body: form });
  e.target.value = "";                      // allows picking the same file again

  if (!res.ok) {
    setStatus("Upload failed (" + res.status + "). " + (await errorDetail(res)));
    return;
  }
  await loadFiles();
});

loadFiles();