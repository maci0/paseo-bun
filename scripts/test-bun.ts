import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readlinkSync,
  realpathSync,
  symlinkSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { builtinPlugins } from "../packages/server/src/server/plugins/builtin/index";

const temporary = mkdtempSync(path.join(tmpdir(), "paseo-bun-test-"));
const dist = path.resolve(import.meta.dir, "../dist");
const info = JSON.parse(readFileSync(path.join(dist, "paseo-bun/build-info.json"), "utf8"));
assert.equal(info.mode, "native-aot");
assert.equal(info.trim, true);
const archive = path.join(dist, info.archive);
assert.equal(
  createHash("sha256").update(readFileSync(archive)).digest("hex"),
  readFileSync(archive + ".sha256", "utf8")
    .trim()
    .split(/\s+/)[0],
);
const extracted = spawnSync("tar", ["-xzf", archive, "-C", temporary], { encoding: "utf8" });
assert.equal(extracted.status, 0, extracted.stderr);
const bundle = path.join(temporary, "paseo-bun");
const binary = path.join(temporary, "bin/paseo-bun");
const home = path.join(temporary, "home");
mkdirSync(home);
const socket = Bun.listen({ hostname: "127.0.0.1", port: 0, socket: { data() {} } });
const address = `127.0.0.1:${socket.port}`;
socket.stop(true);
writeFileSync(
  path.join(home, "config.json"),
  JSON.stringify({
    version: 1,
    daemon: { listen: address, relay: { enabled: false }, mcp: { enabled: false } },
    features: { dictation: { enabled: false }, voiceMode: { enabled: false } },
  }),
);
const systemBin = path.join(temporary, "bin");
mkdirSync(systemBin);
symlinkSync(path.join(bundle, "paseo-bun"), binary);
for (const command of ["git", "bash", "sh", "env", "ps", "kill", "uname", "which"]) {
  symlinkSync(`/usr/bin/${command}`, path.join(systemBin, command));
}
// No credentials, user configuration, Node or Bun installation are inherited.
const env = {
  HOME: temporary,
  PASEO_HOME: home,
  PATH: systemBin,
  SHELL: "/bin/bash",
  NODE_ENV: "production",
  TERM: "xterm-256color",
};
function cli(args: string[], allowFailure = false): string {
  const result = spawnSync(binary, args, {
    cwd: temporary,
    env,
    encoding: "utf8",
    timeout: 45_000,
  });
  if (!allowFailure)
    assert.equal(
      result.status,
      0,
      `${args.join(" ")}: ${result.stderr}\n${result.stdout}\n${result.error ?? ""}`,
    );
  return result.stdout.trim();
}
try {
  assert.match(cli(["--version"]), /0\.15\.4/);
  assert.match(cli(["--help"]), /daemon/);
  const jitProbe = spawnSync(binary, ["-e", "process.exit(0)"], {
    env: { ...env, BUN_BE_BUN: "1" },
    encoding: "utf8",
  });
  assert.notEqual(jitProbe.status, 0);
  assert.match(jitProbe.stderr, /doesn't include the Bun command line/);
  const diskScript = path.join(temporary, "external-worker.js");
  writeFileSync(diskScript, 'console.log("disk-worker-ok", process.argv[2]);');
  assert.equal(cli([diskScript, "arg-ok"]), "disk-worker-ok arg-ok");
  const started = JSON.parse(cli(["daemon", "start", "--home", home, "--timeout", "30", "--json"]));
  if (process.platform === "linux") {
    assert.equal(readlinkSync(`/proc/${started.pid}/exe`), realpathSync(binary));
    const children = readFileSync(`/proc/${started.pid}/task/${started.pid}/children`, "utf8")
      .trim()
      .split(/\s+/);
    assert.ok(children.length > 0);
    for (const pid of children)
      assert.equal(readlinkSync(`/proc/${pid}/exe`), realpathSync(binary));
  }
  assert.deepEqual(JSON.parse(cli(["--host", address, "ls", "--json"])), []);
  cli(["--host", address, "provider", "ls", "--json"]);
  const logLines = readFileSync(path.join(home, "daemon.log"), "utf8").split("\n");
  for (const plugin of builtinPlugins) {
    assert.ok(
      logLines.some(
        (line) => line.includes(`"pluginId":"${plugin}"`) && line.includes('"msg":"Loaded plugin"'),
      ),
      `Built-in plugin failed: ${plugin}`,
    );
  }
  const terminal = JSON.parse(
    cli([
      "--host",
      address,
      "terminal",
      "create",
      "--cwd",
      temporary,
      "--name",
      "bun-smoke",
      "--json",
    ]),
  );
  assert.ok(terminal.id, JSON.stringify(terminal));
  cli([
    "--host",
    address,
    "terminal",
    "send-keys",
    terminal.id,
    "printf 'bun-%s-ok\\n' terminal",
    "Enter",
  ]);
  let output = "";
  for (let i = 0; i < 30; i++) {
    output = cli(["--host", address, "terminal", "capture", terminal.id]);
    if (output.includes("bun-terminal-ok")) break;
    await Bun.sleep(100);
  }
  assert.match(output, /bun-terminal-ok/);
  cli(["daemon", "stop", "--home", home, "--keep-terminals", "--timeout", "10"]);
  cli(["daemon", "start", "--home", home, "--timeout", "30"]);
  assert.match(cli(["--host", address, "terminal", "capture", terminal.id]), /bun-terminal-ok/);
  cli(["--host", address, "terminal", "kill", terminal.id]);
  cli(["daemon", "stop", "--home", home, "--timeout", "10"]);
  console.log(
    "PASS: relocated CLI, daemon/fork, provider listing, native PTY create/input/capture/kill retention across daemon restart, and shutdown",
  );
} catch (error) {
  console.error(`Test files: ${temporary}`);
  for (const name of ["daemon.log", "logs/daemon.log"]) {
    try {
      console.error(readFileSync(path.join(home, name), "utf8").slice(-12000));
    } catch {}
  }
  throw error;
} finally {
  cli(["daemon", "stop", "--home", home, "--force", "--timeout", "2"], true);
}
rmSync(temporary, { recursive: true, force: true });
