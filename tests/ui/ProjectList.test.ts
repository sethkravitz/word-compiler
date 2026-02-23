import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import ProjectList from "../../src/app/components/ProjectList.svelte";
import type { Project } from "../../src/types/index.js";

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: "p1",
    title: "Test Novel",
    status: "drafting",
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-15T00:00:00Z",
    ...overrides,
  };
}

describe("ProjectList", () => {
  it("renders empty state when no projects", () => {
    render(ProjectList, {
      props: {
        projects: [],
        onSelectProject: vi.fn(),
        onCreateProject: vi.fn(),
      },
    });
    expect(screen.getByText(/no projects yet/i)).toBeTruthy();
  });

  it("renders project cards", () => {
    render(ProjectList, {
      props: {
        projects: [makeProject(), makeProject({ id: "p2", title: "Second Novel" })],
        onSelectProject: vi.fn(),
        onCreateProject: vi.fn(),
      },
    });
    expect(screen.getByText("Test Novel")).toBeTruthy();
    expect(screen.getByText("Second Novel")).toBeTruthy();
  });

  it("calls onSelectProject when card is clicked", async () => {
    const onSelect = vi.fn();
    render(ProjectList, {
      props: {
        projects: [makeProject()],
        onSelectProject: onSelect,
        onCreateProject: vi.fn(),
      },
    });
    await fireEvent.click(screen.getByText("Test Novel"));
    expect(onSelect).toHaveBeenCalledWith("p1");
  });

  it("calls onCreateProject when New Project button is clicked", async () => {
    const onCreate = vi.fn();
    render(ProjectList, {
      props: {
        projects: [],
        onSelectProject: vi.fn(),
        onCreateProject: onCreate,
      },
    });
    await fireEvent.click(screen.getByText("New Project"));
    expect(onCreate).toHaveBeenCalled();
  });

  it("shows project status", () => {
    render(ProjectList, {
      props: {
        projects: [makeProject({ status: "revising" })],
        onSelectProject: vi.fn(),
        onCreateProject: vi.fn(),
      },
    });
    expect(screen.getByText("revising")).toBeTruthy();
  });
});
