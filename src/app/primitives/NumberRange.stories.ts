import type { Meta, StoryObj } from "@storybook/svelte";
import NumberRange from "./NumberRange.svelte";

const meta: Meta<NumberRange> = {
  title: "Primitives/NumberRange",
  component: NumberRange,
};

export default meta;
type Story = StoryObj<NumberRange>;

export const WordCount: Story = {
  args: { value: [800, 1200] as [number, number], labels: ["min", "max"] as [string, string] },
};

export const SentenceLength: Story = {
  args: { value: [5, 25] as [number, number] },
};
