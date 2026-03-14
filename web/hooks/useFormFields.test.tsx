import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useFormFields } from "./useFormFields";

describe("useFormFields", () => {
  it("returns initial state", () => {
    const initial = { email: "", password: "" };
    const { result } = renderHook(() => useFormFields(initial));
    expect(result.current[0]).toEqual(initial);
  });

  it("updateField updates single field", () => {
    const { result } = renderHook(() =>
      useFormFields({ email: "", password: "" })
    );
    act(() => {
      result.current[1]("email", "a@b.com");
    });
    expect(result.current[0].email).toBe("a@b.com");
    expect(result.current[0].password).toBe("");
  });

  it("updateField can update multiple fields", () => {
    const { result } = renderHook(() =>
      useFormFields({ email: "", password: "" })
    );
    act(() => {
      result.current[1]("email", "u@test.com");
    });
    act(() => {
      result.current[1]("password", "secret");
    });
    expect(result.current[0]).toEqual({
      email: "u@test.com",
      password: "secret",
    });
  });

  it("reset restores initial state when no arg", () => {
    const initial = { a: "1", b: "2" };
    const { result } = renderHook(() => useFormFields(initial));
    act(() => {
      result.current[1]("a", "changed");
    });
    expect(result.current[0].a).toBe("changed");
    act(() => {
      result.current[2]();
    });
    expect(result.current[0]).toEqual(initial);
  });

  it("reset with partial merges and updates state", () => {
    const initial = { a: "1", b: "2" };
    const { result } = renderHook(() => useFormFields(initial));
    act(() => {
      result.current[1]("a", "x");
    });
    act(() => {
      result.current[2]({ a: "reset-a" });
    });
    expect(result.current[0].a).toBe("reset-a");
    expect(result.current[0].b).toBe("2");
  });
});
