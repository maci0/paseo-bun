import { test, expect } from "bun:test";
import { rebaseModuleUrl } from "./aot-module-path";

test("rebases URL syntax while retaining literal plugin code and disk-worker fallback", () => {
  const result = rebaseModuleUrl(
    'const code = "import.meta.url"; /* import.meta.url */ export default import.meta.url;',
    "module.js",
  );
  expect(result).toContain('const code = "import.meta.url"; /* import.meta.url */');
  expect(result).toContain('globalThis.paseoModuleUrl("module.js") : import.meta.url');
});
