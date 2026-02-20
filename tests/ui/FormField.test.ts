import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import FormField from "../../src/app/primitives/FormField.svelte";

describe("FormField", () => {
  it("renders label text", () => {
    render(FormField, { label: "Character Name" });
    expect(screen.getByText("Character Name")).toBeInTheDocument();
  });

  it("shows required indicator", () => {
    render(FormField, { label: "Title", required: true });
    expect(screen.getByText("*")).toBeInTheDocument();
  });

  it("does not show required indicator by default", () => {
    render(FormField, { label: "Title" });
    expect(screen.queryByText("*")).not.toBeInTheDocument();
  });

  it("displays hint text", () => {
    render(FormField, { label: "Backstory", hint: "Brief but specific" });
    expect(screen.getByText("Brief but specific")).toBeInTheDocument();
  });

  it("displays error message", () => {
    render(FormField, { label: "Name", error: "Required field" });
    expect(screen.getByText("Required field")).toBeInTheDocument();
  });

  it("does not show error when none provided", () => {
    render(FormField, { label: "Name" });
    expect(screen.queryByText(/required/i)).not.toBeInTheDocument();
  });
});
