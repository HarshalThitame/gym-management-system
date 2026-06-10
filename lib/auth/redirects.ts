export function sanitizeRedirectPath(value: FormDataEntryValue | string | null | undefined, fallback = "/member") {
  if (typeof value !== "string" || value.length === 0) {
    return fallback;
  }

  if (!value.startsWith("/") || value.startsWith("//") || value.includes("://")) {
    return fallback;
  }

  return value;
}
