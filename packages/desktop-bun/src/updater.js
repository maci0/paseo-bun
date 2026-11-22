import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { chmodSync, mkdtempSync, realpathSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const RELEASES = "https://api.github.com/repos/maci0/paseo-bun/releases?per_page=20";
const TAG_PREFIX = "bun-aot-v";

export function compareVersions(left, right) {
  const parse = (value) =>
    String(value)
      .replace(/^v/, "")
      .split(".")
      .map((part) => Number.parseInt(part, 10) || 0);
  const a = parse(left);
  const b = parse(right);
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    const difference = (a[index] ?? 0) - (b[index] ?? 0);
    if (difference !== 0) return difference < 0 ? -1 : 1;
  }
  return 0;
}

export function desktopAssetName(version, platform, arch) {
  return `paseo-bun-desktop-${version}-${platform}-${arch}-aot.tar.gz`;
}

// A release counts only when it is a full release with both the archive and
// its checksum. Prereleases stay off this path so a beta cannot replace stable.
export function selectRelease(releases, { currentVersion, platform, arch, appImagePath }) {
  const candidates = [];
  for (const release of releases) {
    if (release.draft || release.prerelease || !String(release.tag_name).startsWith(TAG_PREFIX)) {
      continue;
    }
    const version = release.tag_name.slice(TAG_PREFIX.length);
    if (compareVersions(version, currentVersion) <= 0) continue;
    const name = appImagePath
      ? `Paseo-Bun-${version}-x86_64.AppImage`
      : desktopAssetName(version, platform, arch);
    const archive = (release.assets ?? []).find((asset) => asset.name === name);
    const checksum = (release.assets ?? []).find((asset) => asset.name === `${name}.sha256`);
    if (!archive?.browser_download_url || !checksum?.browser_download_url) continue;
    candidates.push({
      version,
      name,
      archiveUrl: archive.browser_download_url,
      checksumUrl: checksum.browser_download_url,
    });
  }
  candidates.sort((left, right) => compareVersions(right.version, left.version));
  return candidates[0] ?? null;
}

function readChecksum(text) {
  const digest = text.trim().split(/\s+/)[0]?.toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(digest ?? "")) throw new Error("Release checksum is unreadable");
  return digest;
}

export async function downloadVerifiedArchive(update, { fetchImpl = fetch, directory }) {
  const [archiveResponse, checksumResponse] = await Promise.all([
    fetchImpl(update.archiveUrl),
    fetchImpl(update.checksumUrl),
  ]);
  if (!archiveResponse.ok || !checksumResponse.ok) throw new Error("Update download failed");
  const bytes = Buffer.from(await archiveResponse.arrayBuffer());
  const digest = createHash("sha256").update(bytes).digest("hex");
  if (digest !== readChecksum(await checksumResponse.text())) {
    throw new Error("Update checksum does not match the archive");
  }
  const archivePath = path.join(directory, update.name);
  writeFileSync(archivePath, bytes);
  return archivePath;
}

function shellQuote(value) {
  return `'${String(value).replaceAll("'", "'\\''")}'`;
}

// The running desktop executable cannot replace itself. This script waits for
// that process, extracts the verified archive, and swaps the install directory.
export function createApplyScript({ installDirectory, archivePath, restart = false }) {
  const directory = mkdtempSync(path.join(path.dirname(installDirectory), ".paseo-bun-update-"));
  const scriptPath = path.join(directory, "apply.sh");
  const script = `#!/bin/sh
set -eu
parent=$1
workdir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
install_dir=${shellQuote(installDirectory)}
wait_for_exit() {
  while kill -0 "$1" 2>/dev/null; do
    case "$(ps -o stat= -p "$1")" in *Z*) break ;; esac
    sleep 0.2
  done
}
tar -xzf ${shellQuote(archivePath)} -C "$workdir"
test -d "$workdir/paseo-bun"
${
  restart
    ? `test -x "$workdir/paseo-bun/paseo-bun"
test -x "$workdir/paseo-bun/paseo-bun-desktop"
# Give the UI time to receive the install response before its window exits.
sleep 1
kill -TERM "$parent"`
    : ""
}
wait_for_exit "$parent"
${
  restart
    ? `wait_for_exit "$2"
if ! "$install_dir/paseo-bun" daemon stop --keep-terminals --timeout 30; then
  exec "$install_dir/paseo-bun-desktop"
fi`
    : ""
}
backup="$workdir/previous"
mv "$install_dir" "$backup"
if ! mv "$workdir/paseo-bun" "$install_dir"; then
  mv "$backup" "$install_dir"
  ${restart ? 'exec "$install_dir/paseo-bun-desktop"' : "exit 1"}
fi
rm -f ${shellQuote(archivePath)}
rmdir "$(dirname ${shellQuote(archivePath)})" 2>/dev/null || true
rm -rf "$workdir"
${restart ? 'exec "$install_dir/paseo-bun-desktop"' : ""}
`;
  writeFileSync(scriptPath, script, { mode: 0o755 });
  chmodSync(scriptPath, 0o755);
  return scriptPath;
}

export function spawnApply(scriptPath, parentPid, hostPid) {
  const child = spawn("/bin/sh", [scriptPath, String(parentPid), String(hostPid)], {
    detached: true,
    stdio: ["ignore", "ignore", "inherit"],
  });
  child.unref();
}

export function createUpdater({
  currentVersion,
  platform = process.platform,
  arch = process.arch,
  installDirectory,
  appImagePath,
  fetchImpl = fetch,
  desktopPid,
}) {
  let pending = null;
  return {
    async check() {
      const response = await fetchImpl(RELEASES, {
        headers: { accept: "application/vnd.github+json", "user-agent": "paseo-bun" },
      });
      if (!response.ok) throw new Error("Could not read Paseo Bun releases");
      const update = selectRelease(await response.json(), {
        currentVersion,
        platform,
        arch,
        appImagePath,
      });
      return { currentVersion, update };
    },
    async stage(update) {
      const target = appImagePath ? realpathSync(appImagePath) : null;
      const directory = mkdtempSync(
        target
          ? path.join(path.dirname(target), ".paseo-bun-update-")
          : path.join(tmpdir(), "paseo-bun-download-"),
      );
      try {
        const archivePath = await downloadVerifiedArchive(update, { fetchImpl, directory });
        pending = { update, archivePath, target };
      } catch (error) {
        rmSync(directory, { recursive: true, force: true });
        throw error;
      }
      return { version: update.version };
    },
    async install() {
      if (!pending) throw new Error("No update has been downloaded");
      if (pending.target) {
        const { archivePath, target, update } = pending;
        pending = null;
        try {
          chmodSync(archivePath, 0o755);
          // The running mount keeps the original inode. Rename on the same filesystem.
          renameSync(archivePath, target);
        } finally {
          rmSync(path.dirname(archivePath), { recursive: true, force: true });
        }
        return { installed: true, version: update.version };
      }
      const scriptPath = createApplyScript({
        installDirectory,
        archivePath: pending.archivePath,
        restart: platform === "linux",
      });
      spawnApply(scriptPath, desktopPid, process.pid);
      const { update } = pending;
      pending = null;
      return { installed: true, version: update.version };
    },
  };
}
