import type { Meta, StoryObj } from "@storybook/svelte";
import ReaderStateCardStory from "./ReaderStateCardStory.svelte";

const meta: Meta<ReaderStateCardStory> = {
  title: "Components/ReaderStateCard",
  component: ReaderStateCardStory,
  parameters: { layout: "centered" },
};

export default meta;
type Story = StoryObj<ReaderStateCardStory>;

export const FullState: Story = {
  args: {
    knows: ["Marcus is the informant", "The letter was forged"],
    suspects: ["Elena knows more than she admits"],
    wrongAbout: ["Tomás is trustworthy"],
    activeTensions: ["Will the deal close before dawn?", "Is the second key a trap?"],
  },
};

export const KnowsOnly: Story = {
  args: {
    knows: ["The harbor meeting happened", "Marcus left the city", "Elena has the original document"],
  },
};

export const TensionsOnly: Story = {
  args: {
    activeTensions: [
      "Can Marcus reach the border in time?",
      "Will Elena betray the group?",
      "What was in the locked drawer?",
    ],
  },
};

export const WrongBeliefs: Story = {
  args: {
    knows: ["Someone leaked the plans"],
    wrongAbout: ["Tomás is the leak", "The meeting was cancelled"],
    activeTensions: ["Who will be blamed?"],
  },
};
