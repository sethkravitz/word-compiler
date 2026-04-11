import type { Meta, StoryObj } from "@storybook/svelte";
import { fn } from "storybook/test";
import { makeChunk, makeSceneEntry } from "../stories/factories.js";
import SceneSequencer from "./SceneSequencer.svelte";

const meta: Meta<SceneSequencer> = {
  title: "Components/SceneSequencer",
  component: SceneSequencer,
  parameters: { layout: "fullscreen" },
  args: {
    onSelectScene: fn(),
  },
};

export default meta;
type Story = StoryObj<SceneSequencer>;

export const MultipleScenes: Story = {
  args: {
    scenes: [
      makeSceneEntry("s1", "The Setup", "complete"),
      makeSceneEntry("s2", "The Hidden Cost", "drafting"),
      makeSceneEntry("s3", "The Counter-Evidence", "planned"),
      makeSceneEntry("s4", "The Implication", "planned"),
    ],
    activeSceneIndex: 1,
    sceneChunks: {
      s1: [makeChunk({ sceneId: "s1", status: "accepted" })],
      s2: [makeChunk({ sceneId: "s2" })],
    },
  },
};

export const SingleScene: Story = {
  args: {
    scenes: [makeSceneEntry("s1", "Opening", "drafting")],
    activeSceneIndex: 0,
    sceneChunks: {},
  },
};

export const AllComplete: Story = {
  args: {
    scenes: [
      makeSceneEntry("s1", "Act I", "complete"),
      makeSceneEntry("s2", "Act II", "complete"),
      makeSceneEntry("s3", "Act III", "complete"),
    ],
    activeSceneIndex: 2,
    sceneChunks: {},
  },
};

export const EmptyProject: Story = {
  args: {
    scenes: [],
    activeSceneIndex: 0,
    sceneChunks: {},
  },
};

export const ManyScenes: Story = {
  args: {
    scenes: [
      makeSceneEntry("s1", "The Premise", "complete"),
      makeSceneEntry("s2", "The Evidence", "complete"),
      makeSceneEntry("s3", "The Anecdote", "complete"),
      makeSceneEntry("s4", "The Counter-Argument", "drafting"),
      makeSceneEntry("s5", "The Hidden Cost", "planned"),
      makeSceneEntry("s6", "The Deeper Problem", "planned"),
      makeSceneEntry("s7", "The Synthesis", "planned"),
      makeSceneEntry("s8", "The Call to Action", "planned"),
    ],
    activeSceneIndex: 3,
    sceneChunks: {
      s1: [makeChunk({ sceneId: "s1", status: "accepted" }), makeChunk({ sceneId: "s1", status: "accepted" })],
      s4: [makeChunk({ sceneId: "s4" })],
    },
  },
};
