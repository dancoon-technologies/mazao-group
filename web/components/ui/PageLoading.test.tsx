import { describe, it, expect } from "vitest";
import { render, screen } from "@/test-utils";
import { PageLoading } from "./PageLoading";

describe("PageLoading", () => {
  it("renders default message", () => {
    render(<PageLoading />);
    expect(screen.getByText("Loading…")).toBeTruthy();
  });

  it("renders custom message", () => {
    render(<PageLoading message="Fetching visits…" />);
    expect(screen.getByText("Fetching visits…")).toBeTruthy();
  });
});
