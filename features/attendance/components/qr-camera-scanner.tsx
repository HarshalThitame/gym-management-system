"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Square } from "lucide-react";
import { Button } from "@/components/ui/button";

type BarcodeDetectorResult = {
  rawValue?: string;
};

type BrowserBarcodeDetector = {
  detect: (source: HTMLVideoElement) => Promise<BarcodeDetectorResult[]>;
};

type BrowserBarcodeDetectorConstructor = new (options?: { formats?: string[] }) => BrowserBarcodeDetector;

declare global {
  interface Window {
    BarcodeDetector?: BrowserBarcodeDetectorConstructor;
  }
}

type QrCameraScannerProps = {
  onCapture: (value: string) => void;
  onStatusChange?: (status: "idle" | "starting" | "active" | "unsupported" | "error") => void;
  captureMessage?: string;
  unsupportedMessage?: string;
  errorMessage?: string;
};

export function QrCameraScanner({
  onCapture,
  onStatusChange,
  captureMessage = "Point the camera at the member QR code.",
  unsupportedMessage = "Camera scanning is not available in this browser. Use the manual scan field.",
  errorMessage = "Camera scan failed. Use the manual scan field.",
}: QrCameraScannerProps) {
  const [scannerStatus, setScannerStatus] = useState<"idle" | "starting" | "active" | "unsupported" | "error">("idle");
  const [scannerMessage, setScannerMessage] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const detectorRef = useRef<BrowserBarcodeDetector | null>(null);

  useEffect(() => {
    onStatusChange?.(scannerStatus);
  }, [onStatusChange, scannerStatus]);

  useEffect(() => {
    return () => {
      cleanupScanner();
    };
  }, []);

  async function startScanner() {
    if (!("mediaDevices" in navigator) || !navigator.mediaDevices.getUserMedia) {
      setScannerStatus("unsupported");
      setScannerMessage(unsupportedMessage);
      return;
    }

    if (!window.BarcodeDetector) {
      setScannerStatus("unsupported");
      setScannerMessage(unsupportedMessage);
      return;
    }

    setScannerStatus("starting");
    setScannerMessage("Opening camera...");

    try {
      detectorRef.current = new window.BarcodeDetector({ formats: ["qr_code"] });
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setScannerStatus("active");
      setScannerMessage(captureMessage);
      scanFrame();
    } catch {
      setScannerStatus("error");
      setScannerMessage(errorMessage);
      stopScanner();
    }
  }

  function stopScanner() {
    cleanupScanner();
    setScannerStatus((current) => (current === "active" || current === "starting" ? "idle" : current));
  }

  function cleanupScanner() {
    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    detectorRef.current = null;
  }

  function scanFrame() {
    animationFrameRef.current = window.requestAnimationFrame(() => {
      void detectBarcode();
    });
  }

  async function detectBarcode() {
    const detector = detectorRef.current;
    const video = videoRef.current;

    if (!detector || !video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      scanFrame();
      return;
    }

    try {
      const results = await detector.detect(video);
      const rawValue = results[0]?.rawValue?.trim();

      if (rawValue) {
        onCapture(rawValue);
        setScannerMessage("QR captured.");
        stopScanner();
        return;
      }
    } catch {
      setScannerStatus("error");
      setScannerMessage(errorMessage);
      stopScanner();
      return;
    }

    scanFrame();
  }

  return (
    <div className="space-y-3 rounded-md border border-border bg-surface-muted p-3">
      <video
        aria-label="QR scanner camera preview"
        className="aspect-video w-full rounded-md border border-border bg-ink object-cover"
        muted
        playsInline
        ref={videoRef}
      />
      <div className="flex flex-wrap gap-2">
        <Button disabled={scannerStatus === "starting" || scannerStatus === "active"} onClick={startScanner} size="sm" type="button" variant="secondary">
          <Camera className="size-4" />
          {scannerStatus === "starting" ? "Opening..." : "Open Camera"}
        </Button>
        <Button disabled={scannerStatus !== "active" && scannerStatus !== "starting"} onClick={stopScanner} size="sm" type="button" variant="ghost">
          <Square className="size-4" />
          Stop
        </Button>
      </div>
      {scannerMessage ? <p className="text-xs font-semibold text-muted-foreground" role="status">{scannerMessage}</p> : null}
    </div>
  );
}
