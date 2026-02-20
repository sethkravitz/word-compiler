import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import RadioGroup from "../../src/app/primitives/RadioGroup.svelte";

const povOptions = [
  { value: "first", label: "First" },
  { value: "close-third", label: "Close Third" },
  { value: "distant-third", label: "Distant Third" },
  { value: "omniscient", label: "Omniscient" },
];

describe("RadioGroup", () => {
  it("renders all option labels", () => {
    render(RadioGroup, { options: povOptions, value: "first", onchange: vi.fn(), name: "pov" });
    for (const opt of povOptions) {
      expect(screen.getByText(opt.label)).toBeInTheDocument();
    }
  });

  it("calls onchange with selected value", async () => {
    const onchange = vi.fn();
    render(RadioGroup, { options: povOptions, value: "first", onchange, name: "pov" });
    await fireEvent.click(screen.getByText("Close Third"));
    expect(onchange).toHaveBeenCalledWith("close-third");
  });

  it("renders in row direction by default", () => {
    const { container } = render(RadioGroup, { options: povOptions, value: "first", onchange: vi.fn(), name: "pov" });
    expect(container.querySelector(".radio-group-row")).toBeInTheDocument();
  });

  it("renders in column direction when specified", () => {
    const { container } = render(RadioGroup, {
      options: povOptions,
      value: "first",
      onchange: vi.fn(),
      name: "pov",
      direction: "column",
    });
    expect(container.querySelector(".radio-group-column")).toBeInTheDocument();
  });
});
