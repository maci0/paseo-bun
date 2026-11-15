import { test, expect } from "bun:test";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

test.skipIf(process.platform !== "linux")(
  "registers a matching Wayland launcher and icon outside the install directory",
  () => {
    const root = mkdtempSync(path.join(tmpdir(), "paseo-icon-"));
    try {
      const bundle = path.join(root, 'bundle space % $ "');
      const desktop = path.join(bundle, "share/applications");
      const icons = path.join(bundle, "share/icons/hicolor/256x256/apps");
      const commands = path.join(root, "commands");
      mkdirSync(desktop, { recursive: true });
      mkdirSync(icons, { recursive: true });
      mkdirSync(commands);
      cpSync(
        "packages/desktop-bun/linux/sh.paseo.bun.desktop",
        path.join(desktop, "sh.paseo.bun.desktop"),
      );
      cpSync("packages/desktop/assets/128x128@2x.png", path.join(icons, "sh.paseo.bun.png"));
      cpSync(
        "packages/desktop-bun/linux/install-desktop.sh",
        path.join(bundle, "install-desktop.sh"),
      );
      for (const command of ["dirname", "mkdir", "cp", "sed"])
        symlinkSync(`/usr/bin/${command}`, path.join(commands, command));
      const data = path.join(root, "data");
      const result = spawnSync("/bin/sh", [path.join(bundle, "install-desktop.sh")], {
        env: { HOME: root, XDG_DATA_HOME: data, PATH: commands },
        encoding: "utf8",
      });
      expect(result.status, result.stderr).toBe(0);
      const entry = readFileSync(path.join(data, "applications/sh.paseo.bun.desktop"), "utf8");
      expect(entry).toContain("Icon=sh.paseo.bun");
      expect(entry).toContain("StartupWMClass=sh.paseo.bun");
      expect(entry).toContain("%%");
      expect(entry).toContain('Exec="');
      expect(readFileSync(path.join(data, "icons/hicolor/256x256/apps/sh.paseo.bun.png"))).toEqual(
        readFileSync(path.join(icons, "sh.paseo.bun.png")),
      );
      const config = JSON.parse(
        readFileSync("packages/desktop-bun/src-tauri/tauri.conf.json", "utf8"),
      );
      expect(config.app.enableGtkAppId).toBe(true);
      expect(config.identifier).toBe("sh.paseo.bun");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  },
);
