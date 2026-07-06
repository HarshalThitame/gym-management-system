"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  extractNfcPayload,
  normalizeReaderPayload,
  type KioskReaderEvent,
  type KioskReaderMode,
  type KioskReaderStatus,
  type NdefReaderLike,
  type NdefReadingEventLike
} from "@/features/attendance/lib/kiosk-reader-adapter";

type UseKioskReaderOptions = {
  onScan: (event: KioskReaderEvent) => void;
};

export function useKioskReader({ onScan }: UseKioskReaderOptions) {
  const [readerMode, setReaderMode] = useState<KioskReaderMode>("keyboard_wedge");
  const [readerStatus, setReaderStatus] = useState<KioskReaderStatus>("idle");
  const [readerMessage, setReaderMessage] = useState<string | null>(null);
  const [lastScanAt, setLastScanAt] = useState<string | null>(null);
  const keyboardBufferRef = useRef("");
  const keyboardTimerRef = useRef<number | null>(null);
  const nfcReaderRef = useRef<NdefReaderLike | null>(null);

  const handleNfcReading = useCallback(
    (event: NdefReadingEventLike) => {
      const scannedValue = normalizeReaderPayload(event.serialNumber ?? extractNfcPayload(event));
      if (!scannedValue) {
        setReaderStatus("error");
        setReaderMessage("NFC card was detected, but no usable identifier was found.");
        return;
      }

      onScan({ value: scannedValue, source: "web_nfc" });
      setLastScanAt(new Date().toISOString());
      setReaderStatus("active");
      setReaderMessage(`NFC card captured: ${scannedValue}`);
    },
    [onScan]
  );

  const handleNfcError = useCallback(() => {
    setReaderStatus("error");
    setReaderMessage("Web NFC scan failed. Use keyboard wedge mode or manual entry.");
  }, []);

  const stopNfcCapture = useCallback(() => {
    const reader = nfcReaderRef.current;

    if (reader) {
      reader.removeEventListener("reading", handleNfcReading);
      reader.removeEventListener("error", handleNfcError);
      reader.abort?.();
      nfcReaderRef.current = null;
    }
  }, [handleNfcError, handleNfcReading]);

  const commitKeyboardScan = useCallback(() => {
    const value = normalizeReaderPayload(keyboardBufferRef.current);
    if (!value) {
      keyboardBufferRef.current = "";
      return;
    }

    onScan({ value, source: "keyboard_wedge" });
    setLastScanAt(new Date().toISOString());
    setReaderStatus("active");
    setReaderMessage(`RFID / barcode payload captured: ${value}`);
    keyboardBufferRef.current = "";

    if (keyboardTimerRef.current) {
      window.clearTimeout(keyboardTimerRef.current);
      keyboardTimerRef.current = null;
    }
  }, [onScan]);

  const stopReaderCapture = useCallback(() => {
    if (keyboardTimerRef.current) {
      window.clearTimeout(keyboardTimerRef.current);
      keyboardTimerRef.current = null;
    }

    keyboardBufferRef.current = "";
    stopNfcCapture();
  }, [stopNfcCapture]);

  const startNfcCapture = useCallback(async () => {
    if (typeof window === "undefined") {
      return;
    }

    const readerCtor = window.NDEFReader;
    if (!readerCtor) {
      setReaderStatus("unsupported");
      setReaderMessage("Web NFC is not available in this browser. Use keyboard wedge mode or manual entry.");
      return;
    }

    try {
      stopNfcCapture();
      const reader = new readerCtor();
      nfcReaderRef.current = reader;
      reader.addEventListener("reading", handleNfcReading);
      reader.addEventListener("error", handleNfcError);
      await reader.scan();
      setReaderStatus("active");
      setReaderMessage("Web NFC reader is active. Tap an NFC card to continue.");
    } catch (readerError) {
      stopNfcCapture();
      throw readerError;
    }
  }, [handleNfcError, handleNfcReading, stopNfcCapture]);

  useEffect(() => {
    stopReaderCapture();

    if (readerMode === "manual") {
      setReaderStatus("idle");
      setReaderMessage("Manual mode selected. Enter the card UID or member ID yourself.");
      return stopReaderCapture;
    }

    if (readerMode === "keyboard_wedge") {
      setReaderStatus("listening");
      setReaderMessage("Keyboard wedge mode is active. Scan an RFID/NFC card and press Enter if your reader does not auto-submit.");
      return stopReaderCapture;
    }

    if (readerMode === "web_nfc") {
      setReaderMessage("Web NFC mode is active. Tap a supported NFC card to the browser device.");
      setReaderStatus("idle");
      startNfcCapture().catch((nfcError) => {
        setReaderStatus("error");
        setReaderMessage(nfcError instanceof Error ? nfcError.message : "Web NFC could not start.");
      });
    }

    return stopReaderCapture;
  }, [readerMode, stopReaderCapture, startNfcCapture]);

  useEffect(() => {
    if (readerMode !== "keyboard_wedge") {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      const tagName =
        target && typeof target === "object" && "tagName" in target ? String((target as HTMLElement).tagName).toLowerCase() : "";
      const isTypingField =
        tagName === "input" || tagName === "textarea" || tagName === "select" || Boolean((target as HTMLElement | null)?.isContentEditable);

      if (isTypingField && target !== document.body) {
        return;
      }

      if (event.key === "Enter") {
        commitKeyboardScan();
        return;
      }

      if (event.key.length !== 1 || event.altKey || event.ctrlKey || event.metaKey) {
        return;
      }

      keyboardBufferRef.current += event.key;

      if (keyboardTimerRef.current) {
        window.clearTimeout(keyboardTimerRef.current);
      }

      keyboardTimerRef.current = window.setTimeout(() => {
        commitKeyboardScan();
      }, 180);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [commitKeyboardScan, readerMode]);

  return {
    lastScanAt,
    readerMessage,
    readerMode,
    readerStatus,
    setReaderMode
  };
}
