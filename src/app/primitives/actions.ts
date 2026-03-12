/**
 * Svelte action: focuses the element on mount.
 * Usage: `use:focusOnMount` (always focuses) or `use:focusOnMount={condition}` (conditional).
 */
export function focusOnMount(node: HTMLElement, enabled = true): void {
  if (!enabled) return;
  requestAnimationFrame(() => {
    node.focus();
    // Retry once if focus failed (element may not be visible yet due to animation)
    if (document.activeElement !== node) {
      setTimeout(() => node.focus(), 100);
    }
  });
}

/**
 * Shared reactive hover capability detection.
 * Listens for matchMedia changes so hybrid devices (iPad + trackpad)
 * update correctly when input devices are connected/disconnected.
 * Uses a single listener shared across all consumers.
 */
let _hoverState: { value: boolean; listeners: Set<() => void> } | undefined;

function getHoverState() {
  if (_hoverState) return _hoverState;

  const canMatch = typeof window !== "undefined" && typeof window.matchMedia === "function";
  _hoverState = {
    value: canMatch && window.matchMedia("(hover: hover)").matches,
    listeners: new Set(),
  };

  if (canMatch) {
    window.matchMedia("(hover: hover)").addEventListener("change", (e) => {
      _hoverState!.value = e.matches;
      for (const fn of _hoverState!.listeners) fn();
    });
  }

  return _hoverState;
}

/** Returns current hover capability. Call from module scope or $derived. */
export function hasHoverCapability(): boolean {
  return getHoverState().value;
}

/** Subscribe to hover capability changes. Returns unsubscribe function. */
export function onHoverChange(fn: () => void): () => void {
  const state = getHoverState();
  state.listeners.add(fn);
  return () => state.listeners.delete(fn);
}
