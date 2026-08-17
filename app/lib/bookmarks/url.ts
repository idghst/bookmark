export function normalizeUrl(value: string) {
  const trimmed = value.trim();
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export function safeUrl(value: string) {
  try {
    const url = new URL(normalizeUrl(value));
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function bookmarkHost(value: string) {
  try {
    return new URL(normalizeUrl(value)).hostname.replace(/^www\./i, "");
  } catch {
    return value;
  }
}
