import type { Meta, StoryObj } from "@storybook/svelte";
import CharacterFormFieldsStory from "./CharacterFormFieldsStory.svelte";

const meta: Meta<CharacterFormFieldsStory> = {
  title: "Components/CharacterFormFields",
  component: CharacterFormFieldsStory,
  parameters: { layout: "padded" },
  argTypes: {
    prePopulated: { control: "boolean" },
  },
};

export default meta;
type Story = StoryObj<CharacterFormFieldsStory>;

export const Empty: Story = {
  args: { prePopulated: false },
};

export const PrePopulated: Story = {
  args: { prePopulated: true },
};
