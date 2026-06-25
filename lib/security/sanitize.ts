export function normalizeText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function normalizeEmail(value: string) {
  return normalizeText(value).toLowerCase();
}

export function stripControlCharacters(value: string) {
  return value.replace(/[\u0000-\u001F\u007F]/g, "");
}

export function sanitizeFilename(filename: string): string {
  let sanitized = filename.replace(/[^a-zA-Z0-9._-]/g, "");
  sanitized = sanitized.replace(/^\.+/, "");
  sanitized = sanitized.slice(0, 64);
  return sanitized || "untitled";
}
