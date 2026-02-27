<script lang="ts">
import { Editor } from "@tiptap/core";
import Document from "@tiptap/extension-document";
import Paragraph from "@tiptap/extension-paragraph";
import Text from "@tiptap/extension-text";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { EditorialAnnotation } from "../../review/types.js";
import AnnotationTooltip from "./AnnotationTooltip.svelte";

let {
  text,
  annotations = [],
  readonly = false,
  onTextChange,
  onAcceptSuggestion,
  onDismissAnnotation,
}: {
  text: string;
  annotations?: EditorialAnnotation[];
  readonly?: boolean;
  onTextChange?: (newText: string) => void;
  onAcceptSuggestion?: (annotationId: string) => void;
  onDismissAnnotation?: (annotationId: string) => void;
} = $props();

let editorElement: HTMLDivElement;
let editor: Editor | null = $state(null);
let applyingExternal = false;
let activeAnnotation = $state<EditorialAnnotation | null>(null);
let tooltipPosition = $state({ top: 0, left: 0 });

const editorialKey = new PluginKey("editorial-annotations");

// ─── Position Mapping ───────────────────────────
// ProseMirror uses node-based positions where paragraph boundaries add gaps.
// We convert character offsets (from resolveAnchor) to PM positions.
function offsetToPos(ed: Editor, offset: number): number {
  const doc = ed.state.doc;
  let acc = 0;
  let found: number | null = null;
  doc.descendants((node, pos, parent) => {
    if (found !== null) return false;
    if (node.isText) {
      const next = acc + node.text!.length;
      if (offset <= next) {
        found = pos + (offset - acc);
        return false;
      }
      acc = next;
    } else if (node.isBlock && parent) {
      if (acc > 0) acc += 2; // mirrors getText "\n\n" separator
    }
    return true;
  });
  return found ?? doc.content.size;
}

function makeDecorations(ed: Editor, anns: EditorialAnnotation[]): DecorationSet {
  const decorations: Decoration[] = [];
  for (const ann of anns) {
    if (ann.charRange.start === ann.charRange.end) continue;
    const from = offsetToPos(ed, ann.charRange.start);
    const to = offsetToPos(ed, ann.charRange.end);
    if (from >= to) continue;
    decorations.push(
      Decoration.inline(
        from,
        to,
        {
          class: `editorial-squiggle editorial-${ann.severity}`,
          "data-annotation-id": ann.id,
        },
        { inclusiveStart: true, inclusiveEnd: true },
      ),
    );
  }
  return DecorationSet.create(ed.state.doc, decorations);
}

function createEditorialPlugin(): Plugin {
  return new Plugin({
    key: editorialKey,
    state: {
      init() {
        return DecorationSet.empty;
      },
      apply(tr, prev) {
        const meta = tr.getMeta(editorialKey);
        if (meta?.decoSet) {
          return meta.decoSet as DecorationSet;
        }
        if (tr.docChanged) {
          return prev.map(tr.mapping, tr.doc);
        }
        return prev;
      },
    },
    props: {
      decorations(state) {
        return editorialKey.getState(state) ?? DecorationSet.empty;
      },
    },
  });
}

// ─── Editor Lifecycle ───────────────────────────
$effect(() => {
  if (editor || !editorElement) return;

  editor = new Editor({
    element: editorElement,
    extensions: [Document, Paragraph, Text],
    content: text,
    editable: !readonly,
    editorProps: {
      attributes: {
        class: "annotated-editor-content",
      },
    },
    onUpdate({ editor: ed }) {
      if (applyingExternal) return;
      const newText = ed.getText({ blockSeparator: "\n\n" });
      onTextChange?.(newText);
    },
  });

  // Register the editorial plugin after creation
  editor.registerPlugin(createEditorialPlugin());

  return () => {
    editor?.destroy();
    editor = null;
  };
});

// ─── Sync External Text ─────────────────────────
$effect(() => {
  if (!editor) return;
  const currentText = editor.getText({ blockSeparator: "\n\n" });
  if (text !== currentText) {
    applyingExternal = true;
    editor.commands.setContent(text);
    applyingExternal = false;
  }
});

