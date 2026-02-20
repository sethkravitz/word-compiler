import type { Meta, StoryObj } from "@storybook/svelte";
import CardList from "./CardList.svelte";

const meta: Meta = {
  title: "Primitives/CardList",
  component: CardList,
};

export default meta;
type Story = StoryObj;

export const Empty: Story = {
  args: {
    items: [],
    addLabel: "Add Character",
    emptyMessage: "No characters yet. Add one to get started.",
  },
};

export const WithItems: Story = {
  args: {
    items: [
      { name: "Marcus Cole", role: "protagonist" },
      { name: "Elena Voss", role: "antagonist" },
    ],
    addLabel: "Add Character",
  },
};
