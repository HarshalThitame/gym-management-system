export function normalizeText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function normalizeEmail(value: string) {
  return normalizeText(value).toLowerCase();
}

export function stripControlCharacters(value: string) {
  return value.replace(/[\u0000-\u001F\u007F]/g, "");
}
