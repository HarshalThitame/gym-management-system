"use client";
import { useRef, useState } from "react";
import { Upload, X } from "lucide-react";
import { showToast } from "@/components/ui/toast";

export function FileUploadZone({ currentUrl, type, configId, onUploaded }: {
  currentUrl: string | null;
  type: "logo" | "favicon";
  configId: string;
  onUploaded: (url: string) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    if (!file.type.match(/^(image\/png|image\/jpeg|image\/svg\+xml|image\/x-icon|image\/vnd\.microsoft\.icon)$/)) {
      showToast("Unsupported file type. Use PNG, JPEG, SVG, or ICO.", "error");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      showToast("File too large. Max 2MB.", "error");
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("configId", configId);
      form.append("type", type);
      const res = await fetch("/api/enterprise/branding/upload", { method: "POST", body: form });
      const data = await res.json();
      if (res.ok && data.url) {
        onUploaded(data.url);
        showToast(`${type === "logo" ? "Logo" : "Favicon"} uploaded`, "success");
      } else {
        showToast(data.error ?? "Upload failed", "error");
      }
    } catch {
      showToast("Upload failed", "error");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div
      className={`relative flex flex-col items-center justify-center h-32 rounded-lg border-2 border-dashed transition-colors cursor-pointer ${dragging ? "border-primary bg-primary/5" : "border-border bg-muted"} ${uploading ? "opacity-50 pointer-events-none" : ""}`}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
      onClick={() => inputRef.current?.click()}
    >
      {currentUrl ? (
        <div className="relative group w-full h-full flex items-center justify-center">
          <img src={currentUrl} alt="" className="max-h-24 max-w-full object-contain" />
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg">
            <span className="text-white text-xs font-semibold">Click to replace</span>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-1">
          {uploading ? <Upload className="size-6 text-muted-foreground animate-bounce" /> : <Upload className="size-6 text-muted-foreground" />}
          <span className="text-xs text-muted-foreground">{uploading ? "Uploading..." : dragging ? "Drop here" : "Drag & drop or click"}</span>
          <span className="text-[10px] text-muted-foreground">PNG, JPG, SVG, ICO · Max 2MB</span>
        </div>
      )}
      {currentUrl && (
        <button onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }} className="absolute top-1 right-1 p-1 rounded-full bg-background/80 hover:bg-background shadow-sm"><X className="size-3" /></button>
      )}
      <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/svg+xml,image/x-icon,image/vnd.microsoft.icon" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
    </div>
  );
}
