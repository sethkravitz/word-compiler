# Export Pipeline

The export pipeline converts scene prose into downloadable document formats. Both exporters are pure functions with no side effects — they take scene data in and return a string out.

## Data Flow

```
SceneEntry[] + sceneChunks ──▶ sort by sceneOrder ──▶ getCanonicalText(chunk) ──▶ format ──▶ string
```

`getCanonicalText(chunk)` returns `editedText ?? generatedText`, ensuring exports always reflect the author's latest edits.

## Markdown Export (`src/export/markdown.ts`)

`exportToMarkdown(scenes, sceneChunks, chapterArc?)` produces:

```markdown
# Chapter Title          ← from chapterArc.workingTitle (if present)

## Scene 1 Title         ← from scene.plan.title (fallback: "Scene N")

Prose paragraphs...      ← chunks joined with blank lines

---

## Scene 2 Title

More prose...

---

*1,234 words*             ← word count footer
```

Structure:
- Chapter heading (`#`) from `chapterArc.workingTitle`
- Scene headings (`##`) from `scene.plan.title`
- Horizontal rules (`---`) between scenes
- Word count footer with locale-formatted number
- Scenes with no chunks are skipped

## Plaintext Export (`src/export/plaintext.ts`)

`exportToPlaintext(scenes, sceneChunks)` produces minimal prose:

```
Scene 1 prose...

* * *

Scene 2 prose...
```

Structure:
- No headings — prose only
- Typographic scene breaks (`* * *`) between scenes
- No word count footer
- No chapter title

## ExportModal UI (`src/app/components/ExportModal.svelte`)

The modal provides:
- **Format selector**: RadioGroup with Markdown (`.md`) and Plain Text (`.txt`)
- **Preview**: Truncated prose preview (first 500 characters)
- **Metadata**: Word count and file extension
- **Actions**: Copy to Clipboard and Download File buttons
- **Empty state**: "No prose to export" when no chunks exist

## Key Files

| File | Purpose |
|------|---------|
| `src/export/markdown.ts` | `exportToMarkdown` — headings, separators, word count |
| `src/export/plaintext.ts` | `exportToPlaintext` — prose with typographic breaks |
| `src/app/components/ExportModal.svelte` | Export UI with format selection and preview |
