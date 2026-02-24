import type { Meta, StoryObj } from "@storybook/svelte";
import ReaderStateFieldsStory from "./ReaderStateFieldsStory.svelte";

const meta: Meta<ReaderStateFieldsStory> = {
  title: "Components/ReaderStateFields",
  component: ReaderStateFieldsStory,
  parameters: { layout: "padded" },
  argTypes: {
    prePopulated: { control: "boolean" },
    showExamples: { control: "boolean" },
  },
};

export default meta;
type Story = StoryObj<ReaderStateFieldsStory>;

export const Empty: Story = {
  args: { prePopulated: false },
};

export const PrePopulated: Story = {
  args: { prePopulated: true },
};

export const WithExamples: Story = {
  args: { prePopulated: false, showExamples: true },
};