// ─── Sync Annotations ───────────────────────────
$effect(() => {
  if (!editor) return;
  // Access annotations to track the dependency
  const anns = annotations;
  const decoSet = makeDecorations(editor, anns);
  const tr = editor.state.tr.setMeta(editorialKey, { decoSet });
  editor.view.dispatch(tr);
});

// ─── Sync Readonly ──────────────────────────────
$effect(() => {
  if (!editor) return;
  editor.setEditable(!readonly);
});

// ─── Hover Handling ─────────────────────────────
function handleMouseOver(e: MouseEvent) {
  const target = (e.target as HTMLElement).closest?.("[data-annotation-id]");
  if (!target) {
    activeAnnotation = null;
    return;
  }
  const annId = (target as HTMLElement).dataset.annotationId;
  const ann = annotations.find((a) => a.id === annId);
  if (!ann) return;

  const rect = (target as HTMLElement).getBoundingClientRect();
  const wrapperRect = editorElement.getBoundingClientRect();
  tooltipPosition = {
    top: rect.bottom - wrapperRect.top + 4,
    left: Math.max(0, rect.left - wrapperRect.left),
  };
  activeAnnotation = ann;
}

function handleMouseLeave() {
  // Delay to allow clicking tooltip buttons
  setTimeout(() => {
    activeAnnotation = null;
  }, 200);
}

function handleAccept(id: string) {
  const ann = annotations.find((a) => a.id === id);
  if (!ann?.suggestion || !editor) return;

  const from = offsetToPos(editor, ann.charRange.start);
  const to = offsetToPos(editor, ann.charRange.end);
  editor.chain().focus().deleteRange({ from, to }).insertContentAt(from, ann.suggestion).run();
  activeAnnotation = null;
  onAcceptSuggestion?.(id);
}

function handleDismiss(id: string) {
  activeAnnotation = null;
  onDismissAnnotation?.(id);
}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="annotated-editor-wrapper"
  onmouseover={handleMouseOver}
  onmouseleave={handleMouseLeave}
>
  <div bind:this={editorElement} class="annotated-editor"></div>
  {#if activeAnnotation}
    <AnnotationTooltip
      annotation={activeAnnotation}
      position={tooltipPosition}
      onAccept={handleAccept}
      onDismiss={handleDismiss}
    />
  {/if}
</div>

<style>
  .annotated-editor-wrapper {
    position: relative;
    flex: 1;
    min-height: 0;
  }
  .annotated-editor {
    height: 100%;
    overflow-y: auto;
  }
  .annotated-editor :global(.annotated-editor-content) {
    outline: none;
    padding: 10px;
    font-size: 13px;
    line-height: 1.7;
    white-space: pre-wrap;
    min-height: 100%;
  }

  /* Squiggle underlines */
  .annotated-editor :global(.editorial-squiggle) {
    background-repeat: repeat-x;
    background-position: bottom;
    background-size: 4px 3px;
    padding-bottom: 2px;
  }
  .annotated-editor :global(.editorial-critical) {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='4' height='3'%3E%3Cpath d='M0 3 L1 0 L2 3 L3 0 L4 3' fill='none' stroke='%23ef4444' stroke-width='0.7'/%3E%3C/svg%3E");
  }
  .annotated-editor :global(.editorial-warning) {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='4' height='3'%3E%3Cpath d='M0 3 L1 0 L2 3 L3 0 L4 3' fill='none' stroke='%23f59e0b' stroke-width='0.7'/%3E%3C/svg%3E");
  }
  .annotated-editor :global(.editorial-info) {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='4' height='3'%3E%3Cpath d='M0 3 L1 0 L2 3 L3 0 L4 3' fill='none' stroke='%233b82f6' stroke-width='0.7'/%3E%3C/svg%3E");
  }
  .annotated-editor :global(.editorial-squiggle:hover) {
    cursor: pointer;
    opacity: 0.9;
  }
</style>
