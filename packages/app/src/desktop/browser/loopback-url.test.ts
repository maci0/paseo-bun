import { describe, expect, it } from "vitest";
import { isLoopbackHttpUrl } from "./loopback-url";

describe("isLoopbackHttpUrl", () => {
  it.each([
    "http://localhost:5173/",
    "https://LOCALHOST",
    "http://app.localhost:3000/x",
    "http://127.0.0.1:8080",
    "http://127.10.0.2",
    "http://[::1]:3000/",
  ])("accepts %s", (url) => {
    expect(isLoopbackHttpUrl(url)).toBe(true);
  });

  it.each([
    "https://example.com",
    "http://localhost.example.com",
    "http://128.0.0.1",
    "http://192.168.1.10:3000",
    "file:///etc/passwd",
    "javascript:alert(1)",
    "ws://localhost:3000",
    "not a url",
    "",
  ])("rejects %s", (url) => {
    expect(isLoopbackHttpUrl(url)).toBe(false);
  });
});
