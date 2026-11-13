import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readlinkSync,
  symlinkSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const temporary = mkdtempSync(path.join(tmpdir(), "paseo-bun-test-"));
const bundle = path.join(temporary, "bundle");
cpSync(path.resolve(import.meta.dir, "../dist/paseo-bun"), bundle, {
  recursive: true,
  verbatimSymlinks: true,
});
const binary = path.join(bundle, "paseo-bun");
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
  const started = JSON.parse(cli(["daemon", "start", "--home", home, "--timeout", "30", "--json"]));
  if (process.platform === "linux") {
    assert.equal(readlinkSync(`/proc/${started.pid}/exe`), binary);
    const children = readFileSync(`/proc/${started.pid}/task/${started.pid}/children`, "utf8")
      .trim()
      .split(/\s+/);
    assert.ok(children.length > 0);
    for (const pid of children) assert.equal(readlinkSync(`/proc/${pid}/exe`), binary);
  }
  assert.deepEqual(JSON.parse(cli(["--host", address, "ls", "--json"])), []);
  cli(["--host", address, "provider", "ls", "--json"]);
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
