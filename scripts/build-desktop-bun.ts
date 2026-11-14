import { execFileSync } from "node:child_process";
import { cpSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";

const root = path.resolve(import.meta.dir, "..");
const run = (command: string, args: string[]) =>
  execFileSync(command, args, { cwd: root, stdio: "inherit" });
if (process.platform !== "linux")
  throw new Error("The desktop distribution currently targets Linux");
run(process.execPath, ["run", "build:bun"]);
run("cargo", [
  "build",
  "--release",
  "--locked",
  "--jobs",
  "2",
  "--manifest-path",
  "packages/desktop-bun/src-tauri/Cargo.toml",
]);
const output = path.join(root, "dist/paseo-bun");
cpSync(
  path.join(root, "packages/desktop-bun/src-tauri/target/release/paseo-bun-desktop"),
  path.join(output, "paseo-bun-desktop"),
);
cpSync(path.join(root, "docs/bun-desktop.md"), path.join(output, "README-desktop.md"));
const info = JSON.parse(readFileSync(path.join(output, "build-info.json"), "utf8"));
const archive = `paseo-bun-desktop-${info.version}-${process.platform}-${process.arch}-aot.tar.gz`;
writeFileSync(
  path.join(output, "desktop-info.json"),
  JSON.stringify({ ...info, shell: "tauri-v2", uiHost: "elysia", archive }, null, 2) + "\n",
);
const archivePath = path.join(root, "dist", archive);
run("tar", ["-C", path.join(root, "dist"), "-czf", archivePath, "paseo-bun"]);
writeFileSync(
  archivePath + ".sha256",
  `${createHash("sha256").update(readFileSync(archivePath)).digest("hex")}  ${archive}\n`,
);
console.log(`Desktop distribution: ${archivePath}`);
