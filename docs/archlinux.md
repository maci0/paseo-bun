# Arch Linux / CachyOS

The repository includes two recipes for Linux x86_64. Neither recipe installs,
stops or replaces your user daemon automatically.

## Install the verified release binaries

```sh
git clone https://github.com/maci0/paseo-bun.git
cd paseo-bun/packaging/arch/paseo-bun-bin
makepkg -si
paseo-bun-desktop
```

This recipe verifies the pinned SHA-256 of the native AOT desktop archive. No
Bun, Node or Rust installation is needed at runtime. GTK 3 and WebKitGTK 4.1
are package dependencies. The Wayland launcher and icon are installed system-wide
with the matching `sh.paseo.bun` application ID.

## Build from source

The root `PKGBUILD` builds a pinned source commit with native Bun AOT and
`--trim`, then runs the relocated daemon/PTY smoke test:

```sh
git clone https://github.com/maci0/paseo-bun.git
cd paseo-bun
makepkg -si
```

Install `base-devel` before using makepkg. Build dependencies include Node 24+,
npm, Rust and an AOT-capable Bun compiler. Arch's stable Bun 1.4.4 does not
support `bun compile`; put a compatible compiler first in PATH as explained in
[the build guide](bun.md). The recipe checks this before downloading npm packages.
The build uses pinned Git sources; npm/Cargo dependencies are fetched during the
build, so this is not an offline/reproducible-build claim.

The recipes conflict with each other, but can coexist with upstream Paseo.
Commands go in `/usr/bin`, with the complete runtime in `/usr/lib/paseo-bun`.
This follows system package layout; personal tarball installs can stay under
`~/.local/bin`. Existing `~/.local/bin` commands may take precedence in PATH.
User configuration/history in `~/.paseo` is preserved. No systemd unit is enabled
or overridden by these packages.
