import { execFileSync } from "node:child_process";
import {
  cpSync,
  readdirSync,
  readFileSync,
  writeFileSync,
  lstatSync,
  mkdirSync,
  readlinkSync,
  rmSync,
  symlinkSync,
} from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dir, "..");
const output = path.join(root, "dist/paseo-bun");
function run(command: string, args: string[]) {
  execFileSync(command, args, { cwd: root, stdio: "inherit" });
}

run("npm", ["run", "build:server"]);
const files = execFileSync("node", ["scripts/trace-daemon.mjs"], {
  cwd: root,
  encoding: "utf8",
  maxBuffer: 32 * 1024 * 1024,
})
  .trim()
  .split("\n");
rmSync(output, { recursive: true, force: true });
mkdirSync(output, { recursive: true });
for (const file of files) {
  if (!(file.startsWith("node_modules/") || file.startsWith("packages/"))) continue;
  const source = path.resolve(root, file);
  const destination = path.resolve(output, file);
  if (!source.startsWith(root + path.sep) || !destination.startsWith(output + path.sep)) {
    throw new Error(`Runtime trace escaped package root: ${file}`);
  }
  mkdirSync(path.dirname(destination), { recursive: true });
  const stat = lstatSync(source);
  if (stat.isSymbolicLink()) {
    const target = path.resolve(path.dirname(source), readlinkSync(source));
    if (!target.startsWith(root + path.sep))
      throw new Error(`Runtime link escaped checkout: ${file}`);
    symlinkSync(path.relative(path.dirname(source), target), destination);
  } else if (stat.isDirectory()) mkdirSync(destination, { recursive: true });
  else cpSync(source, destination);
  if (path.basename(file) === "package.json") {
    for (const name of readdirSync(path.dirname(source))) {
      if (
        /^(licen[cs]e|notice)([.-]|$)/i.test(name) &&
        lstatSync(path.join(path.dirname(source), name)).isFile()
      ) {
        cpSync(path.join(path.dirname(source), name), path.join(path.dirname(destination), name));
      }
    }
  }
}
cpSync(path.join(root, "LICENSE"), path.join(output, "LICENSE"));
// The retained terminal worker is loaded by path, outside the module graph.
cpSync(
  path.join(root, "packages/server/dist/server/terminal-worker"),
  path.join(output, "packages/server/dist/server/terminal-worker"),
  { recursive: true },
);
// dsh-bun's PTY adapter retries EAGAIN instead of closing an idle terminal.
const ptyLibrary = path.join(output, "packages/server/node_modules/node-pty/lib");
const unixTerminal = path.join(ptyLibrary, "unixTerminal.js");
const source = readFileSync(unixTerminal, "utf8");
if (!source.includes("new tty.ReadStream(term.fd)"))
  throw new Error("node-pty stream construction changed");
writeFileSync(
  unixTerminal,
  source.replace(
    /new tty\.ReadStream\((term\.(?:fd|master|slave))\)/g,
    'process.versions.bun ? require("./bunReadStream").createReadStream($1) : new tty.ReadStream($1)',
  ),
);
cpSync(
  path.join(root, "scripts/node-pty-bun-readstream.cjs"),
  path.join(ptyLibrary, "bunReadStream.js"),
);
run(process.execPath, [
  "build",
  "scripts/bun-entry.ts",
  "--compile",
  "--production",
  "--outfile",
  path.join(output, "paseo-bun"),
]);
console.log(`Built ${output}/paseo-bun; distribute the entire directory.`);
