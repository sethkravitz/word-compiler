import type { Meta, StoryObj } from "@storybook/svelte";
import { fn } from "storybook/test";
import { makeNarrativeIR, makeScenePlan } from "../stories/factories.js";
import ForwardSimulator from "./ForwardSimulator.svelte";

function makeNode(id: string, title: string, order: number, ir: ReturnType<typeof makeNarrativeIR> | null = null) {
  return {
    plan: makeScenePlan({ id, title }),
    ir,
    sceneOrder: order,
  };
}

const meta: Meta<ForwardSimulator> = {
  title: "Components/ForwardSimulator",
  component: ForwardSimulator,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Visual section flow graph showing narrative IR propagation across sections — facts revealed, tensions resolved/introduced, and voice arcs.",
      },
    },
  },
  args: {
    onSelectScene: fn(),
  },
};

export default meta;
type Story = StoryObj<ForwardSimulator>;

export const LinearFlow: Story = {
  args: {
    scenes: [
      makeNode(
        "s1",
        "The Premise",
        0,
        makeNarrativeIR({
          sceneId: "s1",
          verified: true,
          events: ["Introduced the remote work productivity claim"],
          factsRevealedToReader: ["Most companies adopted remote work after 2020"],
          unresolvedTensions: ["Are the productivity numbers real?"],
        }),
      ),
      makeNode(
        "s2",
        "The Evidence",
        1,
        makeNarrativeIR({
          sceneId: "s2",
          verified: true,
          events: ["Presented the Stanford study", "Analyzed the methodology"],
          factsRevealedToReader: ["The study had a self-selection bias", "Hours logged increased but output did not"],
          unresolvedTensions: ["Are the productivity numbers real?", "What are we actually measuring?"],
        }),
      ),
      makeNode(
        "s3",
        "The Hidden Cost",
        2,
        makeNarrativeIR({
          sceneId: "s3",
          verified: true,
          events: ["Connected surveillance tools to declining output", "Cited burnout data"],
          factsRevealedToReader: ["Surveillance tools correlate with decreased productivity"],
          unresolvedTensions: ["What are we actually measuring?", "Can trust replace tracking?"],
        }),
      ),
      makeNode(
        "s4",
        "The Implication",
        3,
        makeNarrativeIR({
          sceneId: "s4",
          verified: true,
          events: ["Drew the larger conclusion about knowledge work"],
          factsRevealedToReader: ["The metrics themselves are the problem"],
          unresolvedTensions: ["Can trust replace tracking?"],
        }),
      ),
    ],
    activeSceneIndex: 0,
  },
};

export const WithTensions: Story = {
  args: {
    scenes: [
      makeNode(
        "s1",
        "The Claim",
        0,
        makeNarrativeIR({
          sceneId: "s1",
          verified: true,
          factsRevealedToReader: ["The industry claims remote work boosts productivity"],
          unresolvedTensions: ["Where does this data come from?", "Is the methodology sound?"],
        }),
      ),
      makeNode(
        "s2",
        "The Contradiction",
        1,
        makeNarrativeIR({
          sceneId: "s2",
          verified: true,
          factsRevealedToReader: ["The methodology has a critical flaw"],
          unresolvedTensions: [
            "Is the methodology sound?",
            "Who benefits from this narrative?",
            "What are the real numbers?",
          ],
        }),
      ),
      makeNode(
        "s3",
        "The Reckoning",
        2,
        makeNarrativeIR({
          sceneId: "s3",
          verified: true,
          factsRevealedToReader: ["Three major companies quietly reversed course"],
          unresolvedTensions: ["What are the real numbers?"],
        }),
      ),
    ],
    activeSceneIndex: 1,
  },
};

export const MixedIR: Story = {
  args: {
    scenes: [
      makeNode(
        "s1",
        "The Premise",
        0,
        makeNarrativeIR({
          sceneId: "s1",
          verified: true,
          events: ["Introduced the core claim"],
          factsRevealedToReader: ["The conventional wisdom is wrong"],
        }),
      ),
      makeNode(
        "s2",
        "The Evidence",
        1,
        makeNarrativeIR({
          sceneId: "s2",
          verified: false,
          events: ["Presented supporting data"],
        }),
      ),
      makeNode("s3", "The Counter-Argument", 2),
      makeNode("s4", "The Conclusion", 3),
    ],
    activeSceneIndex: 2,
  },
};

export const SingleScene: Story = {
  args: {
    scenes: [makeNode("s1", "Opening", 0)],
    activeSceneIndex: 0,
  },
};

export const ActiveMiddle: Story = {
  args: {
    scenes: [
      makeNode("s1", "Part I: The Problem", 0, makeNarrativeIR({ sceneId: "s1", verified: true })),
      makeNode("s2", "Part II: The Evidence", 1, makeNarrativeIR({ sceneId: "s2", verified: true })),
      makeNode("s3", "Part III: The Argument", 2),
      makeNode("s4", "Part IV: The Conclusion", 3),
    ],
    activeSceneIndex: 2,
  },
};
