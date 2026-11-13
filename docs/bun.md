# Paseo on Bun

This fork builds upstream Paseo 0.15.4 (`1c00b365c9e0b74c1580eba33d905d693125ae21`)
using the executable-plus-runtime-directory approach from
[maci0/dsh-bun](https://github.com/maci0/dsh-bun).

## Build and run

Build requirements: Linux, Node 22+, npm, and Bun. Tested with Bun
`1.4.5-canary.1+d0f4fdd65`. Native dependencies target the build host.

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run postinstall
bun run build:bun
bun run test:bun
./dist/paseo-bun/paseo-bun --help
```

Copy **all of `dist/paseo-bun/`** to the destination. The executable needs its
sibling `packages/` and `node_modules/` directories. It does not require a Node
or Bun installation to start the daemon or run terminals. Agent executables
and their own runtimes are still separate requirements.

```sh
./dist/paseo-bun/paseo-bun daemon start --home /path/to/paseo-home
./dist/paseo-bun/paseo-bun daemon stop --home /path/to/paseo-home
```

Use a separate home while evaluating this fork. The package uses upstream's
configuration, authentication, permissions and daemon lifecycle behavior.

## Packaging

- `scripts/build-bun.ts` runs the upstream TypeScript and asset builds, traces
  runtime dependencies with the existing `scripts/trace-daemon.mjs`, then uses
  `bun build --compile --production` for the CLI executable.
- Like dsh-bun, native modules remain beside the executable. Its node-pty
  read-stream adapter is reused with the original MIT notice: idle PTYs must
  retry `EAGAIN` instead of closing their master descriptor under Bun.
- The daemon, speech workers, plugin code, skills, shell integration and native
  libraries retain upstream's on-disk paths. Child processes use the Bun CLI
  embedded in the executable through `BUN_BE_BUN=1`; external commands have
  that control variable removed. Supervisor IPC and terminal retention keep
  using upstream's implementations.
- Terminal workers still copy their bundle and node-pty into a versioned home
  directory so surviving terminals retain the files they started with.
- Incremental TypeScript caches live inside `dist/`, and dependency builds run
  once, sequentially. These reuse the build improvements explored in turbopaseo.
  No scriptc FFI adapters or development compilation flags are used.

This is Bun's bundled runtime/JIT executable, as used by dsh-bun. It is **not
native AOT**. The separate stock-upstream AOT experiment compiled the CLI but
could not launch workers correctly: the compiled program re-entered its main
entry instead of running the requested script, and its executable did not
include `BUN_BE_BUN` runtime mode.

## Validation and scope

`bun run test:bun` copies the distribution to a temporary directory, uses a
fresh home and a PATH without Node/Bun, disables relay/MCP/speech, and checks:
CLI version/help, supervisor and daemon startup, provider listing, real PTY
creation/input/capture, terminal retention across daemon restart, and shutdown.
On Linux it also checks `/proc` to confirm the supervisor and daemon execute
the packaged binary. It does not use the developer's provider credentials.

The initial target is the CLI/daemon on Linux. Desktop/mobile packaging, a
bundled web UI, authenticated agent runs, voice inference and other operating
systems are not validated by this smoke test. Upstream application sources
remain in the repository for future work.

## Local results

Linux x64, Bun `1.4.5-canary.1+d0f4fdd65`, Node `26.13.1`:

- Full build with newly enabled incremental caches: 150.92 seconds, 2.06 GiB
  peak child-process RSS.
- Subsequent full build/trace/package after small source edits: 73.84 seconds,
  1.06 GiB peak child-process RSS. This is not aggregate process-tree memory.
- Bun's final minify/bundle/compile stage: approximately 0.34 seconds.
- Distribution: approximately 245 MiB; executable approximately 156 MiB.
- Relocated lifecycle/PTY smoke test passed; environment-contract unit tests:
  7 passed. No authenticated provider or speech inference was exercised.
