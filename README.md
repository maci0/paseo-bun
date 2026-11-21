# Paseo Bun + Elysia + Tauri v2

Paseo **0.17.0** with native Bun AOT CLI/daemon, an Elysia UI host,
a Rust/Tauri v2 desktop window, and our large-history UI performance patch.
Packaging follows [dsh-bun](https://github.com/evinelias/dsh-bun).

[Current release](https://github.com/maci0/paseo-bun/releases/tag/bun-aot-v0.17.0) ·
[Desktop instructions](docs/bun-desktop.md) · [CLI instructions](docs/bun-dist.md) ·
[Build from source](docs/bun.md)

## TL;DR — download and start the desktop

Choose your platform in the [downloads table](#downloads).

### Linux x64

Linux x64 only. Requires **glibc 2.39+, GTK 3 and WebKitGTK 4.1**
(for example Ubuntu 24.04 with those runtime libraries installed).
No separate Node, Bun or Electron installation is needed.

```sh
release_url=https://github.com/maci0/paseo-bun/releases/download/bun-aot-v0.17.0
archive=paseo-bun-desktop-0.17.0-linux-x64-aot.tar.gz
curl -fLO "$release_url/$archive" &&
curl -fLO "$release_url/$archive.sha256" &&
sha256sum -c "$archive.sha256" &&
tar -xzf "$archive" &&
./paseo-bun/paseo-bun-desktop
```

### macOS

Download the `darwin-arm64` archive for Apple Silicon or `darwin-x64` for Intel,
plus its matching checksum. Verify and extract, then open `paseo-bun/Paseo Bun.app`.
For example, on Apple Silicon (use `darwin-x64` for Intel):

```sh
release_url=https://github.com/maci0/paseo-bun/releases/download/bun-aot-v0.17.0
archive=paseo-bun-desktop-0.17.0-darwin-arm64-aot.tar.gz
curl -fLO "$release_url/$archive" &&
curl -fLO "$release_url/$archive.sha256" &&
shasum -a 256 -c "$archive.sha256" &&
tar -xzf "$archive" &&
open "paseo-bun/Paseo Bun.app"
```

Move the entire `.app` to Applications to install it. Builds are ad-hoc signed,
without Apple notarization; Gatekeeper may require approval in System Settings.

### Windows x64

Download the `win32-x64` archive and its checksum. Compare the SHA-256 using
`Get-FileHash -Algorithm SHA256 <archive>`, then extract the entire directory:

```powershell
tar -xzf paseo-bun-desktop-0.17.0-win32-x64-aot.tar.gz
.\paseo-bun\paseo-bun-desktop.exe
```

Requires Microsoft WebView2 Runtime. Builds are not Authenticode signed, so
Windows may display a publisher warning. Keep all DLLs and other assets beside
the executables. No Node or Bun installation is required.

The desktop reuses your local daemon, or starts one if absent. Closing the window
leaves the daemon and agents running. The local daemon is identified by its
persisted server ID; other connected hosts remain remote.

## Downloads

All assets below are from **bun-aot-v0.17.0**.

| Platform            | Desktop                                                                                                                          | Checksum                                                                                                                                | CLI / web                                                                                                                | Checksum                                                                                                                        |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| Linux x64           | [Archive](https://github.com/maci0/paseo-bun/releases/download/bun-aot-v0.17.0/paseo-bun-desktop-0.17.0-linux-x64-aot.tar.gz)    | [SHA-256](https://github.com/maci0/paseo-bun/releases/download/bun-aot-v0.17.0/paseo-bun-desktop-0.17.0-linux-x64-aot.tar.gz.sha256)    | [Archive](https://github.com/maci0/paseo-bun/releases/download/bun-aot-v0.17.0/paseo-bun-0.17.0-linux-x64-aot.tar.gz)    | [SHA-256](https://github.com/maci0/paseo-bun/releases/download/bun-aot-v0.17.0/paseo-bun-0.17.0-linux-x64-aot.tar.gz.sha256)    |
| macOS Apple Silicon | [Archive](https://github.com/maci0/paseo-bun/releases/download/bun-aot-v0.17.0/paseo-bun-desktop-0.17.0-darwin-arm64-aot.tar.gz) | [SHA-256](https://github.com/maci0/paseo-bun/releases/download/bun-aot-v0.17.0/paseo-bun-desktop-0.17.0-darwin-arm64-aot.tar.gz.sha256) | [Archive](https://github.com/maci0/paseo-bun/releases/download/bun-aot-v0.17.0/paseo-bun-0.17.0-darwin-arm64-aot.tar.gz) | [SHA-256](https://github.com/maci0/paseo-bun/releases/download/bun-aot-v0.17.0/paseo-bun-0.17.0-darwin-arm64-aot.tar.gz.sha256) |
| macOS Intel         | [Archive](https://github.com/maci0/paseo-bun/releases/download/bun-aot-v0.17.0/paseo-bun-desktop-0.17.0-darwin-x64-aot.tar.gz)   | [SHA-256](https://github.com/maci0/paseo-bun/releases/download/bun-aot-v0.17.0/paseo-bun-desktop-0.17.0-darwin-x64-aot.tar.gz.sha256)   | [Archive](https://github.com/maci0/paseo-bun/releases/download/bun-aot-v0.17.0/paseo-bun-0.17.0-darwin-x64-aot.tar.gz)   | [SHA-256](https://github.com/maci0/paseo-bun/releases/download/bun-aot-v0.17.0/paseo-bun-0.17.0-darwin-x64-aot.tar.gz.sha256)   |
| Windows x64         | [Archive](https://github.com/maci0/paseo-bun/releases/download/bun-aot-v0.17.0/paseo-bun-desktop-0.17.0-win32-x64-aot.tar.gz)    | [SHA-256](https://github.com/maci0/paseo-bun/releases/download/bun-aot-v0.17.0/paseo-bun-desktop-0.17.0-win32-x64-aot.tar.gz.sha256)    | [Archive](https://github.com/maci0/paseo-bun/releases/download/bun-aot-v0.17.0/paseo-bun-0.17.0-win32-x64-aot.tar.gz)    | [SHA-256](https://github.com/maci0/paseo-bun/releases/download/bun-aot-v0.17.0/paseo-bun-0.17.0-win32-x64-aot.tar.gz.sha256)    |

Keep the **entire extracted directory** together: it includes native dependencies,
plugins, notices and web assets. Both package types extract to `paseo-bun/`; unpack
into separate directories if comparing them. Older builds remain on the
[releases page](https://github.com/maci0/paseo-bun/releases).

## Install under ~/.local/bin (Linux)

After extracting the desktop archive:

```sh
mkdir -p "$HOME/.local/bin" &&
install_dir=$(mktemp -d "$HOME/.local/bin/paseo-bun-desktop.XXXXXX") &&
cp -a paseo-bun/. "$install_dir/" &&
ln -sfn "$install_dir/paseo-bun" "$HOME/.local/bin/paseo-bun" &&
ln -sfn "$install_dir/paseo-bun-desktop" "$HOME/.local/bin/paseo-bun-desktop"
"$install_dir/install-desktop.sh"
export PATH="$HOME/.local/bin:$PATH"
paseo-bun-desktop
```

See the [desktop guide](docs/bun-desktop.md) for runtime behavior and the
[CLI guide](docs/bun-dist.md) for headless installation, updates and uninstalling.
Your existing Paseo configuration/history lives in `~/.paseo` by default.

## Arch Linux / CachyOS

Use the root [PKGBUILD](PKGBUILD) to build from source, or
[packaging/arch/paseo-bun-bin/PKGBUILD](packaging/arch/paseo-bun-bin/PKGBUILD)
to package the verified release binaries. [Installation instructions](docs/archlinux.md).

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
and authenticated model turns have not been validated. macOS and Windows builds are not notarized or publisher-signed.
Interactive desktop workflows on those systems still need manual validation.

[Upstream Paseo README](README.upstream.md) · [License](LICENSE)
