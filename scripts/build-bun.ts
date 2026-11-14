import { execFileSync } from "node:child_process";
import {
  cpSync,
  readdirSync,
  readFileSync,
  writeFileSync,
  lstatSync,
  mkdirSync,
  readlinkSync,
  rmSync,
  symlinkSync,
} from "node:fs";
import path from "node:path";
import { rebaseModuleUrl } from "./aot-module-path";
import { createHash } from "node:crypto";

const root = path.resolve(import.meta.dir, "..");
const output = path.join(root, "dist/paseo-bun");
function run(command: string, args: string[]) {
  execFileSync(command, args, {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32" && command === "npm",
    env: {
      ...process.env,
      PASEO_AOT_BUILD: "1",
      NODE_OPTIONS: process.env.NODE_OPTIONS ?? "--max-old-space-size=4096",
    },
  });
}

run("npm", ["run", "build:server"]);
run("npm", ["run", "build:web", "--workspace=@getpaseo/app"]);
const files = execFileSync("node", ["scripts/trace-daemon.mjs"], {
  env: { ...process.env, PASEO_TRACE_BUN: "1" },
  cwd: root,
  encoding: "utf8",
  maxBuffer: 32 * 1024 * 1024,
})
  .trim()
  .split(/\r?\n/)
  .map((file) => file.replaceAll("\\", "/"));
rmSync(output, { recursive: true, force: true });
mkdirSync(output, { recursive: true });
const windowsLinks: Array<[string, string]> = [];
for (const file of files) {
  if (!(file.startsWith("node_modules/") || file.startsWith("packages/"))) continue;
  const source = path.resolve(root, file);
  const destination = path.resolve(output, file);
  if (!source.startsWith(root + path.sep) || !destination.startsWith(output + path.sep)) {
    throw new Error(`Runtime trace escaped package root: ${file}`);
  }
  mkdirSync(path.dirname(destination), { recursive: true });
  const stat = lstatSync(source);
  if (stat.isSymbolicLink()) {
    const target = path.resolve(path.dirname(source), readlinkSync(source));
    if (!target.startsWith(root + path.sep))
      throw new Error(`Runtime link escaped checkout: ${file}`);
    if (process.platform === "win32")
      windowsLinks.push([path.resolve(output, path.relative(root, target)), destination]);
    else symlinkSync(path.relative(path.dirname(source), target), destination);
  } else if (stat.isDirectory()) mkdirSync(destination, { recursive: true });
  else cpSync(source, destination);
  if (path.basename(file) === "package.json") {
    for (const name of readdirSync(path.dirname(source))) {
      if (
        /^(licen[cs]e|notice)([.-]|$)/i.test(name) &&
        lstatSync(path.join(path.dirname(source), name)).isFile()
      ) {
        cpSync(path.join(path.dirname(source), name), path.join(path.dirname(destination), name));
      }
    }
  }
}
cpSync(path.join(root, "LICENSE"), path.join(output, "LICENSE"));
cpSync(
  path.join(root, "packages/app/dist"),
  path.join(output, "packages/server/dist/server/web-ui"),
  { recursive: true },
);
// The retained terminal worker is loaded by path, outside the module graph.
cpSync(
  path.join(root, "packages/server/dist/server/terminal-worker"),
  path.join(output, "packages/server/dist/server/terminal-worker"),
  { recursive: true },
);
// dsh-bun's PTY adapter retries EAGAIN instead of closing an idle terminal.
if (process.platform !== "win32") {
  const ptyLibrary = path.join(output, "packages/server/node_modules/node-pty/lib");
  const unixTerminal = path.join(ptyLibrary, "unixTerminal.js");
  const source = readFileSync(unixTerminal, "utf8");
  if (!source.includes("new tty.ReadStream(term.fd)"))
    throw new Error("node-pty stream construction changed");
  writeFileSync(
    unixTerminal,
    source.replace(
      /new tty\.ReadStream\((term\.(?:fd|master|slave))\)/g,
      'process.versions.bun ? require("./bunReadStream").createReadStream($1) : new tty.ReadStream($1)',
    ),
  );
  cpSync(
    path.join(root, "scripts/node-pty-bun-readstream.cjs"),
    path.join(ptyLibrary, "bunReadStream.js"),
  );
}
// Preserve disk asset locations while compiling the application graph to native code.
function rebaseModules(directory: string) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isSymbolicLink() || entry.name === "node_modules" || entry.name === "web-ui")
      continue;
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) rebaseModules(file);
    else if (/\.[cm]?js$/.test(entry.name)) {
      const relative = path.relative(output, file).split(path.sep).join("/");
      const source = readFileSync(file, "utf8");
      writeFileSync(file, rebaseModuleUrl(source, relative));
    }
  }
}
rebaseModules(path.join(output, "packages"));
for (const [target, destination] of windowsLinks) cpSync(target, destination, { recursive: true });
cpSync(path.join(root, "scripts/aot-entry.js"), path.join(output, "aot-entry.js"));
execFileSync(
  process.execPath,
  [
    "compile",
    "aot-entry.js",
    "--root",
    ".",
    "--production",
    "--trim",
    "--aot-allow-code-from-disk",
    "--outfile",
    process.platform === "win32" ? "paseo-bun.exe" : "paseo-bun",
  ],
  { cwd: output, stdio: "inherit" },
);
console.log(`Built native AOT ${output}/paseo-bun; distribute the entire directory.`);
const version = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")).version;
const archive = `paseo-bun-${version}-${process.platform}-${process.arch}-aot.tar.gz`;
const info = {
  version,
  mode: "native-aot",
  trim: true,
  webUi: true,
  aotInput: "upstream-emitted-javascript",
  platform: process.platform,
  arch: process.arch,
  archive,
  bunRevision: execFileSync(process.execPath, ["--revision"], { encoding: "utf8" }).trim(),
  sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(),
  sourceDirty: Boolean(
    execFileSync("git", ["status", "--porcelain", "--untracked-files=no"], {
      cwd: root,
      encoding: "utf8",
    }).trim(),
  ),
};
writeFileSync(path.join(output, "build-info.json"), JSON.stringify(info, null, 2) + "\n");
cpSync(path.join(root, "docs/bun-dist.md"), path.join(output, "README.md"));
const archivePath = path.join(root, "dist", archive);
run("tar", ["-C", path.join(root, "dist"), "-czf", path.relative(root, archivePath), "paseo-bun"]);
const checksum = createHash("sha256").update(readFileSync(archivePath)).digest("hex");
writeFileSync(archivePath + ".sha256", `${checksum}  ${archive}\n`);
console.log(`Distribution: ${archivePath} (SHA-256 alongside)`);
