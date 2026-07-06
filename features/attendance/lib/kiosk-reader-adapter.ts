export type KioskReaderMode = "manual" | "keyboard_wedge" | "web_nfc";

export type KioskReaderStatus = "idle" | "listening" | "active" | "unsupported" | "error";

export type KioskReaderEvent = {
  value: string;
  source: Exclude<KioskReaderMode, "manual">;
};

export type NdefRecordLike = {
  recordType?: string;
  mediaType?: string;
  data?: {
    text?: () => Promise<string>;
    toString?: () => string;
  };
};

export type NdefReadingEventLike = {
  serialNumber?: string;
  message?: {
    records?: NdefRecordLike[];
  };
};

export type NdefReaderLike = {
  scan: () => Promise<void>;
  addEventListener: (eventName: "reading" | "error", handler: (event: NdefReadingEventLike) => void) => void;
  removeEventListener: (eventName: "reading" | "error", handler: (event: NdefReadingEventLike) => void) => void;
  abort?: () => void;
};

export type NdefReaderConstructor = new () => NdefReaderLike;

declare global {
  interface Window {
    NDEFReader?: NdefReaderConstructor;
  }
}

export function normalizeReaderPayload(value: string) {
  const normalized = value.trim();

  if (!normalized) {
    return "";
  }

  return normalized.replace(/^https?:\/\/[^/]+\//, "");
}

export function extractNfcPayload(event: NdefReadingEventLike) {
  const record = event.message?.records?.[0];
  const data = record?.data;

  if (!data) {
    return "";
  }

  if (typeof data.toString === "function") {
    const value = data.toString();
    if (value && value !== "[object Object]") {
      return value;
    }
  }

  return "";
}
