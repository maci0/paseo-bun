# Building Paseo with native Bun AOT

Based on upstream Paseo 0.17.3 (`dd7c0499a8c311fae7b3244722a64d73cc178e4a`).
The distribution follows [dsh-bun](https://github.com/maci0/dsh-bun)'s executable
plus runtime-assets layout and reuses its MIT-licensed node-pty EAGAIN adapter.
This fork now uses **native AOT**, rather than dsh-bun's runtime/JIT build.

## Build

Requirements: Linux, Node 22+, npm, tar, and a Bun build that supports
`bun compile`. Tested compiler: `1.4.6-canary.1+b15f51302`; stable Bun 1.4.5 does
not provide this AOT command. Builds target the current host; Linux x64 is the
validated distribution. `bun upgrade --canary` installs Bun's experimental build.

```sh
git clone https://github.com/maci0/paseo-bun.git
cd paseo-bun
npm ci --ignore-scripts --no-audit --no-fund
npm run postinstall
bun run build:bun
bun test scripts/aot-module-path.test.ts
bun run test:bun
```

The build also exports the optimized production web UI, including the indexed
large-tool-history hydration fix.

The build produces:

```text
dist/
  paseo-bun/
    paseo-bun                  native AOT executable
    README.md                  standalone install/run/update instructions
    LICENSE
    build-info.json            version, target, source and compiler provenance
    packages/                  daemon, workers, plugins, skills and native modules
    node_modules/              traced runtime dependencies and workspace links
    aot-entry.js               worker dispatcher used to compile the executable
  paseo-bun-0.17.3-linux-x64-aot.tar.gz
  paseo-bun-0.17.3-linux-x64-aot.tar.gz.sha256
```

See [distribution instructions](bun-dist.md) for installation and upgrades.
The binary needs the complete distribution directory. Node/npm are build tools;
they are not required to run the packaged daemon and terminals.

## Implementation

`scripts/build-bun.ts` builds upstream JavaScript/assets, traces dependencies,
retains dependency licenses, applies the node-pty adapter, and runs:

```sh
bun compile aot-entry.js --root . --production --trim --aot-allow-code-from-disk --outfile paseo-bun
```

`--trim` removes unused Bun/Node runtime APIs. The archive smoke test checks the
remaining APIs against plugin loading and worker/terminal lifecycle operations.
On the tested compiler it trims about 2.4 MB; Bun conservatively keeps APIs
needed by dynamic imports, generated code and native addons.

The static import graph includes the CLI, supervisor, daemon, terminal worker
and speech worker. The dispatcher selects the requested worker before entering
the CLI. It does not request `BUN_BE_BUN`: native AOT binaries omit Bun's CLI.
Other absolute script paths used by external tools are loaded by the interpreter.

A syntax-aware packaging transform preserves each module's runtime asset path
relative to the installed executable. Disk-loaded worker threads retain their
normal `import.meta.url`. Terminal workers preserve upstream's versioned copies
of their bundle, native dependency and shell integration, including after daemon
restarts. Runtime code strings and comments are not rewritten.

Incremental TypeScript caches live inside `dist/`, and workspace dependency
builds run once, sequentially, reusing improvements explored in turbopaseo.
There are no scriptc FFI adapters or development compilation flags. Native AOT
currently has no compiler cache, so the native stage runs on every build.

The AOT input is upstream's emitted JavaScript. Static application functions
compile to native code, but this does not yet preserve TypeScript annotations
through the AOT stage. Dynamic plugins, external scripts and generated code
remain interpreted. See [Bun's AOT documentation](https://bun.sh/docs/compiler/aot).

## Validation

`bun run test:bun` verifies the archive checksum, extracts that archive outside
the repository, and uses an isolated home and PATH without Node/Bun. It verifies
CLI version/help, absence of Bun CLI mode, external script execution, daemon
startup, all built-in plugins, provider listing, real PTY input/output, terminal
retention across daemon restart and shutdown. Linux `/proc` assertions verify
the supervisor and daemon execute the packaged binary.

The smoke test disables relay, MCP and speech, and inherits no provider
credentials. Voice inference, authenticated agent sessions, desktop/mobile,
non-Linux targets are not validated. The bundled web UI HTML and JavaScript assets
are checked by the archive smoke test. GitHub's Bun workflow
runs these checks and uploads the archive plus checksum as an artifact.
