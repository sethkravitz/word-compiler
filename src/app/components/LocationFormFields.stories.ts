import type { Meta, StoryObj } from "@storybook/svelte";
import LocationFormFieldsStory from "./LocationFormFieldsStory.svelte";

const meta: Meta<LocationFormFieldsStory> = {
  title: "Components/LocationFormFields",
  component: LocationFormFieldsStory,
  parameters: { layout: "padded" },
  argTypes: {
    prePopulated: { control: "boolean" },
  },
};

export default meta;
type Story = StoryObj<LocationFormFieldsStory>;

export const Empty: Story = {
  args: { prePopulated: false },
};

export const PrePopulated: Story = {
  args: { prePopulated: true },
};
