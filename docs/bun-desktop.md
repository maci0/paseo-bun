# Paseo Bun + Elysia + Tauri v2 Edition

This desktop distribution combines the native Bun AOT daemon and CLI, an
Elysia HTTP host, and a Rust/Tauri v2 desktop window. It uses the production
Paseo 0.16.0-beta.2 React UI, including our indexed history-hydration performance
patch. The architecture follows [dsh-bun](https://github.com/evinelias/dsh-bun).

## macOS and Windows

Native CI builds target macOS Apple Silicon (`darwin-arm64`), macOS Intel
(`darwin-x64`), Windows x64 (`win32-x64`), and Linux x64. Download only published
assets from the releases page; a running CI job is not a release asset.

macOS desktop archives contain `paseo-bun/Paseo Bun.app`. Extract the entire
archive and open the app, or move the whole `.app` to Applications. The AOT
engine and dependencies are inside the app. Builds are ad-hoc signed, without
Apple notarization; Gatekeeper may block first launch. The separate CLI archive
contains the standalone `paseo-bun` command and its adjacent assets.

Windows archives are portable: extract the entire `paseo-bun` directory and run
`paseo-bun-desktop.exe`; `paseo-bun.exe` is the CLI. WebView2 Runtime is required.
These builds are not Authenticode signed, so Windows may show a publisher warning.
Use `Get-FileHash -Algorithm SHA256 <archive>` to compare with its `.sha256` file.
Windows includes native ConPTY helpers; no Node or Bun installation is required.

Native builds and CLI/daemon/PTY checks run on each target OS. Interactive macOS
and Windows desktop workflows require manual validation on those systems.

## Download and run — Linux

Download matching `paseo-bun-desktop-*-linux-x64-aot.tar.gz` and `.sha256` assets
from https://github.com/maci0/paseo-bun/releases, verify the checksum and extract:

```sh
release_url=https://github.com/maci0/paseo-bun/releases/download/bun-aot-v0.16.0-beta.2-2
archive=paseo-bun-desktop-0.16.0-beta.2-linux-x64-aot.tar.gz
curl -fLO "$release_url/$archive"
curl -fLO "$release_url/$archive.sha256"
sha256sum -c "$archive.sha256"
tar -xzf "$archive"
./paseo-bun/paseo-bun-desktop
```

Keep the entire extracted directory together. Linux needs GTK 3 and WebKitGTK
4.1 runtime libraries. The published desktop binary requires glibc 2.39 or newer
(for example Ubuntu 24.04). Node, Bun and Electron installations are not required.
The daemon and Elysia host compile with `bun compile --production --trim`;
the Tauri shell uses Cargo's release profile with LTO. The React interface runs
in the system WebKit WebView.

To install under `~/.local/bin`:

```sh
mkdir -p "$HOME/.local/bin"
install_dir=$(mktemp -d "$HOME/.local/bin/paseo-bun-desktop.XXXXXX")
cp -a paseo-bun/. "$install_dir/"
ln -sfn "$install_dir/paseo-bun-desktop" "$HOME/.local/bin/paseo-bun-desktop"
ln -sfn "$install_dir/paseo-bun" "$HOME/.local/bin/paseo-bun"
paseo-bun-desktop
```

## Runtime

The native window starts its sibling AOT executable in `ui-host` mode. Elysia
serves the UI at `http://127.0.0.1:6769`, proxies HTTP APIs, and bridges the
existing binary/JSON WebSocket protocol to the local Paseo daemon. The fixed
local origin preserves browser preferences between launches. Override its port
with `PASEO_UI_PORT` if required.

The host reuses the daemon for `PASEO_HOME` (default `~/.paseo`) and starts it
when absent. Closing the window stops its UI host while leaving the daemon and
agents running. A second desktop launch focuses the existing window. External
HTTP links open in your normal browser.

The UI host rejects foreign origins, unexpected Host headers and static-file
path traversal. It binds exclusively to loopback. The daemon retains upstream
Express handlers and its protocol for compatibility; Elysia hosts the desktop
UI and proxy boundary.

## Build

Install Rust and the Tauri v2 Linux prerequisites (GTK 3/WebKitGTK 4.1 development
packages, a C compiler, pkg-config and OpenSSL development headers), plus the
Node/npm and AOT-capable Bun versions documented in `docs/bun.md`.

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run postinstall
bun test packages/desktop-bun/src/ui-host.test.ts
bun run build:desktop:bun
bun run test:bun
```

The build runs on the target OS (AOT cross-compilation is not used).
It creates separate CLI/web and desktop archives, each with a SHA-256
checksum. `build-info.json` and `desktop-info.json` record their provenance.

## Compatibility

The web UI's agents, projects, editor, diffs and terminals use the existing
Paseo protocol. Electron-specific integrations, including its embedded Chromium
browser automation, Electron updater and desktop IPC, are not implemented by
this first Tauri target. Dynamic plugins and external scripts remain interpreted
by Bun. The Rust shell and the Bun application graph are native AOT.

## Included UI performance patch

History hydration previously scanned and copied the growing timeline for every
tool update. Consecutive tool-call runs now use an identity index and an owned
hydration buffer; live updates retain their immutable behavior.

On this development machine, isolated Chrome CPU profiling of the actual
hydration function measured:

| Tool events |   Upstream | Patched |
| ----------- | ---------: | ------: |
| 1,000       |      78 ms |  1.1 ms |
| 5,000       |   1,642 ms |  3.1 ms |
| 10,000      | 6,708.5 ms |  5.8 ms |

These are synthetic hydration timings, not whole-app load times or WebKit
measurements. The patch passed 245 related tests and app typechecking. The
existing long-history browser streaming test passed with React commit p95
between 7.8 and 8.7 ms across three samples.

The upstream-ready change is on
[perf/large-ui-data](https://github.com/maci0/paseo/tree/perf/large-ui-data).
Run its synthetic benchmark with the app Vitest configuration and
`packages/app/src/types/hydration.bench.ts`.
