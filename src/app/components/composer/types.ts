// Shared types for the essay composer components (SectionCard, EssayComposer).
//
// SectionState is the discriminated union describing one section's generation
// lifecycle. EssayComposer owns the state; SectionCard renders it via the
// derived ControlMatrix.
//
// Collapsed from 7 to 5 states during the deepening review:
//   - "revertable" became a derived predicate on the composer
//   - "aborted" merged into "failed" with `reason: "aborted"`

export type SectionState =
  | "idle-empty"
  | "idle-populated"
  | "queued"
  | "streaming"
  | { state: "failed"; reason: "error" | "aborted"; message: string };

/**
 * Derived from (state, isFirstSection, isLastSection, isRevertable, hasText)
 * by SectionCard. Drives every visible/disabled control on the card.
 *
 * Visibility vs enablement is intentional: a hidden control is not in the DOM,
 * a disabled control is in the DOM but not interactive (and screen readers can
 * still discover it). The control matrix lookup table in the plan defines both
 * dimensions per state.
 */
export interface ControlMatrix {
  generateVisible: boolean;
  generateEnabled: boolean;
  regenerateVisible: boolean;
  regenerateEnabled: boolean;
  revertVisible: boolean;
  cancelVisible: boolean;
  editorReadonly: boolean;
  reorderUpEnabled: boolean;
  reorderDownEnabled: boolean;
  deleteEnabled: boolean;
  directiveEnabled: boolean;
  queueIndicatorVisible: boolean;
  errorBannerVisible: boolean;
}

export function isFailedState(
  state: SectionState,
): state is { state: "failed"; reason: "error" | "aborted"; message: string } {
  return typeof state === "object" && state !== null && "state" in state && state.state === "failed";
}

/**
 * Compute the ControlMatrix for a section. Pure function — no Svelte runes.
 *
 * @param state         Current SectionState.
 * @param isFirstSection True when this is the first section in the list.
 * @param isLastSection  True when this is the last section in the list.
 * @param isRevertable   Composer-derived predicate: revert slot exists and is unexpired.
 * @param hasText        True when canonical prose exists for the section.
 *                       Drives Failed-state Generate vs Regenerate disambiguation.
 */
export function computeControlMatrix(
  state: SectionState,
  isFirstSection: boolean,
  isLastSection: boolean,
  isRevertable: boolean,
  hasText: boolean,
): ControlMatrix {
  // Defaults — every state overrides what it needs.
  const base: ControlMatrix = {
    generateVisible: false,
    generateEnabled: false,
    regenerateVisible: false,
    regenerateEnabled: false,
    revertVisible: false,
    cancelVisible: false,
    editorReadonly: false,
    reorderUpEnabled: !isFirstSection,
    reorderDownEnabled: !isLastSection,
    deleteEnabled: true,
    directiveEnabled: true,
    queueIndicatorVisible: false,
    errorBannerVisible: false,
  };

  if (state === "idle-empty") {
    return { ...base, generateVisible: true, generateEnabled: true };
  }

  if (state === "idle-populated") {
    return {
      ...base,
      regenerateVisible: true,
      regenerateEnabled: true,
      revertVisible: isRevertable,
    };
  }

  if (state === "queued") {
    return {
      ...base,
      generateVisible: true,
      generateEnabled: false,
      cancelVisible: true,
      editorReadonly: true,
      reorderUpEnabled: false,
      reorderDownEnabled: false,
      deleteEnabled: false,
      directiveEnabled: false,
      queueIndicatorVisible: true,
    };
  }

  if (state === "streaming") {
    return {
      ...base,
      cancelVisible: true,
      editorReadonly: true,
      reorderUpEnabled: false,
      reorderDownEnabled: false,
      deleteEnabled: false,
      directiveEnabled: false,
    };
  }

  // Failed
  if (isFailedState(state)) {
    if (hasText) {
      return {
        ...base,
        regenerateVisible: true,
        regenerateEnabled: true,
        errorBannerVisible: true,
      };
    }
    return {
      ...base,
      generateVisible: true,
      generateEnabled: true,
      errorBannerVisible: true,
    };
  }

  // Exhaustive guard — TypeScript will catch unhandled members at compile time.
  return base;
}
