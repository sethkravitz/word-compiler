import type { Meta, StoryObj } from "@storybook/svelte";
import ExamplesDrawerStory from "./ExamplesDrawerStory.svelte";

const meta: Meta<ExamplesDrawerStory> = {
  title: "Primitives/ExamplesDrawer",
  component: ExamplesDrawerStory,
  parameters: { layout: "padded" },
  argTypes: {
    preset: {
      control: "select",
      options: [
        "narrativeGoal",
        "emotionalBeat",
        "subtextSurface",
        "subtextActual",
        "subtextEnforcement",
        "pacing",
        "failureModeToAvoid",
        "vocabularyNotes",
        "readerStateWrongAbout",
        "emotionPhysicality",
        "killList",
        "approvedMetaphoricDomains",
      ],
      description: "Which FIELD_EXAMPLES preset to load.",
    },
    withApplyTemplate: {
      control: "boolean",
      description: "Whether to show the 'Use as Template' button on applicable examples.",
    },
  },
};

export default meta;
type Story = StoryObj<ExamplesDrawerStory>;

export const NarrativeGoal: Story = {
  args: { preset: "narrativeGoal", withApplyTemplate: true },
};

export const EmotionalBeat: Story = {
  args: { preset: "emotionalBeat", withApplyTemplate: true },
};

export const SubtextSurface: Story = {
  args: { preset: "subtextSurface", withApplyTemplate: true },
};

export const Pacing: Story = {
  args: { preset: "pacing", withApplyTemplate: true },
};

export const KillList: Story = {
  args: { preset: "killList", withApplyTemplate: false },
};

export const WithoutApplyButton: Story = {
  args: { preset: "narrativeGoal", withApplyTemplate: false },
};
