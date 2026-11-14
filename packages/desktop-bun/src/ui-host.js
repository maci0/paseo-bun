import { Elysia } from "elysia";
import WebSocket from "ws";
import path from "node:path";
import { MAX_WEBSOCKET_MESSAGE_BYTES } from "@getpaseo/protocol/websocket-message-limit";

export function createUiHost({ webRoot, daemonUrl, port = 6769 }) {
  const root = path.resolve(webRoot);
  const target = new URL(daemonUrl);
  if (!["http:", "https:"].includes(target.protocol)) throw new Error("Invalid daemon HTTP URL");
  const sessions = new Set();
  let server;
  const allowed = (request) => {
    const hosts = [`127.0.0.1:${server.port}`, `localhost:${server.port}`];
    const origin = request.headers.get("origin");
    return (
      hosts.includes(request.headers.get("host")) &&
      (!origin || hosts.some((host) => origin === `http://${host}`))
    );
  };
  const proxy = (request) => {
    const url = new URL(request.url);
    const headers = new Headers(request.headers);
    headers.delete("host");
    headers.delete("connection");
    headers.set("origin", target.origin);
    headers.set("accept-encoding", "identity");
    return fetch(new URL(url.pathname + url.search, target), {
      method: request.method,
      headers,
      redirect: "manual",
      body: ["GET", "HEAD"].includes(request.method) ? undefined : request.body,
    });
  };
  const indexResponse = async () => {
    const html = await Bun.file(path.join(root, "index.html")).text();
    const hint = { listen: `127.0.0.1:${server.port}`, useTls: false, label: "Paseo Bun" };
    const script = `<script>window.__PASEO_INITIAL_DAEMON_CONNECTION__=${JSON.stringify(hint)}</script>`;
    return new Response(html.replace(/<\/head>/i, `${script}</head>`), {
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" },
    });
  };
  const app = new Elysia()
    .get("/__paseo_ui/health", () => ({ ok: true, framework: "elysia", daemon: target.origin }))
    .all("/.well-known/*", ({ request }) => proxy(request), { parse: "none" })
    .all("/api/*", ({ request }) => proxy(request), { parse: "none" })
    .get("*", async ({ request }) => {
      let pathname;
      try {
        pathname = decodeURIComponent(new URL(request.url).pathname);
      } catch {
        return new Response("Invalid path", { status: 400 });
      }
      const filePath = path.resolve(root, "." + pathname);
      if (filePath !== root && !filePath.startsWith(root + path.sep)) {
        return new Response("Forbidden", { status: 403 });
      }
      if (filePath === path.join(root, "index.html")) return indexResponse();
      const file = Bun.file(filePath);
      if (filePath !== root && (await file.exists())) {
        return new Response(file, {
          headers: {
            "Cache-Control": filePath.endsWith(".html") ? "no-cache" : "public, max-age=3600",
          },
        });
      }
      if (path.extname(pathname)) return new Response("Not found", { status: 404 });
      return indexResponse();
    });

  async function upgrade(request) {
    const url = new URL(request.url);
    const upstreamUrl = new URL(url.pathname + url.search, target);
    upstreamUrl.protocol = target.protocol === "https:" ? "wss:" : "ws:";
    const protocols = (request.headers.get("sec-websocket-protocol") ?? "")
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    const upstream = new WebSocket(upstreamUrl, protocols, {
      origin: target.origin,
      maxPayload: MAX_WEBSOCKET_MESSAGE_BYTES,
      perMessageDeflate: false,
    });
    const session = { upstream, front: null, pending: [], pendingBytes: 0, closed: false };
    upstream.on("message", (data, binary) => {
      if (session.front) {
        if (session.front.send(binary ? data : data.toString()) === -1) upstream.pause();
      } else {
        session.pendingBytes += data.length;
        if (session.pendingBytes > MAX_WEBSOCKET_MESSAGE_BYTES) {
          upstream.terminate();
          return;
        }
        session.pending.push([data, binary]);
      }
    });
    upstream.on("error", () => session.front?.close(1011, "Daemon connection failed"));
    upstream.on("close", () => {
      session.closed = true;
      session.front?.close();
    });
    try {
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          upstream.terminate();
          reject(new Error("Daemon timeout"));
        }, 10_000);
        upstream.once("open", () => {
          clearTimeout(timeout);
          resolve();
        });
        upstream.once("error", (error) => {
          clearTimeout(timeout);
          reject(error);
        });
        upstream.once("close", () => {
          clearTimeout(timeout);
          reject(new Error("Daemon closed"));
        });
      });
      if (session.closed) throw new Error("Daemon closed");
      const headers = upstream.protocol ? { "Sec-WebSocket-Protocol": upstream.protocol } : {};
      if (server.upgrade(request, { data: session, headers })) {
        sessions.add(session);
        return;
      }
    } catch {
      /* The HTTP handshake must fail rather than create a disconnected client. */
    }
    upstream.terminate();
    return new Response("Daemon unavailable", { status: 502 });
  }
  server = Bun.serve({
    hostname: "127.0.0.1",
    port,
    fetch(request) {
      if (!allowed(request)) return new Response("Forbidden", { status: 403 });
      if (
        new URL(request.url).pathname === "/ws" &&
        request.headers.get("upgrade")?.toLowerCase() === "websocket"
      )
        return upgrade(request);
      return app.fetch(request);
    },
    websocket: {
      maxPayloadLength: MAX_WEBSOCKET_MESSAGE_BYTES,
      backpressureLimit: 2 * MAX_WEBSOCKET_MESSAGE_BYTES,
      closeOnBackpressureLimit: true,
      open(socket) {
        const session = socket.data;
        session.front = socket;
        for (const [data, binary] of session.pending) socket.send(binary ? data : data.toString());
        session.pending = [];
        session.pendingBytes = 0;
        if (session.closed) socket.close();
      },
      message(socket, data) {
        const upstream = socket.data.upstream;
        if (
          upstream.readyState !== WebSocket.OPEN ||
          upstream.bufferedAmount > 2 * MAX_WEBSOCKET_MESSAGE_BYTES
        ) {
          socket.close(1013, "Daemon busy");
          return;
        }
        upstream.send(data, { binary: typeof data !== "string" }, (error) => {
          if (error) socket.close(1011);
        });
      },
      drain(socket) {
        socket.data.upstream.resume();
      },
      close(socket) {
        sessions.delete(socket.data);
        socket.data.upstream.close();
      },
    },
  });
  return {
    server,
    url: `http://127.0.0.1:${server.port}`,
    stop() {
      for (const session of sessions) session.upstream.terminate();
      sessions.clear();
      server.stop(true);
    },
  };
}
