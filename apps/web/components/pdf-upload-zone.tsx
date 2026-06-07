"use client";

import { useRef, useState, type DragEvent } from "react";

type Props = {
  onUpload: (file: File) => void;
  isUploading: boolean;
};

export function PdfUploadZone({ onUpload, isUploading }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFile = (file: File | undefined) => {
    if (!file || file.type !== "application/pdf") return;
    onUpload(file);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFile(e.dataTransfer.files[0]);
  };

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        className={`flex w-full max-w-xl flex-col items-center rounded-2xl border-2 border-dashed px-8 py-14 text-center transition ${
          isDragging
            ? "border-emerald-400/60 bg-emerald-500/10"
            : "border-white/15 bg-white/5"
        }`}
      >
        <div className="mb-4 text-4xl">📎</div>
        <h2 className="text-lg font-medium">Upload your PDF</h2>
        <p className="mt-2 max-w-sm text-sm text-zinc-400">
          Drag and drop a PDF here, or choose a file. Max size 5MB.
        </p>

        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />

        <button
          type="button"
          disabled={isUploading}
          onClick={() => inputRef.current?.click()}
          className="mt-6 rounded-xl bg-white px-5 py-2.5 text-sm font-medium text-zinc-900 transition hover:bg-zinc-200 disabled:opacity-50"
        >
          {isUploading ? "Uploading..." : "Choose PDF"}
        </button>
      </div>
    </div>
  );
}
