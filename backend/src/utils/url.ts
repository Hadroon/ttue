// Only http(s) links are accepted so javascript:/data: URLs can never be rendered as hrefs.
// Input without "://" (e.g. "index.hu") is treated as https; "javascript:x" or "mailto:a@b" then
// fail to parse as a host, or carry credentials, and are rejected.
export function normalizeUrl(raw: unknown, maxLength = 200): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > maxLength) return null;
  const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed);
  try {
    const parsed = new URL(hasScheme ? trimmed : `https://${trimmed}`);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    if (parsed.username || parsed.password) return null;
    if (!hasScheme && !parsed.hostname.includes(".")) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}
