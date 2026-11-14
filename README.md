# Paseo Bun + Elysia + Tauri v2

Paseo **0.16.0-beta.2** with native Bun AOT CLI/daemon, an Elysia UI host,
a Rust/Tauri v2 desktop window, and our large-history UI performance patch.
Packaging follows [dsh-bun](https://github.com/evinelias/dsh-bun).

[Current release](https://github.com/maci0/paseo-bun/releases/tag/bun-aot-v0.16.0-beta.2-2) ·
[Desktop instructions](docs/bun-desktop.md) · [CLI instructions](docs/bun-dist.md) ·
[Build from source](docs/bun.md)

## TL;DR — download and start the desktop

Linux x64 only. Requires **glibc 2.39+, GTK 3 and WebKitGTK 4.1**
(for example Ubuntu 24.04 with those runtime libraries installed).
No separate Node, Bun or Electron installation is needed.

```sh
release_url=https://github.com/maci0/paseo-bun/releases/download/bun-aot-v0.16.0-beta.2-2
archive=paseo-bun-desktop-0.16.0-beta.2-linux-x64-aot.tar.gz
curl -fLO "$release_url/$archive" &&
curl -fLO "$release_url/$archive.sha256" &&
sha256sum -c "$archive.sha256" &&
tar -xzf "$archive" &&
./paseo-bun/paseo-bun-desktop
```

The desktop reuses your local daemon, or starts one if absent. Closing the window
leaves the daemon and agents running. The local daemon is identified by its
persisted server ID; other connected hosts remain remote.

## Downloads

All assets below are from **bun-aot-v0.16.0-beta.2-2**, a public beta release.

| Package                               | Archive                                                                                                                                                 | Checksum                                                                                                                                             |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tauri desktop + CLI + daemon + web UI | [Linux x64, 96 MiB](https://github.com/maci0/paseo-bun/releases/download/bun-aot-v0.16.0-beta.2-2/paseo-bun-desktop-0.16.0-beta.2-linux-x64-aot.tar.gz) | [SHA-256](https://github.com/maci0/paseo-bun/releases/download/bun-aot-v0.16.0-beta.2-2/paseo-bun-desktop-0.16.0-beta.2-linux-x64-aot.tar.gz.sha256) |
| Headless CLI + daemon + web UI        | [Linux x64, 95 MiB](https://github.com/maci0/paseo-bun/releases/download/bun-aot-v0.16.0-beta.2-2/paseo-bun-0.16.0-beta.2-linux-x64-aot.tar.gz)         | [SHA-256](https://github.com/maci0/paseo-bun/releases/download/bun-aot-v0.16.0-beta.2-2/paseo-bun-0.16.0-beta.2-linux-x64-aot.tar.gz.sha256)         |

Keep the **entire extracted directory** together: it includes native dependencies,
plugins, notices and web assets. Both packages extract to `paseo-bun/`; unpack
into separate directories if comparing them. Older builds remain on the
[releases page](https://github.com/maci0/paseo-bun/releases).

## Install under ~/.local/bin

After extracting the desktop archive:

```sh
mkdir -p "$HOME/.local/bin" &&
install_dir=$(mktemp -d "$HOME/.local/bin/paseo-bun-desktop.XXXXXX") &&
cp -a paseo-bun/. "$install_dir/" &&
ln -sfn "$install_dir/paseo-bun" "$HOME/.local/bin/paseo-bun" &&
ln -sfn "$install_dir/paseo-bun-desktop" "$HOME/.local/bin/paseo-bun-desktop"
export PATH="$HOME/.local/bin:$PATH"
paseo-bun-desktop
```

See the [desktop guide](docs/bun-desktop.md) for runtime behavior and the
[CLI guide](docs/bun-dist.md) for headless installation, updates and uninstalling.
Your existing Paseo configuration/history lives in `~/.paseo` by default.

## AOT and performance

Bun services use **native AOT with `--production --trim`**. The Rust shell uses
Cargo release optimizations and LTO. React runs in the system WebKit WebView;
dynamic plugins, generated JavaScript and external scripts remain interpreted.
The daemon retains upstream Express handlers and protocol; Elysia hosts the
desktop UI and HTTP/WebSocket proxy.

Our indexed history hydration avoids repeated scans of a growing timeline.
An isolated Chrome benchmark of 10,000 tool events measured **6,708.5 ms → 5.8 ms**.
This is a synthetic hydration measurement, not whole-app or WebKit performance.
[Measurements and validation](docs/bun-desktop.md#included-ui-performance-patch) ·
[Upstream-ready patch](https://github.com/maci0/paseo/tree/perf/large-ui-data).

## Build and compatibility

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run postinstall
bun run build:desktop:bun
bun run test:bun
```

Install the AOT-capable Bun, Rust and Linux development prerequisites described
in the [desktop build guide](docs/bun-desktop.md#build). For the headless target,
use `bun run build:bun`. Archives and SHA-256 files are written to `dist/`;
`build-info.json` and `desktop-info.json` record compiler and source provenance.
[GitHub Actions](https://github.com/maci0/paseo-bun/actions/workflows/bun.yml)
builds and tests both distributions.

This is an experimental prerelease. Electron-specific IPC, embedded Chromium
browser automation and the Electron updater are not included. Voice inference
and authenticated model turns have not been validated. macOS, Windows and ARM
release assets are not provided.

[Upstream Paseo README](README.upstream.md) · [License](LICENSE)
