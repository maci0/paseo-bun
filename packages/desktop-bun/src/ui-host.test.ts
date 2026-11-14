import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createUiHost } from "./ui-host.js";

const cleanup: Array<() => void> = [];
afterEach(() => {
  while (cleanup.length) cleanup.pop()!();
});
function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), "paseo-elysia-test-"));
  writeFileSync(
    path.join(root, "index.html"),
    '<html><head></head><script src="/app.js"></script></html>',
  );
  writeFileSync(path.join(root, "app.js"), 'console.log("paseo")');
  cleanup.push(() => rmSync(root, { recursive: true, force: true }));
  const backend = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch(request, server) {
      if (new URL(request.url).pathname === "/ws") {
        if (server.upgrade(request)) return;
        return new Response("upgrade failed", { status: 400 });
      }
      return request.method === "POST" ? new Response(request.body) : Response.json({ ok: true });
    },
    websocket: {
      message(socket, message) {
        socket.send(message);
      },
    },
  });
  cleanup.push(() => backend.stop(true));
  const host = createUiHost({
    webRoot: root,
    daemonUrl: `http://127.0.0.1:${backend.port}`,
    port: 0,
  });
  cleanup.push(() => host.stop());
  return host;
}
describe("Elysia desktop UI host", () => {
  test("serves the SPA and assets and forwards API bodies", async () => {
    const host = fixture();
    const html = await (await fetch(host.url + "/workspaces/one")).text();
    expect(html).toContain("<html>");
    expect(html).toContain(`"listen":"127.0.0.1:${host.server.port}"`);
    expect(await (await fetch(host.url + "/app.js")).text()).toContain("paseo");
    expect((await fetch(host.url + "/missing.js")).status).toBe(404);
    expect(
      await (await fetch(host.url + "/api/echo", { method: "POST", body: "preserve body" })).text(),
    ).toBe("preserve body");
    expect(await (await fetch(host.url + "/__paseo_ui/health")).json()).toMatchObject({
      framework: "elysia",
    });
  });
  test("rejects foreign origins, rebound hosts and traversal", async () => {
    const host = fixture();
    expect(
      (await fetch(host.url + "/api/echo", { headers: { origin: "https://evil.example" } })).status,
    ).toBe(403);
    expect((await fetch(host.url, { headers: { host: "evil.example" } })).status).toBe(403);
    expect(
      (
        await fetch(host.url, {
          headers: { host: `localhost:${host.server.port}`, origin: host.url },
        })
      ).status,
    ).toBe(200);
    expect((await fetch(host.url + "/%2e%2e%2fsecret")).status).toBe(403);
  });
  test("proxies JSON and binary WebSocket frames without changing wire types", async () => {
    const host = fixture();
    const socket = new WebSocket(
      host.url.replace("http:", "ws:").replace("127.0.0.1", "localhost") + "/ws",
      {
        headers: { origin: host.url },
      },
    );
    socket.binaryType = "arraybuffer";
    cleanup.push(() => socket.close());
    await new Promise<void>((resolve, reject) => {
      socket.onopen = () => resolve();
      socket.onerror = reject;
    });
    const received = new Promise<unknown>((resolve) => {
      socket.onmessage = (event) => resolve(event.data);
    });
    socket.send('{"type":"hello"}');
    expect(await received).toBe('{"type":"hello"}');
    const binary = new Promise<ArrayBuffer>((resolve) => {
      socket.onmessage = (event) => resolve(event.data);
    });
    socket.send(new Uint8Array([0, 255, 3]));
    expect([...new Uint8Array(await binary)]).toEqual([0, 255, 3]);
  });
});
