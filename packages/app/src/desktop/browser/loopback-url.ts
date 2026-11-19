const IPV4_LOOPBACK = /^127(?:\.\d{1,3}){3}$/;

// The web browser pane frames only loopback pages: other sites usually refuse
// framing, and the Tauri shell opens non-loopback navigations externally
// (packages/desktop-bun/src-tauri/src/main.rs).
export function isLoopbackHttpUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  const host = url.hostname.toLowerCase();
  return (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host === "[::1]" ||
    IPV4_LOOPBACK.test(host)
  );
}
