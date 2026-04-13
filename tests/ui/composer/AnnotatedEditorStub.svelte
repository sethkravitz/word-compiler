<script lang="ts">
import type { EditorialAnnotation } from "../../../src/review/types.js";
import { setCapturedStubProps } from "./annotatedEditorStubState.js";

let {
  text,
  annotations = [],
  readonly = false,
  onTextChange,
  onDismissAnnotation,
}: {
  text: string;
  annotations?: EditorialAnnotation[];
  readonly?: boolean;
  onTextChange?: (newText: string) => void;
  onDismissAnnotation?: (annotationId: string) => void;
} = $props();

// Capture latest props on every render so tests can see updates and trigger
// callbacks without a real ProseMirror editor.
$effect(() => {
  setCapturedStubProps({ text, annotations, readonly, onTextChange, onDismissAnnotation });
});
</script>

<div data-testid="annotated-editor-stub" data-readonly={readonly} data-annotation-count={annotations.length}>
  <pre data-testid="stub-text">{text}</pre>
</div>
