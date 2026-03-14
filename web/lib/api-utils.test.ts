import { describe, it, expect } from "vitest";
import { parseApiError } from "./api-utils";

describe("parseApiError", () => {
  it("returns detail when present", () => {
    expect(parseApiError({ detail: "Invalid token" }, "Fallback")).toBe(
      "Invalid token"
    );
  });

  it("returns first field error when fieldKeys provided", () => {
    expect(
      parseApiError(
        { email: ["This field is required."], password: ["Too short."] },
        "Fallback",
        ["email", "password"]
      )
    ).toBe("This field is required.");
  });

  it("uses first matching field from fieldKeys", () => {
    expect(
      parseApiError(
        { password: ["Too short."], email: ["Invalid email."] },
        "Fallback",
        ["email", "password"]
      )
    ).toBe("Invalid email.");
  });

  it("returns fallback when body is empty object", () => {
    expect(parseApiError({}, "Something went wrong")).toBe(
      "Something went wrong"
    );
  });

  it("returns fallback when body is null or non-object", () => {
    expect(parseApiError(null, "Error")).toBe("Error");
    expect(parseApiError("string", "Error")).toBe("Error");
  });

  it("ignores non-array field values", () => {
    expect(
      parseApiError(
        { email: "not an array" as unknown as string[] },
        "Fallback",
        ["email"]
      )
    ).toBe("Fallback");
  });

  it("ignores empty array in field", () => {
    expect(
      parseApiError({ email: [] }, "Fallback", ["email"])
    ).toBe("Fallback");
  });
});
