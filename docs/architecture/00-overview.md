# Word Compiler — Architecture Overview

## What Is Word Compiler?

Word Compiler is an AI-assisted fiction authoring tool that treats prose generation the way a software compiler treats source code: a **Bible** (style guide + world state) is compiled into a structured prompt, fed to an LLM, and the output is audited against the same Bible it was built from. The author's role shifts from prompt engineer to editor — reviewing, revising, and refining generated prose.

**Audience**: fiction authors who want LLM-assisted drafting with style control, narrative consistency tracking, and revision learning.

## System Map

```
                           ┌──────────────────────────────┐
                           │         Author / UI          │
                           │  (Svelte 5 + Vite + Browser) │
                           └────────┬──────────┬──────────┘
                                    │          │
                        edit/review │          │ control
                                    ▼          ▼
┌──────────────┐    ┌──────────────────────────────────────┐
│    Bible      │───▶│       Context Compiler (Rings 1-3)   │
│  (style guide │    │  Ring 1: system msg (voice, rules)   │
│   characters  │    │  Ring 2: chapter context (arc, prev) │
│   locations)  │    │  Ring 3: scene context (plan, prose) │
└──────┬───────┘    └──────────────┬───────────────────────┘
       │                           │
       │    ┌──────────────────────┼──────────────────────┐
       │    │                      ▼                      │
       │    │  ┌─────────┐   ┌──────────┐   ┌─────────┐  │
       │    │  │ Budget   │──▶│ Assembler │──▶│  Linter │  │
       │    │  │ Enforcer │   └──────────┘   └────┬────┘  │
       │    │  └─────────┘                        │       │
       │    │       Compilation Pipeline          │       │
       │    └─────────────────────────────────────┼───────┘
       │                                          │
       │                                          ▼
       │                                   ┌────────────┐
       │                                   │  LLM Proxy  │
       │                                   │  (Express)   │
       │                                   └──────┬─────┘
       │                                          │
       │                                          ▼
       │                                   ┌────────────┐
       │                                   │  Generated  │
       │                                   │   Chunk     │
       │                                   └──────┬─────┘
       │                                          │
       ▼                                          ▼
┌──────────────┐    ┌───────────────────────────────────┐
│   Revision   │◀───│          Auditor + IR              │
│   Learner    │    │  kill list, variance, epistemic,  │
│  (patterns,  │    │  setup/payoff, subtext, narrative  │
│   proposals) │    │  IR extraction + verification     │
└──────┬───────┘    └───────────────────────────────────┘
       │
       ▼
┌──────────────┐    ┌───────────────────────────────────┐
│   Tuning     │    │          Persistence              │
│  Proposals   │    │  Browser ↔ Express ↔ SQLite       │
└──────────────┘    └───────────────────────────────────┘
```

## Key Data Flow

1. **Bible** defines the style truth: characters, locations, narrative rules, avoid list
2. **Compiler** builds a three-ring context payload from Bible + chapter arc + scene plan + prior prose
3. **Budget enforcer** compresses rings to fit the token window (R1 first, then R2, then R3)
4. **Linter** validates the payload before generation
5. **LLM** generates a prose chunk via streaming SSE
6. **Auditor** scans the chunk against kill list, sentence variance, paragraph length, epistemic patterns
7. **IR Extractor** builds a narrative intermediate representation (events, facts, deltas, setups/payoffs)
8. **Gates** enforce workflow transitions (plan → draft → complete)
9. **Learner** observes author edits, accumulates patterns, and proposes Bible updates
10. **Tuning** analyzes edit ratios and proposes parameter adjustments
11. **Export** renders canonical prose as Markdown or plain text

## Reading Guide

| Audience | Start With |
|----------|-----------|
| New contributor | This file → `01-theory-of-operation.md` → `02-context-compiler.md` |
| Frontend developer | `11-ui-architecture.md` → `02-context-compiler.md` |
| ML/LLM researcher | `04-narrative-ir.md` → `12-evaluation-system.md` |
| QA/testing | `12-evaluation-system.md` → `05-gates-workflow.md` |

## Technology Stack

| Layer | Technology |
|-------|-----------|
| UI | Svelte 5, Vite 6, CodeMirror 6 |
| State | Class-based `$state` store, `$derived` reactivity |
| Server | Express, better-sqlite3 |
| LLM | Anthropic Claude (via SDK + SSE proxy) |
| Testing | Vitest, @testing-library/svelte, Playwright |
| Linting | Biome v2 |
| Stories | Storybook 10 (CSF 3) |
| Runtime | Node 20 LTS (managed by mise) |
