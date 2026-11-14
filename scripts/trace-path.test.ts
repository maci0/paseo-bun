import { expect, test } from "bun:test";
import { isExternalTracePath } from "./trace-path.mjs";
test("runtime traces stay inside the checkout across Windows drives", () => {
  for (const file of [
    "C:\\Users\\runneradmin\\Documents",
    "/home/user/Documents",
    "../secret",
    "..\\secret",
    "..",
  ])
    expect(isExternalTracePath(file)).toBe(true);
  for (const file of ["node_modules/pkg/index.js", "packages\\server\\dist\\index.js"])
    expect(isExternalTracePath(file)).toBe(false);
});
