type AllowedFileType = "image/jpeg" | "image/png" | "image/webp" | "application/pdf";

type DetectedFileType = {
  extension: "jpg" | "png" | "webp" | "pdf";
  mimeType: AllowedFileType;
};

type FileValidationResult =
  | { ok: true; extension: DetectedFileType["extension"]; mimeType: AllowedFileType }
  | { ok: false; message: string };

export async function validateAllowedFile(file: File, allowedTypes: Set<string>, invalidMessage: string): Promise<FileValidationResult> {
  if (!allowedTypes.has(file.type)) {
    return { ok: false, message: invalidMessage };
  }

  const detected = detectFileType(new Uint8Array(await file.slice(0, 16).arrayBuffer()));

  if (!detected || detected.mimeType !== file.type || !allowedTypes.has(detected.mimeType)) {
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

  return null;
}
