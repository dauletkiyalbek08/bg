/** Host stays public behind a reverse proxy; its internal request scheme may differ. */
export function isTrustedOrigin(
  origin: string | null,
  host: string | null,
  canonical: string | undefined,
  development: boolean,
) {
  if (!origin || !host) return false;
  try {
    const source = new URL(origin);
    if (source.origin !== origin) return false;
    if (canonical) return source.origin === new URL(canonical).origin;
    if (source.host !== host.toLowerCase()) return false;
    if (source.protocol === "https:") return true;
    const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(
      source.hostname,
    );
    return source.protocol === "http:" && (development || loopback);
  } catch {
    return false;
  }
}
