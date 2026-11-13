# paseo-bun native AOT distribution

This Linux package contains the Paseo 0.15.4 CLI, daemon and terminal/speech
worker entry points compiled to native code with Bun. It needs no separate
Node or Bun installation for those processes. Agent tools remain separate
installations. Native dependencies and runtime assets must stay beside the
executable; copy the entire directory.

## Download and verify

Download the matching `*-aot.tar.gz` and `*-aot.tar.gz.sha256` assets from
https://github.com/maci0/paseo-bun/releases. Initial supported target: Linux x64.
Use the same release's archive and checksum, in the same directory:

```sh
sha256sum -c paseo-bun-0.15.4-linux-x64-aot.tar.gz.sha256
tar -xzf paseo-bun-0.15.4-linux-x64-aot.tar.gz
./paseo-bun/paseo-bun --version
```

## Install for your user

From the directory containing the extracted `paseo-bun/` folder:

```sh
mkdir -p "$HOME/.local/lib/paseo-bun" "$HOME/.local/bin"
install_dir=$(mktemp -d "$HOME/.local/lib/paseo-bun/0.15.4-aot.XXXXXX")
cp -a paseo-bun/. "$install_dir/"
ln -sfn "$install_dir/paseo-bun" "$HOME/.local/bin/paseo-bun"
export PATH="$HOME/.local/bin:$PATH"
paseo-bun --help
```

Add `~/.local/bin` to your shell's PATH permanently if it is not there already.
`build-info.json` records the compiler revision, source commit and build mode.
`LICENSE` and dependency notices are included.

## Run and update

Use an explicit, separate home while evaluating the AOT build:

```sh
paseo-bun daemon start --home "$HOME/.paseo-bun"
paseo-bun --home "$HOME/.paseo-bun" ls --json
paseo-bun daemon stop --home "$HOME/.paseo-bun"
```

To update, stop the daemon, verify/extract the new archive, then repeat the
installation commands to create a fresh installation directory and switch the
symlink. Start the daemon with the same home. To preserve terminals during a
restart, add `--keep-terminals` to the stop command. Keep older installation
directories while their processes are still running.

To uninstall, stop the daemon first, remove `~/.local/bin/paseo-bun`, and remove
only the installation directories under `~/.local/lib/paseo-bun/` you no longer
need. Your Paseo home contains configuration and history; keep it unless you
intend to delete that data.

## Scope

The executable is native AOT with no JIT. Dynamic plugins, external agent
scripts, generated JavaScript and code loaded from disk use Bun's interpreter
through `--aot-allow-code-from-disk`; they are not claimed to be native AOT.
The included application entry points and their static dependency graph are
compiled ahead of time. The build currently uses upstream's emitted JavaScript
for that graph, rather than compiling directly from TypeScript source.

Bun AOT is experimental. Linux CLI/daemon, built-in plugin loading, PTY I/O and
terminal retention are covered by the release smoke test. Voice inference,
authenticated agent sessions, desktop/mobile and other operating systems are
not validated. This archive does not include a desktop app or bundled web UI.
