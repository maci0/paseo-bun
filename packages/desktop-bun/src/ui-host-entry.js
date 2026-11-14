import { parseArgs } from "node:util";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startDaemonInstance, resolvePaseoHome } from "@getpaseo/server/daemon-control";
import { createUiHost } from "./ui-host.js";

const { values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    port: { type: "string", default: process.env.PASEO_UI_PORT ?? "6769" },
    "daemon-url": { type: "string" },
    "web-root": { type: "string" },
  },
});
const port = Number(values.port);
if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error("Invalid UI port");
const root = globalThis.paseoAot
  ? path.dirname(process.execPath)
  : fileURLToPath(new URL("../../../", import.meta.url));
let daemonUrl = values["daemon-url"];
if (!daemonUrl) {
  const started = await startDaemonInstance({
    home: resolvePaseoHome(process.env),
    command: process.execPath,
    args: [path.join(root, "packages/server/dist/scripts/supervisor-entrypoint.js")],
    env: process.env,
    mode: "managed",
    timeoutMs: 30_000,
  });
  const listen = started.instance.listen;
  if (!listen || listen.startsWith("unix:"))
    throw new Error("Desktop UI requires a TCP daemon address");
  daemonUrl = listen.includes("://") ? listen : `http://${listen}`;
}
const webRoot =
  values["web-root"] ?? fileURLToPath(new URL("../../server/dist/server/web-ui/", import.meta.url));
const host = createUiHost({ webRoot, daemonUrl, port });
process.stdout.write(JSON.stringify({ type: "paseo-ui-ready", url: host.url }) + "\n");
for (const signal of ["SIGINT", "SIGTERM"])
  process.once(signal, () => {
    host.stop();
    process.exit(0);
  });
