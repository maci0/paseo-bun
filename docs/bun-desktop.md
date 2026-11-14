# Paseo Bun + Elysia + Tauri v2 Edition

This Linux desktop distribution combines the native Bun AOT daemon and CLI, an
Elysia HTTP host, and a Rust/Tauri v2 desktop window. It uses the production
Paseo 0.16.0-beta.2 React UI, including our indexed history-hydration performance
patch. The architecture follows [dsh-bun](https://github.com/evinelias/dsh-bun).

## Download and run

Download matching `paseo-bun-desktop-*-linux-x64-aot.tar.gz` and `.sha256` assets
from https://github.com/maci0/paseo-bun/releases, verify the checksum and extract:

```sh
archive=paseo-bun-desktop-0.16.0-beta.2-linux-x64-aot.tar.gz
sha256sum -c "$archive.sha256"
tar -xzf "$archive"
./paseo-bun/paseo-bun-desktop
```

Keep the entire extracted directory together. Linux needs GTK 3 and WebKitGTK
4.1 runtime libraries. Node, Bun and Electron installations are not required.
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

The build creates separate CLI/web and desktop archives, each with a SHA-256
checksum. `build-info.json` and `desktop-info.json` record their provenance.

## Compatibility

The web UI's agents, projects, editor, diffs and terminals use the existing
Paseo protocol. Electron-specific integrations, including its embedded Chromium
browser automation, Electron updater and desktop IPC, are not implemented by
this first Tauri target. Dynamic plugins and external scripts remain interpreted
by Bun. The Rust shell and the Bun application graph are native AOT.
