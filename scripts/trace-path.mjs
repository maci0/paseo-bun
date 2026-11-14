import path from "node:path";

// On Windows, a path on another drive is absolute rather than ../ relative.
export function isExternalTracePath(file) {
  return path.isAbsolute(file) || path.win32.isAbsolute(file) || /^(\.\.(?:[\\/]|$))/.test(file);
}
