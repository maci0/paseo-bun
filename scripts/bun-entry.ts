// Child processes use the runtime embedded in the executable, including fork/IPC.
process.env.BUN_BE_BUN = "1";
await import("../packages/cli/src/index.ts");
