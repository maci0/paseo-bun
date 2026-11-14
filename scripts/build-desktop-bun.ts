import { execFileSync } from "node:child_process";
import { cpSync, readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";

const root = path.resolve(import.meta.dir, "..");
const run = (command: string, args: string[]) =>
  execFileSync(command, args, { cwd: root, stdio: "inherit" });
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
const suffix = process.platform === "win32" ? ".exe" : "";
cpSync(
  path.join(root, "packages/desktop-bun/src-tauri/target/release/paseo-bun-desktop" + suffix),
  path.join(output, "paseo-bun-desktop" + suffix),
);
const desktopVersion = execFileSync(
  path.join(output, "paseo-bun-desktop" + suffix),
  ["--version"],
  { encoding: "utf8" },
);
if (!desktopVersion.includes("0.16.0-beta.2")) throw new Error("Desktop version smoke test failed");
cpSync(path.join(root, "docs/bun-desktop.md"), path.join(output, "README-desktop.md"));
const info = JSON.parse(readFileSync(path.join(output, "build-info.json"), "utf8"));
const archive = `paseo-bun-desktop-${info.version}-${process.platform}-${process.arch}-aot.tar.gz`;
writeFileSync(
  path.join(output, "desktop-info.json"),
  JSON.stringify({ ...info, shell: "tauri-v2", uiHost: "elysia", archive }, null, 2) + "\n",
);
const archivePath = path.join(root, "dist", archive);
let archiveRoot = path.join(root, "dist");
if (process.platform === "darwin") {
  archiveRoot = path.join(root, "dist/desktop-macos");
  rmSync(archiveRoot, { recursive: true, force: true });
  const contents = path.join(archiveRoot, "paseo-bun/Paseo Bun.app/Contents");
  mkdirSync(path.join(contents, "Resources"), { recursive: true });
  cpSync(
    path.join(root, "packages/desktop/assets/icon.icns"),
    path.join(contents, "Resources/icon.icns"),
  );
  cpSync(output, path.join(contents, "Resources/runtime"), {
    recursive: true,
    verbatimSymlinks: true,
  });
  mkdirSync(path.join(contents, "MacOS"));
  cpSync(path.join(output, "paseo-bun-desktop"), path.join(contents, "MacOS/paseo-bun-desktop"));
  writeFileSync(
    path.join(contents, "Info.plist"),
    `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict><key>CFBundleIconFile</key><string>icon.icns</string><key>CFBundleExecutable</key><string>paseo-bun-desktop</string><key>CFBundleIdentifier</key><string>sh.paseo.bun</string><key>CFBundleName</key><string>Paseo Bun</string><key>CFBundlePackageType</key><string>APPL</string><key>CFBundleShortVersionString</key><string>0.16.0</string><key>CFBundleVersion</key><string>2</string><key>NSHighResolutionCapable</key><true/></dict></plist>`,
  );
  run("codesign", ["--force", "--sign", "-", path.dirname(contents)]);
}
execFileSync("tar", ["-C", archiveRoot, "-czf", path.relative(root, archivePath), "paseo-bun"], {
  cwd: root,
  stdio: "inherit",
});
writeFileSync(
  archivePath + ".sha256",
  `${createHash("sha256").update(readFileSync(archivePath)).digest("hex")}  ${archive}\n`,
);
console.log(`Desktop distribution: ${archivePath}`);
