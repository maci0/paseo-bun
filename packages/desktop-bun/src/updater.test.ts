import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { afterEach, expect, test } from "bun:test";
import {
  compareVersions,
  createApplyScript,
  createUpdater,
  downloadVerifiedArchive,
  selectRelease,
} from "./updater.js";

const cleanup: string[] = [];
afterEach(() => {
  for (const directory of cleanup.splice(0)) rmSync(directory, { recursive: true, force: true });
});

function temp() {
  const directory = mkdtempSync(path.join(tmpdir(), "paseo-updater-"));
  cleanup.push(directory);
  return directory;
}

test("orders dotted versions and ignores a prefix", () => {
  expect(compareVersions("0.16.0", "0.16.1")).toBe(-1);
  expect(compareVersions("v0.16.1", "0.16.1")).toBe(0);
  expect(compareVersions("0.17.0", "0.16.9")).toBe(1);
});

test("picks the newest full release that has this platform's archive", () => {
  const releases = [
    {
      tag_name: "bun-aot-v0.16.2",
      draft: false,
      prerelease: true,
      assets: asset("0.16.2"),
    },
    { tag_name: "bun-aot-v0.16.1", draft: false, prerelease: false, assets: asset("0.16.1") },
    { tag_name: "bun-aot-v0.16.0", draft: false, prerelease: false, assets: asset("0.16.0") },
  ];
  expect(
    selectRelease(releases, { currentVersion: "0.16.0", platform: "linux", arch: "x64" })?.version,
  ).toBe("0.16.1");
  expect(
    selectRelease(releases, { currentVersion: "0.16.1", platform: "linux", arch: "x64" }),
  ).toBeNull();
});

test("rejects an archive whose bytes do not match the published checksum", async () => {
  const directory = temp();
  const name = "paseo-bun-desktop-0.16.1-linux-x64-aot.tar.gz";
  const bytes = Buffer.from("archive");
  const digest = createHash("sha256").update(bytes).digest("hex");
  const files = new Map<string, () => Response>([
    ["https://example.test/archive", () => new Response(bytes)],
    ["https://example.test/checksum", () => new Response(`${digest}  ${name}\n`)],
    ["https://example.test/wrong", () => new Response(`${"0".repeat(64)}  ${name}\n`)],
  ]);
  const fetchImpl = (url: string) =>
    Promise.resolve(files.get(url)?.() ?? new Response("", { status: 404 }));
  const update = {
    name,
    archiveUrl: "https://example.test/archive",
    checksumUrl: "https://example.test/checksum",
  };
  expect(await downloadVerifiedArchive(update, { fetchImpl, directory })).toBe(
    path.join(directory, name),
  );
  await expect(
    downloadVerifiedArchive(
      { ...update, checksumUrl: "https://example.test/wrong" },
      { fetchImpl, directory },
    ),
  ).rejects.toThrow("checksum");
});

test.skipIf(process.platform !== "linux")(
  "installs only a verified AppImage at the original executable path",
  async () => {
    const appImagePath = path.join(temp(), "My Paseo.AppImage");
    writeFileSync(appImagePath, "old");
    const name = "Paseo-Bun-0.16.2-x86_64.AppImage";
    const url = `https://example.test/${name}`;
    const next = "new AppImage";
    const digest = createHash("sha256").update(next).digest("hex");
    let checksum = "0".repeat(64);
    const updater = createUpdater({
      currentVersion: "0.16.1",
      appImagePath,
      fetchImpl: async (request: string) => {
        if (request === url) return new Response(next);
        if (request === `${url}.sha256`) return new Response(checksum);
        return Response.json([
          { tag_name: "bun-aot-v0.16.3", assets: asset("0.16.3") },
          {
            tag_name: "bun-aot-v0.16.2",
            assets: [name, `${name}.sha256`].map((file) => ({
              name: file,
              browser_download_url: `https://example.test/${file}`,
            })),
          },
        ]);
      },
    });
    const { update } = await updater.check();
    expect(update?.name).toBe(name);
    if (!update) throw new Error("Expected AppImage update");
    await expect(updater.stage(update)).rejects.toThrow("checksum");
    expect(readFileSync(appImagePath, "utf8")).toBe("old");
    checksum = digest;
    await updater.stage(update);
    expect(readFileSync(appImagePath, "utf8")).toBe("old");
    expect(await updater.install()).toEqual({ installed: true, version: "0.16.2" });
    expect(readFileSync(appImagePath, "utf8")).toBe(next);
    expect(statSync(appImagePath).mode & 0o777).toBe(0o755);
  },
);

