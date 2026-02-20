import type { Meta, StoryObj } from "@storybook/svelte";
import Stepper from "./Stepper.svelte";

const meta: Meta<Stepper> = {
  title: "Primitives/Stepper",
  component: Stepper,
};

export default meta;
type Story = StoryObj<Stepper>;

const bibleSteps = [
  { id: "foundations", label: "Foundations" },
  { id: "characters", label: "Characters" },
  { id: "locations", label: "Locations" },
  { id: "style", label: "Style Guide" },
  { id: "review", label: "Review" },
];

export const FirstStep: Story = {
  args: { steps: bibleSteps, currentStep: "foundations", completedSteps: [] },
};

export const MidProgress: Story = {
  args: {
    steps: bibleSteps,
    currentStep: "locations",
    completedSteps: ["foundations", "characters"],
  },
};

export const AllComplete: Story = {
  args: {
    steps: bibleSteps,
    currentStep: "review",
    completedSteps: ["foundations", "characters", "locations", "style"],
  },
};
