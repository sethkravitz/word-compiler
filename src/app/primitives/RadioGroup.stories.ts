import type { Meta, StoryObj } from "@storybook/svelte";
import RadioGroup from "./RadioGroup.svelte";

const meta: Meta<RadioGroup> = {
  title: "Primitives/RadioGroup",
  component: RadioGroup,
  argTypes: {
    direction: { control: "select", options: ["row", "column"] },
  },
};

export default meta;
type Story = StoryObj<RadioGroup>;

export const Row: Story = {
  args: {
    name: "pov",
    value: "close-third",
    options: [
      { value: "first", label: "First" },
      { value: "close-third", label: "Close Third" },
      { value: "distant-third", label: "Distant Third" },
      { value: "omniscient", label: "Omniscient" },
    ],
  },
};

export const Column: Story = {
  args: {
    name: "density",
    value: "moderate",
    direction: "column",
    options: [
      { value: "sparse", label: "Sparse" },
      { value: "moderate", label: "Moderate" },
      { value: "dense", label: "Dense" },
    ],
  },
};
