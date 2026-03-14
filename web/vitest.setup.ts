import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

// MantineProvider and other libs need matchMedia (missing in jsdom)
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Polyfill atob/btoa for JWT tests in Node (jsdom may not provide them)
if (typeof globalThis.atob === "undefined") {
  globalThis.atob = (str: string) =>
    Buffer.from(str, "base64").toString("binary");
}
if (typeof globalThis.btoa === "undefined") {
  globalThis.btoa = (str: string) =>
    Buffer.from(str, "binary").toString("base64");
}

afterEach(() => {
  cleanup();
});
