"use client";
import { useRef, useState, useEffect } from "react";
import { Upload, X, AlertCircle, RefreshCw } from "lucide-react";
import { showToast } from "@/components/ui/toast";

export function FileUploadZone({ currentUrl, type, configId, onUploaded }: {
  currentUrl: string | null;
  type: "logo" | "favicon";
  configId: string;
  onUploaded: (url: string) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (currentUrl) {
      const img = new Image();
      img.onload = () => setDimensions(`${img.naturalWidth}×${img.naturalHeight}px`);
      img.onerror = () => setDimensions(null);
      img.src = currentUrl;
    } else {
      setDimensions(null);
    }
  }, [currentUrl]);

  function handleFile(file: File) {
    if (!file.type.match(/^(image\/png|image\/jpeg|image\/svg\+xml|image\/x-icon|image\/vnd\.microsoft\.icon)$/)) {
      setError("Unsupported file type. Use PNG, JPEG, SVG, or ICO.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError("File too large. Max 2MB.");
      return;
    }
    setError(null);
    setProgress(0);
    setUploading(true);
    uploadFile(file);
  }

  function uploadFile(file: File) {
    const form = new FormData();
    form.append("file", file);
    form.append("configId", configId);
    form.append("type", type);

    const xhr = new XMLHttpRequest();
    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
    });
    xhr.addEventListener("load", () => {
      setUploading(false);
      try {
        const data = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300 && data.url) {
          onUploaded(data.url);
          showToast(`${type === "logo" ? "Logo" : "Favicon"} uploaded`, "success");
        } else {
          setError(data.error ?? "Upload failed");
          showToast(data.error ?? "Upload failed", "error");
        }
      } catch {
        setError("Upload failed");
        showToast("Upload failed", "error");
      }
    });
    xhr.addEventListener("error", () => {
      setUploading(false);
      setError("Network error. Please try again.");
      showToast("Upload failed", "error");
    });
    xhr.open("POST", "/api/enterprise/branding/upload");
    xhr.send(form);
  }

  return (
    <div className="space-y-2">
      <div
        className={`relative flex flex-col items-center justify-center h-32 rounded-lg border-2 border-dashed transition-colors ${error ? "border-destructive bg-destructive/5" : dragging ? "border-primary bg-primary/5" : "border-border bg-muted"} ${uploading ? "pointer-events-none" : "cursor-pointer"}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
        onClick={() => { if (!uploading && !currentUrl) inputRef.current?.click(); }}
      >
        {uploading ? (
          <div className="flex flex-col items-center gap-2 w-full px-4">
            <Upload className="size-5 text-muted-foreground animate-bounce" />
            <span className="text-xs text-muted-foreground">Uploading {type === "logo" ? "logo" : "favicon"}...</span>
            <div className="w-full h-1.5 bg-muted-foreground/20 rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
            <span className="text-[10px] text-muted-foreground">{progress}%</span>
          </div>
        ) : currentUrl ? (
          <div className="relative group w-full h-full flex items-center justify-center">
            <img src={currentUrl} alt="" className="max-h-24 max-w-full object-contain" />
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg">
              <span className="text-white text-xs font-semibold">Click to replace</span>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onUploaded("");
              }}
              className="absolute top-1 right-1 p-1 rounded-full bg-background/80 hover:bg-destructive/20 hover:text-destructive shadow-sm transition-colors"
              title="Remove"
            >
              <X className="size-3" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1">
            <Upload className="size-6 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">{dragging ? "Drop here" : "Drag & drop or click"}</span>
            <span className="text-[10px] text-muted-foreground">PNG, JPG, SVG, ICO · Max 2MB</span>
          </div>
        )}
        <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/svg+xml,image/x-icon,image/vnd.microsoft.icon" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
      </div>

      {dimensions && (
        <p className="text-[11px] text-muted-foreground text-center">
          {type === "logo" ? "Logo" : "Favicon"}: {dimensions}
        </p>
      )}

      {error && !uploading && (
        <div className="flex items-center gap-2 text-xs text-destructive">
          <AlertCircle className="size-3 shrink-0" />
          <span className="flex-1">{error}</span>
          <button
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-destructive/30 text-destructive hover:bg-destructive/10 transition-colors"
          >
            <RefreshCw className="size-3" />
            Retry
          </button>
        </div>
      )}
    </div>
  );
}