test.skipIf(process.platform === "win32")(
  "the apply script replaces the install directory after its parent exits",
  () => {
    const root = temp();
    const install = path.join(root, "paseo-bun");
    mkdirSync(install);
    writeFileSync(path.join(install, "marker"), "old");
    const archiveDirectory = path.join(root, "source");
    const bundle = path.join(archiveDirectory, "paseo-bun");
    mkdirSync(path.join(bundle, "bin"), { recursive: true });
    writeFileSync(path.join(bundle, "marker"), "new");
    writeFileSync(path.join(bundle, "paseo-bun"), "#!/bin/sh\n");
    writeFileSync(path.join(bundle, "paseo-bun-desktop"), "#!/bin/sh\n");
    const archive = path.join(root, "update.tar.gz");
    const packed = spawnSync("tar", ["-czf", archive, "-C", archiveDirectory, "paseo-bun"]);
    expect(packed.status).toBe(0);
    const script = createApplyScript({ installDirectory: install, archivePath: archive });
    const gone = spawnSync("/bin/sh", ["-c", "exit 0"]);
    const applied = spawnSync("/bin/sh", [script, String(gone.pid)]);
    expect(applied.status, applied.stderr.toString()).toBe(0);
    expect(readFileSync(path.join(install, "marker"), "utf8")).toBe("new");
    expect(readFileSync(path.join(install, "paseo-bun"), "utf8")).toContain("bin/sh");
  },
);

function asset(version: string) {
  const name = `paseo-bun-desktop-${version}-linux-x64-aot.tar.gz`;
  return [name, `${name}.sha256`].map((assetName) => ({
    name: assetName,
    browser_download_url: `https://example.test/${assetName}`,
  }));
}

test.skipIf(process.platform !== "linux")(
  "restarts the Linux desktop after stopping its old daemon with terminal retention",
  () => {
    const root = temp();
    const install = path.join(root, "install");
    const bundle = path.join(root, "paseo-bun");
    mkdirSync(install);
    mkdirSync(bundle);
    writeFileSync(
      path.join(install, "paseo-bun"),
      '#!/bin/sh\ntest "$*" = "daemon stop --keep-terminals --timeout 30" && echo stopped\n',
      { mode: 0o755 },
    );
    writeFileSync(path.join(bundle, "paseo-bun"), "#!/bin/sh\n", { mode: 0o755 });
    writeFileSync(path.join(bundle, "paseo-bun-desktop"), "#!/bin/sh\necho relaunched\n", {
      mode: 0o755,
    });
    const archive = path.join(root, "update.tar.gz");
    expect(spawnSync("tar", ["-czf", archive, "-C", root, "paseo-bun"]).status).toBe(0);
    const script = createApplyScript({
      installDirectory: install,
      archivePath: archive,
      restart: true,
    });
    const desktop = spawn("sleep", ["30"]);
    const exitedHost = spawnSync("true");
    try {
      const result = spawnSync("/bin/sh", [script, String(desktop.pid), String(exitedHost.pid)], {
        encoding: "utf8",
        timeout: 5000,
      });
      expect(result.status, result.stderr).toBe(0);
      expect(result.stdout).toBe("stopped\nrelaunched\n");
    } finally {
      desktop.kill();
    }
  },
);
