import { useEffect, useRef } from "react";
import type { FileItem } from "../types";
import { queueThumb } from "./pdfThumb";

type Props = {
  file: FileItem;
  onDelete: (file: FileItem) => void;
};

export function FileCard({ file, onDelete }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const card = cardRef.current;
    const thumb = thumbRef.current;
    if (!card || !thumb) return;

    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        observer.unobserve(entry.target);
        queueThumb(file.id, file.size, thumb);
      }
    });
    observer.observe(card);
    return () => observer.disconnect();
  }, [file.id, file.size]);

  return (
    <div
      ref={cardRef}
      className="card file-card"
      onClick={() => {
        window.location.href = "/viewer?file=" + file.id;
      }}
    >
      <div ref={thumbRef} className="thumb" />
      <div className="file-card-footer">
        <span className="file-name">{file.filename}</span>
        <button
          type="button"
          className="deleteBtn"
          title="Delete"
          aria-label={"Delete " + file.filename}
          onClick={(e) => {
            e.stopPropagation();
            onDelete(file);
          }}
        >
          ×
        </button>
      </div>
    </div>
  );
}
