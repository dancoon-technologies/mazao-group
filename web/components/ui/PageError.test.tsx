import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@/test-utils";
import { PageError } from "./PageError";

describe("PageError", () => {
  it("renders message and default title", () => {
    render(<PageError message="Failed to load data." />);
    expect(screen.getByText("Something went wrong")).toBeTruthy();
    expect(screen.getByText("Failed to load data.")).toBeTruthy();
  });

  it("renders custom title", () => {
    render(
      <PageError message="Not found." title="404" />
    );
    expect(screen.getByText("404")).toBeTruthy();
  });

  it("renders Retry button when onRetry provided", () => {
    const onRetry = vi.fn();
    render(<PageError message="Error" onRetry={onRetry} />);
    expect(screen.getByRole("button", { name: /retry/i })).toBeTruthy();
  });

  it("calls onRetry when Retry clicked", () => {
    const onRetry = vi.fn();
    render(<PageError message="Error" onRetry={onRetry} />);
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("does not render Retry when onRetry not provided", () => {
    render(<PageError message="Error" />);
    expect(screen.queryByRole("button")).toBeNull();
  });
});
