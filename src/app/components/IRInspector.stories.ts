import type { Meta, StoryObj } from "@storybook/svelte";
import { fn } from "storybook/test";
import { makeNarrativeIR } from "../stories/factories.js";
import IRInspector from "./IRInspector.svelte";

const meta: Meta<IRInspector> = {
  title: "Components/IRInspector",
  component: IRInspector,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Inspector panel for Narrative IR (intermediate representation) — shows events, facts, voice deltas, setups/payoffs, and unresolved tensions extracted from a section.",
      },
    },
  },
  args: {
    sceneTitle: "The Hidden Cost",
    isExtracting: false,
    canExtract: true,
    onExtract: fn(),
    onVerify: fn(),
    onUpdate: fn(),
    onClose: fn(),
  },
};

export default meta;
type Story = StoryObj<IRInspector>;

export const NoIR: Story = {
  args: { ir: null },
};

export const Extracting: Story = {
  args: { ir: null, isExtracting: true },
};

export const UnverifiedIR: Story = {
  args: { ir: makeNarrativeIR() },
};

export const VerifiedIR: Story = {
  args: {
    ir: makeNarrativeIR({
      events: ["The meeting concluded"],
      factsRevealedToReader: ["The deal was signed"],
      factsIntroduced: [],
      factsWithheld: [],
      characterDeltas: [],
      unresolvedTensions: [],
      verified: true,
    }),
    canExtract: false,
  },
};

export const CannotExtract: Story = {
  args: { ir: null, canExtract: false },
};

export const RichIR: Story = {
  args: {
    ir: makeNarrativeIR({
      events: [
        "Introduced the remote work productivity paradox",
        "Presented the Stanford study's methodology flaws",
        "Drew the connection to surveillance tool adoption",
        "Contrasted claimed efficiency gains with burnout data",
        "Revealed the author's own company made the same mistake",
      ],
      factsIntroduced: [
        "Remote workers log 15% more hours but produce 8% less output",
        "The original study had a self-selection bias",
      ],
      factsRevealedToReader: [
        "The productivity gains were a measurement artifact",
        "The surveillance tools correlated with decreased output",
        "Three major companies quietly reversed their remote policies",
      ],
      factsWithheld: ["The author's company still uses the same flawed metrics"],
      characterDeltas: [
        {
          characterId: "char-author",
          learned: "The data contradicts the prevailing narrative",
          suspicionGained: "The metrics themselves may be the problem",
          emotionalShift: "Confident → doubting",
          relationshipChange: "Trust in industry data shattered",
        },
        {
          characterId: "char-editor",
          learned: "The author already knew about the flaws",
          suspicionGained: null,
          emotionalShift: "Skeptical → convinced",
          relationshipChange: "Recognizes the argument has merit",
        },
      ],
      setupsPlanted: ["The author's own company data has not been examined yet"],
      payoffsExecuted: ["The Stanford study referenced in section 1 had a critical flaw"],
      characterPositions: {
        "char-author": "Presenting evidence from the research",
        "char-editor": "Challenging assumptions from the sideline",
      },
      unresolvedTensions: [
        "Are we measuring the right things?",
        "What happens when the surveillance tools become the product?",
        "Can trust replace tracking?",
      ],
    }),
  },
};

export const WithSetupPayoff: Story = {
  args: {
    ir: makeNarrativeIR({
      setupsPlanted: [
        "The second dataset has not been cross-referenced yet",
        "The author noticed a discrepancy in the quarterly reports",
        "The correlation between tool adoption and attrition was mentioned but not explored",
      ],
      payoffsExecuted: [
        "The productivity claim from section 1 was debunked by the methodology review",
        "The survey data confirmed the burnout hypothesis",
      ],
    }),
  },
};
