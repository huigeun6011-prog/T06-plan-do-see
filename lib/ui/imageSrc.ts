// shortcut: any https host is accepted, restrict to a host allowlist when real image URLs come from the database
export function httpsSrc(src: string | undefined): string | null {
  if (!src) return null;
  try {
    const url = new URL(src);
    return url.protocol === "https:" && url.hostname && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}
