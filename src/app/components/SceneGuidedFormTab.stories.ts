import type { Meta, StoryObj } from "@storybook/svelte";
import SceneGuidedFormTabStory from "./SceneGuidedFormTabStory.svelte";

const meta: Meta<SceneGuidedFormTabStory> = {
  title: "Components/SceneGuidedFormTab",
  component: SceneGuidedFormTabStory,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Guided form for creating scene plans — 4 steps: Core Identity, Reader Knowledge, Texture, and Structure. " +
          "Includes ExamplesDrawer integration for narrative goal, emotional beat, subtext, and pacing fields.",
      },
    },
  },
  argTypes: {
    withCharacters: {
      control: "boolean",
      description: "Populate the character selector with sample characters.",
    },
    withLocations: {
      control: "boolean",
      description: "Populate the location selector with sample locations.",
    },
    initialStep: {
      control: "select",
      options: ["core", "reader", "texture", "structure"],
      description: "Which form step to show initially.",
    },
  },
};

export default meta;
type Story = StoryObj<SceneGuidedFormTabStory>;

export const CoreEmpty: Story = {
  args: { withCharacters: false, withLocations: false, initialStep: "core" },
};

export const CoreWithCharacters: Story = {
  args: { withCharacters: true, withLocations: false, initialStep: "core" },
};

export const ReaderKnowledge: Story = {
  args: { withCharacters: true, withLocations: true, initialStep: "reader" },
};

export const TextureWithLocations: Story = {
  args: { withCharacters: true, withLocations: true, initialStep: "texture" },
};

export const Structure: Story = {
  args: { withCharacters: true, withLocations: true, initialStep: "structure" },
};
