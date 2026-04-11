import type { Meta, StoryObj } from "@storybook/svelte";
import { fn } from "storybook/test";
import { makeProject } from "../stories/factories.js";
import ProjectList from "./ProjectList.svelte";

const meta: Meta<ProjectList> = {
  title: "Components/ProjectList",
  component: ProjectList,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component: "Multi-project selector — lists projects with status badges and provides create/delete actions.",
      },
    },
  },
  args: {
    projects: [],
    onSelectProject: fn(),
    onCreateProject: fn(),
    onDeleteProject: fn(),
  },
};

export default meta;
type Story = StoryObj<ProjectList>;

export const Empty: Story = {};

export const SingleProject: Story = {
  args: {
    projects: [makeProject({ title: "Why Remote Work Fails", status: "drafting" })],
  },
};

export const MixedStatuses: Story = {
  args: {
    projects: [
      makeProject({ title: "Why Remote Work Fails", status: "drafting" }),
      makeProject({ title: "The Productivity Paradox", status: "planning" }),
      makeProject({ title: "On Algorithmic Taste", status: "revising" }),
      makeProject({ title: "Untitled", status: "bootstrap" }),
    ],
  },
};

export const AllStatuses: Story = {
  args: {
    projects: [
      makeProject({ title: "Why Remote Work Fails", status: "drafting" }),
      makeProject({ title: "The Productivity Paradox", status: "planning" }),
      makeProject({ title: "On Algorithmic Taste", status: "revising" }),
      makeProject({ title: "Untitled Sketch", status: "bootstrap" }),
      makeProject({ title: "The Attention Economy", status: "bible" }),
      makeProject({ title: "Against Best Practices", status: "drafting" }),
      makeProject({ title: "What We Lost in Translation", status: "revising" }),
      makeProject({ title: "New Idea", status: "bootstrap" }),
    ],
  },
};
