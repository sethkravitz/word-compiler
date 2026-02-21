import type { NarrativeIR, ScenePlan } from "../types/index.js";

export interface ReaderState {
  knownFacts: Set<string>;
  suspicions: Set<string>;
  unresolvedTensions: Set<string>;
  wrongBeliefs: Set<string>;
}

export interface SceneReaderState {
  sceneId: string;
  sceneOrder: number;
  state: ReaderState;
  /** Facts newly revealed in this scene */
  newFacts: string[];
  /** Tensions newly introduced in this scene */
  newTensions: string[];
  /** Tensions resolved by this scene */
  resolvedTensions: string[];
  /** Setups planted in this scene */
  setupsPlanted: string[];
  /** Payoffs executed in this scene */
  payoffsExecuted: string[];
}

export interface EpistemicWarning {
  sceneId: string;
  type: "knowledge_ahead" | "unrevealed_fact" | "premature_setup_ref";
  message: string;
}

export interface SceneInput {
  plan: ScenePlan;
  ir: NarrativeIR | null;
  sceneOrder: number;
}

function emptyState(): ReaderState {
  return {
    knownFacts: new Set(),
    suspicions: new Set(),
    unresolvedTensions: new Set(),
    wrongBeliefs: new Set(),
  };
}

/**
 * Accumulate reader epistemic state across a sequence of scenes.
 * Only verified IRs contribute to state changes.
 */
export function accumulateReaderState(scenes: SceneInput[]): SceneReaderState[] {
  const sorted = [...scenes].sort((a, b) => a.sceneOrder - b.sceneOrder);
  const results: SceneReaderState[] = [];
  const current = emptyState();

  for (const scene of sorted) {
    const ir = scene.ir;
    const newFacts: string[] = [];
    const newTensions: string[] = [];
    const resolvedTensions: string[] = [];
    const setupsPlanted: string[] = [];
    const payoffsExecuted: string[] = [];

    if (ir && ir.verified) {
      // Accumulate facts revealed to reader
      for (const fact of ir.factsRevealedToReader) {
        if (!current.knownFacts.has(fact)) {
          newFacts.push(fact);
          current.knownFacts.add(fact);
        }
      }

      // Track withheld facts as potential wrong beliefs
      for (const withheld of ir.factsWithheld) {
        current.wrongBeliefs.add(withheld);
      }

      // Remove wrong beliefs when facts are revealed
      for (const fact of ir.factsRevealedToReader) {
        current.wrongBeliefs.delete(fact);
      }

      // Accumulate suspicions from character deltas
      for (const delta of ir.characterDeltas) {
        if (delta.suspicionGained) {
          current.suspicions.add(delta.suspicionGained);
        }
      }

      // Track tensions
      for (const tension of ir.unresolvedTensions) {
        if (!current.unresolvedTensions.has(tension)) {
          newTensions.push(tension);
          current.unresolvedTensions.add(tension);
        }
      }

      // Detect resolved tensions (were in cumulative set but not in current scene's list)
      const currentSceneTensions = new Set(ir.unresolvedTensions);
      for (const existing of current.unresolvedTensions) {
        if (!currentSceneTensions.has(existing) && !newTensions.includes(existing)) {
          // This tension was in the cumulative set but the scene's IR no longer lists it
          // Only count as resolved if it was in the previous cumulative state
          resolvedTensions.push(existing);
        }
      }
      for (const resolved of resolvedTensions) {
        current.unresolvedTensions.delete(resolved);
      }

      // Track setups and payoffs
      setupsPlanted.push(...ir.setupsPlanted);
      payoffsExecuted.push(...ir.payoffsExecuted);
    }

    // Snapshot the current state (deep copy the Sets)
    results.push({
      sceneId: scene.plan.id,
      sceneOrder: scene.sceneOrder,
      state: {
        knownFacts: new Set(current.knownFacts),
        suspicions: new Set(current.suspicions),
        unresolvedTensions: new Set(current.unresolvedTensions),
        wrongBeliefs: new Set(current.wrongBeliefs),
      },
      newFacts,
      newTensions,
      resolvedTensions,
      setupsPlanted,
      payoffsExecuted,
    });
  }

  return results;
}

/**
 * Detect epistemic inconsistencies across accumulated reader states.
 * Checks for: characters acting on unrevealed knowledge, premature setup references.
 */
export function detectEpistemicIssues(scenes: SceneInput[], readerStates: SceneReaderState[]): EpistemicWarning[] {
  const warnings: EpistemicWarning[] = [];
  const allSetups = new Set<string>();
  const stateByScene = new Map(readerStates.map((rs) => [rs.sceneId, rs]));
  const sorted = [...scenes].sort((a, b) => a.sceneOrder - b.sceneOrder);

  for (const scene of sorted) {
    const ir = scene.ir;
    const readerState = stateByScene.get(scene.plan.id);
    if (!ir || !ir.verified || !readerState) continue;

    // Check: character acts on knowledge reader doesn't have
    for (const delta of ir.characterDeltas) {
      if (delta.learned) {
        // If a character learned something, check if reader also knows it
        if (!readerState.state.knownFacts.has(delta.learned)) {
          warnings.push({
            sceneId: scene.plan.id,
            type: "knowledge_ahead",
            message: `Character "${delta.characterId}" acts on "${delta.learned}" but reader doesn't know this yet`,
          });
        }
      }
    }

    // Check: payoff references a setup that hasn't been planted yet
    for (const payoff of ir.payoffsExecuted) {
      if (!allSetups.has(payoff.toLowerCase())) {
        warnings.push({
          sceneId: scene.plan.id,
          type: "premature_setup_ref",
          message: `Payoff "${payoff}" executed before any matching setup was planted`,
        });
      }
    }

    // Accumulate setups for future payoff checks
    for (const setup of ir.setupsPlanted) {
      allSetups.add(setup.toLowerCase());
    }
  }

  return warnings;
}
