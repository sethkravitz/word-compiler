import type { Meta, StoryObj } from "@storybook/svelte";
import FormField from "./FormField.svelte";

const meta: Meta<FormField> = {
  title: "Primitives/FormField",
  component: FormField,
  argTypes: {
    label: { control: "text" },
    hint: { control: "text" },
    error: { control: "text" },
    required: { control: "boolean" },
  },
};

export default meta;
type Story = StoryObj<FormField>;

export const Default: Story = {
  args: { label: "Character Name" },
};
export const WithHint: Story = {
  args: { label: "Backstory", hint: "Brief but specific — what shaped this character?" },
};
export const WithError: Story = {
  args: { label: "POV Character", error: "Required field", required: true },
};
export const Required: Story = {
  args: { label: "Title", required: true },
};
