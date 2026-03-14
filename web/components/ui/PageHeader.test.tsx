import { describe, it, expect } from "vitest";
import { render, screen } from "@/test-utils";
import { PageHeader } from "./PageHeader";

describe("PageHeader", () => {
  it("renders title", () => {
    render(<PageHeader title="Dashboard" />);
    expect(screen.getByRole("heading", { name: "Dashboard" })).toBeTruthy();
  });

  it("renders subtitle when provided", () => {
    render(<PageHeader title="Visits" subtitle="View and verify visit records" />);
    expect(screen.getByText("View and verify visit records")).toBeTruthy();
  });

  it("does not render subtitle when not provided", () => {
    render(<PageHeader title="Farmers" />);
    expect(screen.queryByText("View and verify")).toBeNull();
  });

  it("renders action node when provided", () => {
    render(
      <PageHeader title="Staff" action={<button>Add user</button>} />
    );
    expect(screen.getByRole("button", { name: "Add user" })).toBeTruthy();
  });
});
