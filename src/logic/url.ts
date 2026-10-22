/**
 * Pure URL helpers. No DOM, no network — everything here is unit tested.
 */

/** Add a scheme when missing and accept only http(s). Returns null when unusable. */
export function normalizeUrl(input: string): string | null {
  const trimmed = input.trim();
  if (trimmed === '') return null;

  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    return null;
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
  if (parsed.hostname === '') return null;

  // Reject hosts that are not plausible names or addresses, e.g. "!!!" or "a b".
  const host = parsed.hostname;
  const isIpv6 = host.startsWith('[') && host.endsWith(']');
  if (!isIpv6 && !/^[a-z0-9.-]+$/i.test(host)) return null;

  return parsed.toString();
}

/** Hostname without a leading "www.", for labels and icons. */
export function hostLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./i, '');
  } catch {
    return '';
  }
}

/** Favicon service URL for a site. Falls back to a sized Google icon. */
export function faviconUrl(url: string, size = 128): string {
  const host = hostLabel(url);
  if (host === '') return '';
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=${size}`;
}

/** Initial letter used when no icon renders. */
export function initialFor(title: string, url: string): string {
  const source = title.trim() || hostLabel(url);
  return source.charAt(0).toUpperCase() || '?';
}
