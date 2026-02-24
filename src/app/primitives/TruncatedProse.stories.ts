import type { Meta, StoryObj } from "@storybook/svelte";
import TruncatedProseStory from "./TruncatedProseStory.svelte";

const meta: Meta<TruncatedProseStory> = {
  title: "Primitives/TruncatedProse",
  component: TruncatedProseStory,
  parameters: { layout: "centered" },
  argTypes: {
    text: { control: "text" },
    maxLength: { control: { type: "number", min: 20, max: 500 } },
  },
};

export default meta;
type Story = StoryObj<TruncatedProseStory>;

export const Short: Story = {
  args: { text: "A brief note that fits entirely." },
};

export const SentenceTruncated: Story = {
  args: {
    text: "She never looked back at the harbor. The salt air carried memories she'd learned to set aside, each gust peeling another layer of regret from her shoulders until she felt light enough to run.",
  },
};

export const WordBoundaryTruncated: Story = {
  args: {
    text: "The interplay of shadow and lamplight across the rain-slicked cobblestones created a shifting mosaic that seemed to breathe with the rhythm of the storm, each flash of lightning freezing the scene into a photograph that burned itself into her memory",
    maxLength: 80,
  },
};

export const CustomMaxLength: Story = {
  args: {
    text: "Marcus kept his voice low, the kind of low that made people lean in, which was exactly what he wanted. Control the space between words and you control the conversation.",
    maxLength: 60,
  },
};
