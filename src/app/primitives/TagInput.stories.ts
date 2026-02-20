import type { Meta, StoryObj } from "@storybook/svelte";
import TagInput from "./TagInput.svelte";

const meta: Meta<TagInput> = {
  title: "Primitives/TagInput",
  component: TagInput,
  argTypes: {
    placeholder: { control: "text" },
  },
};

export default meta;
type Story = StoryObj<TagInput>;

export const Empty: Story = {
  args: { tags: [], placeholder: "Add a verbal tic..." },
};

export const WithTags: Story = {
  args: {
    tags: ["um", "you know", "basically"],
    placeholder: "Add more...",
  },
};

export const KillList: Story = {
  args: {
    tags: ["a wave of", "let out a breath", "eyes that sparkled"],
    placeholder: "Add banned phrase...",
  },
};
