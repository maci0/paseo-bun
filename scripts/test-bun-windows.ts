import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";

assert.equal(process.platform, "win32");
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
const temporary = mkdtempSync(path.join(tmpdir(), "paseo-aot-"));
assert.equal(spawnSync("tar", ["-xzf", archive, "-C", temporary]).status, 0);
const binary = path.join(temporary, "paseo-bun/paseo-bun.exe");
const home = path.join(temporary, "home");
const { mkdirSync } = await import("node:fs");
mkdirSync(home);
const listener = Bun.listen({ hostname: "127.0.0.1", port: 0, socket: { data() {} } });
const address = `127.0.0.1:${listener.port}`;
listener.stop(true);
writeFileSync(
  path.join(home, "config.json"),
  JSON.stringify({
    version: 1,
    daemon: { listen: address, relay: { enabled: false }, mcp: { enabled: false } },
    features: {
      webUi: { enabled: true },
      dictation: { enabled: false },
      voiceMode: { enabled: false },
    },
  }),
);
const env = {
  ...process.env,
  HOME: temporary,
  USERPROFILE: temporary,
  PASEO_HOME: home,
  PATH: path.join(process.env.SystemRoot!, "System32"),
  NODE_ENV: "production",
};
function cli(args: string[], allowFailure = false) {
  const result = spawnSync(binary, args, { env, cwd: temporary, encoding: "utf8", timeout: 45000 });
  if (!allowFailure)
    assert.equal(
      result.status,
      0,
      `${args.join(" ")}: ${result.stderr}\n${result.stdout}\n${result.error ?? ""}`,
    );
  return result.stdout.trim();
}
try {
  assert.equal(cli(["--version"]), info.version);
  cli(["daemon", "start", "--home", home, "--timeout", "30"]);
  assert.deepEqual(JSON.parse(cli(["--host", address, "ls", "--json"])), []);
  cli(["--host", address, "provider", "ls", "--json"]);
  assert.equal((await fetch(`http://${address}/`)).status, 200);
  const terminal = JSON.parse(
    cli(["--host", address, "terminal", "create", "--cwd", temporary, "--json"]),
  );
  cli([
    "--host",
    address,
    "terminal",
    "send-keys",
    terminal.id,
    "echo paseo-aot-terminal-ok",
    "Enter",
  ]);
  let output = "";
  for (let i = 0; i < 30; i++) {
    output = cli(["--host", address, "terminal", "capture", terminal.id]);
    if (output.includes("paseo-aot-terminal-ok")) break;
    await Bun.sleep(100);
  }
  assert.match(output, /paseo-aot-terminal-ok/);
  cli(["--host", address, "terminal", "kill", terminal.id]);
  console.log("PASS Windows relocated native AOT CLI, daemon, providers, web assets and ConPTY");
} finally {
  cli(["daemon", "stop", "--home", home, "--force", "--timeout", "10"], true);
  rmSync(temporary, { recursive: true, force: true });
}
