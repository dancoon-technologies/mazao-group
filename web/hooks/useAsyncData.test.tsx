import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useAsyncData } from "./useAsyncData";

describe("useAsyncData", () => {
  it("starts with loading true and data null", () => {
    const fetchFn = vi.fn().mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useAsyncData(fetchFn, []));
    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBe("");
  });

  it("sets data and loading false when fetch resolves", async () => {
    const data = { id: "1" };
    const fetchFn = vi.fn().mockResolvedValue(data);
    const { result } = renderHook(() => useAsyncData(fetchFn, []));
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.data).toEqual(data);
    expect(result.current.error).toBe("");
  });

  it("sets error when fetch rejects", async () => {
    const fetchFn = vi.fn().mockRejectedValue(new Error("Network error"));
    const { result } = renderHook(() => useAsyncData(fetchFn, []));
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.error).toBe("Network error");
    expect(result.current.data).toBeNull();
  });

  it("ignores AbortError and does not set error", async () => {
    const abortErr = new Error("Aborted");
    (abortErr as Error & { name: string }).name = "AbortError";
    const fetchFn = vi.fn().mockRejectedValue(abortErr);
    const { result } = renderHook(() => useAsyncData(fetchFn, []));
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.error).toBe("");
  });

  it("refetch runs fetch again and updates data", async () => {
    let count = 0;
    const fetchFn = vi.fn().mockImplementation(() =>
      Promise.resolve(++count)
    );
    const { result } = renderHook(() => useAsyncData(fetchFn, []));
    await waitFor(() => {
      expect(result.current.data).toBe(1);
    });
    await act(async () => {
      await result.current.refetch();
    });
    await waitFor(() => {
      expect(result.current.data).toBe(2);
    });
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });
});
