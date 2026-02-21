import { render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import CompilerView from "../../src/app/components/CompilerView.svelte";

function defaultProps() {
  return {
    payload: null as any,
    log: null as any,
    lintResult: null as any,
    auditFlags: [] as any[],
    metrics: null as any,
    onResolveFlag: vi.fn(),
    onDismissFlag: vi.fn(),
  };
}

const log = {
  ring1Tokens: 500,
  ring2Tokens: 300,
  ring3Tokens: 200,
  availableBudget: 4000,
  ring1Contents: ["bible"],
  ring2Contents: ["history"],
  ring3Contents: ["scene plan"],
};

const payload = {
  systemMessage: "Test system",
  userMessage: "Test user",
  temperature: 0.7,
  topP: 0.92,
  maxTokens: 4000,
  model: "claude-sonnet-4-6",
};

const lintResult = { issues: [] };

describe("CompilerView", () => {
  it("shows empty state when no payload", () => {
    render(CompilerView, defaultProps());
    expect(screen.getByText("Load a Bible and Scene Plan to see the compiled payload.")).toBeInTheDocument();
  });

  it("shows 'Draft Engine' title always", () => {
    render(CompilerView, defaultProps());
    expect(screen.getByText("Draft Engine")).toBeInTheDocument();
  });

  it("shows system message section when payload and log present", () => {
    render(CompilerView, {
      ...defaultProps(),
      payload,
      log,
      lintResult,
    });
    expect(screen.getByText("Test system")).toBeInTheDocument();
  });

  it("shows generation parameters when payload and log present", () => {
    render(CompilerView, {
      ...defaultProps(),
      payload,
      log,
      lintResult,
    });
    expect(screen.getByText(/Temp: 0.7/)).toBeInTheDocument();
  });
});
