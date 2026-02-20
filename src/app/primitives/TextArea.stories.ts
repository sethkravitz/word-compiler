import type { Meta, StoryObj } from "@storybook/svelte";
import TextArea from "./TextArea.svelte";

const meta: Meta<TextArea> = {
  title: "Primitives/TextArea",
  component: TextArea,
  argTypes: {
    variant: { control: "select", options: ["default", "compact"] },
    placeholder: { control: "text" },
    rows: { control: "number" },
    resize: { control: "select", options: ["vertical", "none", "both"] },
    autosize: { control: "boolean" },
  },
};

export default meta;
type Story = StoryObj<TextArea>;

export const Default: Story = {
  args: { placeholder: "Write something..." },
};
export const Compact: Story = {
  args: { variant: "compact", placeholder: "Short note..." },
};
export const WithValue: Story = {
  args: { value: "The rain fell in sheets against the window, each drop a tiny percussion." },
};
export const Resizable: Story = {
  args: { placeholder: "Resize me...", resize: "both" },
};
export const Autosize: Story = {
  args: {
    autosize: true,
    value: [
      "Station log, day 337. All systems nominal. I am not.",
      "",
      "She filed the status report at 0613, same as every morning, the boilerplate affirmations of operational readiness that Control expected and she provided. Air recycling: nominal. Power grid: nominal. Communications array: nominal. Structural integrity: nominal. Crew morale: not applicable.",
      "",
      "That last field had been on the form since Meridian was designed for a crew of twelve. She'd stopped finding it funny around day two hundred.",
      "",
      "Drone Six hovered at shoulder height, its maintenance arms folded against its chassis in what she'd come to think of as its resting position.",
    ].join("\n"),
    placeholder: "Write your scene...",
  },
};
