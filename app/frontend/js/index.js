pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

const grid = document.getElementById("grid");
const statusEl = document.getElementById("status");

async function renderThumb(fileId, card, thumbnail) {
  const pdf = await pdfjsLib.getDocument({
    url: "/files/" + fileId + "/download",
    httpHeaders: { Authorization: "Bearer " + getToken() },
  }).promise;
  const page = await pdf.getPage(1);
  const baseViewport = page.getViewport({ scale: 1 });
  const availableWidth = Math.max(1, card.clientWidth - 16);
  const availableHeight = Math.max(1, card.clientHeight - 52);
  const scale = Math.min(
    availableWidth / baseViewport.width,
    availableHeight / baseViewport.height
  );
  const outputScale = Math.min(window.devicePixelRatio || 1, 2);
  const viewport = page.getViewport({ scale: scale * outputScale });
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  canvas.style.width = `${baseViewport.width * scale}px`;
  canvas.style.height = `${baseViewport.height * scale}px`;
  thumbnail.appendChild(canvas);
  await page.render({
    canvasContext: canvas.getContext("2d"),
    viewport,
  }).promise;
}

async function loadFiles() {
  const res = await authFetch("/files");
  if (!res.ok) { statusEl.textContent = "Could not load files."; return; }
  const { items: files } = await res.json();

  for (const f of files) {
    const card = document.createElement("div");
    card.className = "card file-card";
    const thumbnail = document.createElement("div");
    thumbnail.className = "card-thumbnail";
    const name = document.createElement("span");
    name.className = "card-filename";
    name.textContent = f.filename;                       
    card.append(thumbnail, name);
    card.addEventListener("click", () => {
      window.location.href = "/viewer.html?file=" + f.id;
    });
    grid.appendChild(card);
    renderThumb(f.id, card, thumbnail).catch((error) => {
      console.error(`Could not render thumbnail for file ${f.id}:`, error);
    });
  }
}
loadFiles();

document.getElementById("fileInput").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  statusEl.textContent = "Uploading…";

  const form = new FormData();
  form.append("file", file);                          
  const res = await authFetch("/files", { method: "POST", body: form });

  if (!res.ok) {
    statusEl.textContent = "Upload failed (" + res.status + ").";
    return;
  }
  statusEl.textContent = "";
  e.target.value = "";                                
  location.reload();                                  
});
