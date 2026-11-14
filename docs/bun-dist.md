# paseo-bun native AOT distribution

This Linux package contains the Paseo 0.16.0-beta.2 CLI, daemon and terminal/speech
worker entry points compiled to native code with Bun. It needs no separate
Node or Bun installation for those processes. Agent tools remain separate
installations. Native dependencies and runtime assets must stay beside the
executable; copy the entire directory.

## Download and verify

For Linux x64, download the archive and checksum from the same prerelease.
Run these commands in the directory where you want to unpack the package:

```sh
release_url=https://github.com/maci0/paseo-bun/releases/download/bun-aot-v0.16.0-beta.2-2
archive=paseo-bun-0.16.0-beta.2-linux-x64-aot.tar.gz
curl -fLO "$release_url/$archive" &&
curl -fLO "$release_url/$archive.sha256" &&
sha256sum -c "$archive.sha256" &&
tar -xzf "$archive" &&
./paseo-bun/paseo-bun --version
```

`curl -fL` fails on HTTP errors and follows GitHub's download redirects. The
`&&` chain stops if a download or checksum verification fails. For another
release, use its matching tag, archive and checksum from the
[releases page](https://github.com/maci0/paseo-bun/releases).

## Install for your user

From the directory containing the extracted `paseo-bun/` folder:

```sh
mkdir -p "$HOME/.local/bin"
install_dir=$(mktemp -d "$HOME/.local/bin/paseo-bun-0.16.0-beta.2-aot.XXXXXX")
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
only the installation directories matching `~/.local/bin/paseo-bun-*-aot.*` you no longer
need. Your Paseo home contains configuration and history; keep it unless you
intend to delete that data.

## Scope

The executable is native AOT with `--trim` enabled and no JIT. Dynamic plugins, external agent
scripts, generated JavaScript and code loaded from disk use Bun's interpreter
through `--aot-allow-code-from-disk`; they are not claimed to be native AOT.
The included application entry points and their static dependency graph are
compiled ahead of time. The build currently uses upstream's emitted JavaScript
for that graph, rather than compiling directly from TypeScript source.

Bun AOT is experimental. Linux CLI/daemon, built-in plugin loading, PTY I/O and
terminal retention are covered by the release smoke test. Voice inference,
authenticated agent sessions, mobile and other operating systems are
not validated. This archive includes the production web UI. Enable it with
`paseo-bun daemon config set features.webUi.enabled true --home "$HOME/.paseo-bun"`,
then restart that daemon and open its HTTP address. A separate Electron desktop
installer is not included.
