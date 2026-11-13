import path from "node:path";
import { pathToFileURL } from "node:url";

const root = path.dirname(process.execPath);
const requested = process.argv[2];
const entries = {
  "supervisor-entrypoint.js": "packages/server/dist/scripts/supervisor-entrypoint.js",
  "daemon-worker.js": "packages/server/dist/server/server/daemon-worker.js",
  "worker-process.js":
    "packages/server/dist/server/server/speech/providers/local/worker-process.js",
};
const role =
  Object.keys(entries).find((name) => requested === path.join(root, entries[name])) ??
  (requested && path.isAbsolute(requested) && path.basename(requested) === "terminal-worker.mjs"
    ? "terminal-worker.mjs"
    : null);
const diskScript = requested && path.isAbsolute(requested) && /\.[cm]?[jt]s$/.test(requested);
if (role || diskScript) process.argv.splice(1, 1);
process.argv[0] = process.execPath;
globalThis.paseoAot = true;
// Compiled modules retain the asset paths of the relocatable distribution.
globalThis.paseoModuleUrl = (relative) =>
  pathToFileURL(
    role === "terminal-worker.mjs" && relative.endsWith("/terminal-worker/terminal-worker.mjs")
      ? requested
      : path.join(root, relative),
  ).href;
switch (role) {
  case "supervisor-entrypoint.js":
    await import("./packages/server/dist/scripts/supervisor-entrypoint.js");
    break;
  case "daemon-worker.js":
    await import("./packages/server/dist/server/server/daemon-worker.js");
    break;
  case "terminal-worker.mjs":
    await import("./packages/server/dist/server/terminal-worker/terminal-worker.mjs");
    break;
  case "worker-process.js":
    await import("./packages/server/dist/server/server/speech/providers/local/worker-process.js");
    break;
  default:
    if (diskScript) await import(pathToFileURL(requested).href);
    else await import("./packages/cli/dist/index.js");
}
