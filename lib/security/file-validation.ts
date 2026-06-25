type AllowedFileType = "image/jpeg" | "image/png" | "image/webp" | "application/pdf" | "image/svg+xml" | "image/x-icon";

type DetectedFileType = {
  extension: "jpg" | "png" | "webp" | "pdf" | "svg" | "ico";
  mimeType: AllowedFileType;
};

type FileValidationResult =
  | { ok: true; extension: DetectedFileType["extension"]; mimeType: AllowedFileType }
  | { ok: false; message: string };

function normalizeMimeType(mime: string): string {
  if (mime === "image/vnd.microsoft.icon") return "image/x-icon";
  return mime;
}

export async function validateAllowedFile(file: File, allowedTypes: Set<string>, invalidMessage: string): Promise<FileValidationResult> {
  if (!allowedTypes.has(file.type)) {
    return { ok: false, message: invalidMessage };
  }

  const detected = detectFileType(new Uint8Array(await file.slice(0, 16).arrayBuffer()));

  const normalizedType = normalizeMimeType(file.type);

  if (!detected || detected.mimeType !== normalizedType || !allowedTypes.has(detected.mimeType)) {
    return { ok: false, message: invalidMessage };
  }

  return { ok: true, extension: detected.extension, mimeType: detected.mimeType };
}

function detectFileType(bytes: Uint8Array): DetectedFileType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { mimeType: "image/jpeg", extension: "jpg" };
  }

  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return { mimeType: "image/png", extension: "png" };
  }

  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return { mimeType: "image/webp", extension: "webp" };
  }

  if (bytes.length >= 5 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d) {
    return { mimeType: "application/pdf", extension: "pdf" };
  }

  // SVG: starts with <?xml or <svg (with optional UTF-8 BOM)
  if (
    bytes.length >= 4 &&
    ((bytes[0] === 0x3c && bytes[1] === 0x3f && bytes[2] === 0x78 && bytes[3] === 0x6d) ||
     (bytes[0] === 0x3c && bytes[1] === 0x73 && bytes[2] === 0x76 && bytes[3] === 0x67) ||
     (bytes.length >= 7 &&
      bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf &&
      bytes[3] === 0x3c &&
      (bytes[4] === 0x3f || bytes[4] === 0x73)))
  ) {
    return { mimeType: "image/svg+xml", extension: "svg" };
  }

  // ICO: starts with 0x00 0x00 0x01 0x00
  if (bytes.length >= 4 && bytes[0] === 0x00 && bytes[1] === 0x00 && bytes[2] === 0x01 && bytes[3] === 0x00) {
    return { mimeType: "image/x-icon", extension: "ico" };
  }

  return null;
}
