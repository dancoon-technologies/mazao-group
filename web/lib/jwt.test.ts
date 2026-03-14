import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { decodePayload, getStoredUser } from "./jwt";

/** Build a minimal JWT (header.payload.signature). Use Buffer so tests run in Node without btoa. */
function makeJWT(payload: object): string {
  const b64 = (s: string) =>
    Buffer.from(s)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  const header = b64(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payloadB64 = b64(JSON.stringify(payload));
  return `${header}.${payloadB64}.sig`;
}

describe("decodePayload", () => {
  it("decodes valid JWT and returns payload", () => {
    const payload = { email: "a@b.com", role: "admin", exp: 999999 };
    const token = makeJWT(payload);
    expect(decodePayload(token)).toEqual(payload);
  });

  it("returns null for missing segment", () => {
    expect(decodePayload("only-one-part")).toBeNull();
    expect(decodePayload("")).toBeNull();
  });

  it("returns null for invalid base64", () => {
    expect(decodePayload("a.!!!.c")).toBeNull();
  });

  it("returns null for invalid JSON in payload", () => {
    const badB64 = Buffer.from("not json")
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");
    expect(decodePayload(`a.${badB64}.c`)).toBeNull();
  });
});

describe("getStoredUser", () => {
  const originalLocalStorage = global.localStorage;

  beforeEach(() => {
    const store: Record<string, string> = {};
    vi.stubGlobal(
      "localStorage",
      {
        getItem: (key: string) => store[key] ?? null,
        setItem: (key: string, value: string) => {
          store[key] = value;
        },
        clear: () => {
          for (const k of Object.keys(store)) delete store[k];
        },
        length: 0,
        removeItem: () => {},
        key: () => null,
      }
    );
  });

  afterEach(() => {
    vi.stubGlobal("localStorage", originalLocalStorage);
  });

  it("returns null when no access token", () => {
    expect(getStoredUser()).toBeNull();
  });

  it("returns user when valid access token in localStorage", () => {
    const payload = { email: "user@test.com", role: "officer" };
    const token = makeJWT(payload);
    global.localStorage.setItem("access", token);
    expect(getStoredUser()).toEqual({ email: "user@test.com", role: "officer" });
  });

  it("returns null when payload missing email or role", () => {
    global.localStorage.setItem("access", makeJWT({ email: "a@b.com" }));
    expect(getStoredUser()).toBeNull();
    global.localStorage.setItem("access", makeJWT({ role: "admin" }));
    expect(getStoredUser()).toBeNull();
  });
});
