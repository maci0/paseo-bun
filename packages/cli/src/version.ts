import packageJson from "../package.json" with { type: "json" };

export function resolveCliVersion(): string {
  if (typeof packageJson.version === "string" && packageJson.version.trim().length > 0) {
    return packageJson.version.trim();
  }
  throw new Error("Unable to resolve @getpaseo/cli version from package.json.");
}
