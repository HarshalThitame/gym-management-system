const ipPattern = /^(?:\d{1,3}\.){3}\d{1,3}$|^[a-f0-9:]+$/i;

type HeaderReader = {
  get(name: string): string | null;
};

export function getClientIpFromHeaders(headers: HeaderReader, fallback = "local") {
  const candidates = [
    headers.get("cf-connecting-ip"),
    headers.get("x-real-ip"),
    headers.get("x-forwarded-for")?.split(",")[0]
  ];

  const ip = candidates
    .map((value) => value?.trim())
    .find((value): value is string => Boolean(value && value.length <= 64 && ipPattern.test(value)));

  return ip ?? fallback;
}
