import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createUiHost } from "./ui-host.js";

const cleanup: Array<() => void> = [];
afterEach(() => {
  while (cleanup.length) cleanup.pop()!();
});
function fixture(localServerId: string | null = null, updater = null) {
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
    localServerId,
    updater,
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
    expect(html).toContain("window.__PASEO_BUN_DESKTOP__=true");
    expect(await (await fetch(host.url + "/app.js")).text()).toContain("paseo");
    expect((await fetch(host.url + "/missing.js")).status).toBe(404);
    expect(
      await (await fetch(host.url + "/api/echo", { method: "POST", body: "preserve body" })).text(),
    ).toBe("preserve body");
    expect(await (await fetch(host.url + "/__paseo_ui/health")).json()).toMatchObject({
      framework: "elysia",
    });
  });
  test("exposes only the explicitly supplied local daemon identity", async () => {
    const host = fixture("srv_local");
    expect(await (await fetch(host.url)).text()).toContain(
      'window.__PASEO_LOCAL_DAEMON_SERVER_ID__="srv_local"',
    );
    const remote = fixture();
    expect(await (await fetch(remote.url)).text()).toContain(
      "window.__PASEO_LOCAL_DAEMON_SERVER_ID__=null",
    );
  });
  test("checks and applies an update only through the injected updater", async () => {
    const calls: string[] = [];
    const host = fixture(null, {
      async check() {
        calls.push("check");
        return { currentVersion: "0.16.1", update: { version: "0.16.2" } };
      },
      async stage() {
        calls.push("stage");
      },
      async install() {
        calls.push("install");
        return { installed: true, version: "0.16.2" };
      },
    });
    expect(await (await fetch(host.url + "/__paseo_ui/update")).json()).toEqual({
      available: true,
      currentVersion: "0.16.1",
      version: "0.16.2",
    });
    expect(await (await fetch(host.url + "/__paseo_ui/update", { method: "POST" })).json()).toEqual({
      installed: true,
      version: "0.16.2",
    });
    expect(calls).toEqual(["check", "check", "stage", "install"]);
    const plain = fixture();
    expect((await fetch(plain.url + "/__paseo_ui/update", { method: "POST" })).status).toBe(404);
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
