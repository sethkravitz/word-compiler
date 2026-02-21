# Bootstrap & Genre Templates

Two mechanisms help authors start quickly: **AI Bootstrap** generates a Bible from a synopsis via LLM, and **Genre Templates** pre-fill style defaults from curated presets.

## AI Bootstrap (`src/bootstrap/index.ts`)

### Prompt Builder

`buildBootstrapPrompt(synopsis)` constructs a `CompiledPayload` that asks the LLM to extract structured story elements from a free-text synopsis:

- **Characters**: name, role, physical description, backstory, voice notes, emotion physicality
- **Locations**: name, sensory palette (sounds, smells, textures, light quality, prohibited defaults)
- **Suggested tone**: metaphoric domains, prohibited domains, pacing notes, interiority level
- **Suggested kill list**: genre-appropriate banned phrases

The prompt uses JSON Schema (`bootstrapSchema`) for structured output and instructs the model to be "ruthlessly specific" — generic descriptions are flagged as useless.

### Response Parser

`parseBootstrapResponse(response)` uses a 3-tier fallback strategy:

1. **Direct JSON parse** — `JSON.parse()` on raw response
2. **Code fence extraction** — strip `` ```json ``` `` blocks (handles both closed and unclosed fences)
3. **Brace-depth counting** — find the first balanced `{...}` block

### Bible Mapper

`bootstrapToBible(parsed, projectId)` converts the parsed response into a full `Bible` object:
- Characters get generated IDs, voice fields mapped, empty dialogue samples (author must fill)
- Locations get sensory palettes mapped to the Bible schema
- Tone becomes metaphoric register and narrative rules
- Kill list items default to `type: "exact"`
- POV defaults to close-third with interiority inferred from tone

## Scene Bootstrap (`src/bootstrap/sceneBootstrap.ts`)

### Prompt Builder

`buildSceneBootstrapPrompt(params)` generates multiple scene plans from a chapter direction:

- Input: direction text, scene count, available characters/locations, constraints
- Output: array of scene plans with reader state continuity across scenes
- Optionally generates a `chapterArc` alongside the scenes
- Uses JSON Schema (`sceneBootstrapSchema`) for structured output

### Response Parser

`parseSceneBootstrapResponse(response)` — same 3-tier fallback as the Bible bootstrap.

### Plan Mapper

`mapSceneBootstrapToPlans(parsed, projectId, characters, locations)` converts raw LLM output into typed `ScenePlan[]`:
- Resolves character references by ID or name (fuzzy matching)
- Resolves location references by ID or name
- Normalizes word count estimates (array or single number)
- Validates enum values (density, POV distance) with fallback to defaults
- Starts from `createEmptyScenePlan()` and spreads LLM values over it

## Genre Templates (`src/bootstrap/genres.ts`)

Four curated templates provide opinionated style defaults:

| Template | ID | POV | Interiority | Key Trait |
|----------|----|-----|-------------|-----------|
| Literary Fiction | `literary-fiction` | close-third, intimate | filtered | High sentence variance, subtext-heavy |
| Thriller | `thriller` | close-third, close | behavioral-only | Short paragraphs, extreme variance, no digressions |
| Romance | `romance` | close-third, intimate | stream | Emotional interiority, body language subtext |
| Science Fiction | `sci-fi` | close-third, moderate | filtered | World-building through sensory detail |

Each template defines: POV settings, kill list, metaphoric register (approved + prohibited domains), sentence architecture, paragraph policy, structural bans, subtext policy, and exposition policy.

### Fill-Blank Merge

`applyGenreTemplate(bible, template)` uses a **fill-blank strategy**:
- Only populates fields that are null, empty, or at default values
- Never overwrites author-set values
- Returns a new Bible (does not mutate the input)

Example: if the author has already added kill list entries, the template's kill list is ignored. But if the kill list is empty, the template's entries are applied.

### GenreDefaults Type

```typescript
interface GenreDefaults {
  pov?: { default?; distance?; interiority? };
  killList?: Array<{ pattern: string; type: "exact" | "structural" }>;
  metaphoricRegister?: { approvedDomains?; prohibitedDomains? };
  sentenceArchitecture?: { targetVariance?; fragmentPolicy?; notes? };
  paragraphPolicy?: { maxSentences?; singleSentenceFrequency?; notes? };
  structuralBans?: string[];
  subtextPolicy?: string;
  expositionPolicy?: string;
}
```

## Key Files

| File | Purpose |
|------|---------|
| `src/bootstrap/index.ts` | Bible bootstrap: prompt, parser, mapper + re-exports |
| `src/bootstrap/sceneBootstrap.ts` | Scene plan bootstrap: prompt, parser, mapper |
| `src/bootstrap/genres.ts` | 4 genre templates + `applyGenreTemplate` fill-blank merge |
| `src/app/components/BootstrapModal.svelte` | AI Bootstrap UI |
| `src/app/components/BibleAuthoringModal.svelte` | Genre selector in guided form |
