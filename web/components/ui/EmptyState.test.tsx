import { describe, it, expect } from "vitest";
import { render, screen } from "@/test-utils";
import { EmptyState } from "./EmptyState";

describe("EmptyState", () => {
  it("renders message", () => {
    render(<EmptyState message="No items yet." />);
    expect(screen.getByText("No items yet.")).toBeTruthy();
  });

  it("renders with different message", () => {
    render(<EmptyState message="No reports for this period." />);
    expect(screen.getByText("No reports for this period.")).toBeTruthy();
  });
});
