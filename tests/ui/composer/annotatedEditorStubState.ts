// Capture state for the AnnotatedEditor mock used by SectionCard tests.
// Lives in a separate module so both the stub component and the test file can
// import it without circular references.

import type { EditorialAnnotation } from "../../../src/review/types.js";

export interface StubProps {
  text: string;
  annotations: EditorialAnnotation[];
  readonly: boolean;
  onTextChange?: (newText: string) => void;
  onDismissAnnotation?: (annotationId: string) => void;
}

let captured: StubProps | null = null;

export function setCapturedStubProps(props: StubProps): void {
  captured = props;
}

export function getStubProps(): StubProps {
  if (!captured) throw new Error("AnnotatedEditorStub has not been rendered yet");
  return captured;
}

export function resetStub(): void {
  captured = null;
}

export function fireStubTextChange(newText: string): void {
  getStubProps().onTextChange?.(newText);
}

export function fireStubDismissAnnotation(annotationId: string): void {
  getStubProps().onDismissAnnotation?.(annotationId);
}
