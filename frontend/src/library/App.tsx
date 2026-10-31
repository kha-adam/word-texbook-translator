import { useCallback, useEffect, useState } from "react";
import { deleteFile, listFiles, uploadPdf } from "../api";
import type { FileItem } from "../types";
import { FileCard } from "./FileCard";

export function App() {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [status, setStatus] = useState("Loading…");

  const load = useCallback(async () => {
    setStatus("Loading…");
    try {
      const data = await listFiles();
      setFiles(data.items);
      setStatus(
        data.items.length
          ? ""
          : "Your shelf is empty. Add a textbook to begin.",
      );
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Could not load files.");
    }
  }, []);

  const handleUpload = useCallback(
    async (file: File) => {
      if (file.type && file.type !== "application/pdf") {
        setStatus("Please choose a PDF.");
        return;
      }
      setStatus("Uploading…");
      try {
        await uploadPdf(file);
        await load();
      } catch (err) {
        setStatus(err instanceof Error ? err.message : "Upload failed.");
      }
    },
    [load],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    function onDragOver(e: DragEvent) {
      e.preventDefault();
      document.body.classList.add("is-drop");
    }
    function onDragLeave(e: DragEvent) {
      if (e.relatedTarget) return;
      document.body.classList.remove("is-drop");
    }
    function onDrop(e: DragEvent) {
      e.preventDefault();
      document.body.classList.remove("is-drop");
      const file = e.dataTransfer?.files[0];
      if (file) void handleUpload(file);
    }
    document.addEventListener("dragover", onDragOver);
    document.addEventListener("dragleave", onDragLeave);
    document.addEventListener("drop", onDrop);
    return () => {
      document.removeEventListener("dragover", onDragOver);
      document.removeEventListener("dragleave", onDragLeave);
      document.removeEventListener("drop", onDrop);
      document.body.classList.remove("is-drop");
    };
  }, [handleUpload]);

  async function handleDelete(file: FileItem): Promise<void> {
    if (!confirm("Delete " + file.filename + "?")) return;
    try {
      await deleteFile(file.id);
      setFiles((current) => current.filter((item) => item.id !== file.id));
      setStatus("");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Delete failed.");
    }
  }

  return (
    <main className="page">
      <header className="page-header">
        <div>
          <h1>Library</h1>
          <p className="lede">Your textbooks, ready to mark in cinabre red.</p>
        </div>
      </header>
      <div id="grid">
        <label id="uploadCard" className="card">
          <span>Add a PDF</span>
          <small>Click or drop a file</small>
          <input
            type="file"
            id="fileInput"
            accept="application/pdf"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void handleUpload(file);
            }}
          />
        </label>
        {files.map((file) => (
          <FileCard key={file.id} file={file} onDelete={(item) => void handleDelete(item)} />
        ))}
      </div>
      <p id="status" className="status" aria-live="polite">
        {status}
      </p>
    </main>
  );
}
