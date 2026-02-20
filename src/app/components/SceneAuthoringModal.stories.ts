import type { Meta, StoryObj } from "@storybook/svelte";
import SceneAuthoringModalStory from "./SceneAuthoringModalStory.svelte";

const meta: Meta<SceneAuthoringModalStory> = {
  title: "Components/SceneAuthoringModal",
  component: SceneAuthoringModalStory,
};

export default meta;
type Story = StoryObj<SceneAuthoringModalStory>;

export const Empty: Story = {
  args: { withBible: false },
};

export const WithBible: Story = {
  args: { withBible: true },
};
