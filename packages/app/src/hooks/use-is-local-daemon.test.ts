import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("@tanstack/react-query", () => ({ useQuery: () => ({}) }));
vi.mock("@/desktop/daemon/desktop-daemon", () => ({
  shouldUseDesktopDaemon: () => false,
  getDesktopDaemonStatus: vi.fn(),
}));
import {
  readLocalDaemonServerId,
  useLocalDaemonServerIdState,
  useIsLocalDaemon,
} from "./use-is-local-daemon";
const key = "__PASEO_LOCAL_DAEMON_SERVER_ID__";
afterEach(() => {
  Reflect.deleteProperty(globalThis, key);
});
describe("Bun desktop local daemon identity", () => {
  it("keeps ordinary browser hosts remote without a local identity", () => {
    expect(readLocalDaemonServerId()).toBeNull();
    expect(useIsLocalDaemon("srv_remote")).toBe(false);
  });
  it("classifies only the explicitly identified daemon as local", () => {
    Reflect.set(globalThis, key, " srv_local ");
    expect(useIsLocalDaemon("srv_local")).toBe(true);
    expect(useIsLocalDaemon("srv_remote")).toBe(false);
    expect(useLocalDaemonServerIdState()).toEqual({ status: "resolved", serverId: "srv_local" });
  });
  it("rejects empty and malformed identities", () => {
    for (const value of ["", "  ", 42, {}, null]) {
      Reflect.set(globalThis, key, value);
      expect(readLocalDaemonServerId()).toBeNull();
    }
  });
});
