import type { Meta, StoryObj } from "@storybook/svelte";
import BibleAuthoringModalStory from "./BibleAuthoringModalStory.svelte";

const meta: Meta<BibleAuthoringModalStory> = {
  title: "Components/BibleAuthoringModal",
  component: BibleAuthoringModalStory,
};

export default meta;
type Story = StoryObj<BibleAuthoringModalStory>;

export const EmptyBootstrap: Story = {
  args: { mode: "bootstrap", prePopulated: false },
};

export const EmptyForm: Story = {
  args: { mode: "form", prePopulated: false },
};

export const PrePopulatedForm: Story = {
  args: { mode: "form", prePopulated: true },
};
