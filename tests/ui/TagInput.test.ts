import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import TagInput from "../../src/app/primitives/TagInput.svelte";

describe("TagInput", () => {
  it("renders existing tags as pills", () => {
    render(TagInput, { tags: ["um", "basically"], onchange: vi.fn() });
    expect(screen.getByText("um")).toBeInTheDocument();
    expect(screen.getByText("basically")).toBeInTheDocument();
  });

  it("shows placeholder when empty", () => {
    render(TagInput, { tags: [], onchange: vi.fn(), placeholder: "Add tag..." });
    expect(screen.getByPlaceholderText("Add tag...")).toBeInTheDocument();
  });

  it("adds tag on Enter key", async () => {
    const onchange = vi.fn();
    render(TagInput, { tags: ["existing"], onchange });
    const input = screen.getByPlaceholderText("Add tag...");
    await fireEvent.input(input, { target: { value: "new tag" } });
    await fireEvent.keyDown(input, { key: "Enter" });
    expect(onchange).toHaveBeenCalledWith(["existing", "new tag"]);
  });

  it("removes tag when x is clicked", async () => {
    const onchange = vi.fn();
    render(TagInput, { tags: ["um", "basically"], onchange });
    const removeButtons = screen.getAllByLabelText(/Remove/);
    await fireEvent.click(removeButtons[0]!);
    expect(onchange).toHaveBeenCalledWith(["basically"]);
  });

  it("does not add duplicate tags", async () => {
    const onchange = vi.fn();
    render(TagInput, { tags: ["um"], onchange });
    const input = screen.getByPlaceholderText("Add tag...");
    await fireEvent.input(input, { target: { value: "um" } });
    await fireEvent.keyDown(input, { key: "Enter" });
    expect(onchange).not.toHaveBeenCalled();
  });

  it("does not add empty tags", async () => {
    const onchange = vi.fn();
    render(TagInput, { tags: [], onchange });
    const input = screen.getByPlaceholderText("Add tag...");
    await fireEvent.keyDown(input, { key: "Enter" });
    expect(onchange).not.toHaveBeenCalled();
  });
});
