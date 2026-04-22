# Plan: Mock Anthropic API for Categorization

## Goal

Extend the existing `mock/issues.json` fixture file so it also supports offline testing of the `triageIssues()` Anthropic API call, without adding a second mock file.

## Background

`github.ts` already uses `USE_MOCK=1` to return `mock/issues.json` instead of calling the GitHub API. That file currently only has the four fields that `fetchIssues()` needs: `number`, `title`, `body`, `labels`.

`triage.ts` calls `client.messages.parse()` (Anthropic SDK) and expects back a `TriageResult` with `number`, `title`, `category`, `status`, and `summary` per issue.

## Approach

Add three extra fields to every object in `mock/issues.json`:

| Field | Type | Values |
|---|---|---|
| `category` | string enum | `"bug"` \| `"feature"` \| `"other"` |
| `status` | string enum | `"actionable"` \| `"noise"` |
| `summary` | string | 1–2 sentence third-person description |

Each consumer then reads the fields it needs and ignores the rest:

- `github.ts` → reads `number`, `title`, `body`, `labels` (unchanged behaviour)
- `triage.ts` → reads `number`, `title`, `category`, `status`, `summary` and maps to `TriageResult`

## Implementation Steps

### Step 1 — Enrich `mock/issues.json`

For each of the 10 existing issues, add realistic `category`, `status`, and `summary` values that reflect what Claude would actually return given the `body`. Use the distribution across the spectrum (bugs, noise, features) to exercise all triage branches.

Suggested triage for existing issues:

| # | category | status | rationale |
|---|---|---|---|
| 36328 | bug | actionable | Concrete proposal + repro |
| 36327 | bug | actionable | Detailed repro with steps |
| 36326 | other | noise | Garbled title, template body |
| 36325 | other | noise | Garbled title, minimal body |
| 36324 | bug | actionable | Root cause identified, PR attached |
| 36323 | other | noise | Tests only, no runtime change |
| 36321 | bug | actionable | Root cause + fix + repro link |
| 36320 | bug | noise | Typo fix, low priority |
| 36318 | bug | actionable | Root cause + repro + version |
| 36317 | bug | actionable | Detailed repro + fix |

### Step 2 — Add mock toggle to `triage.ts`

Mirror the pattern already in `github.ts`:

```typescript
// near top of triageIssues()
if (process.env.USE_MOCK === "1") {
  const raw = readFileSync(resolve("mock/issues.json"), "utf-8");
  const all: Array<{
    number: number;
    title: string;
    category: "bug" | "feature" | "other";
    status: "actionable" | "noise";
    summary: string;
  }> = JSON.parse(raw);

  // only return issues that were passed in (caller may have filtered)
  const incoming = new Set(issues.map((i) => i.number));
  return {
    issues: all
      .filter((item) => incoming.has(item.number))
      .map(({ number, title, category, status, summary }) => ({
        number, title, category, status, summary,
      })),
  };
}
```

Key detail: filter by `issues` argument so the mock respects whatever subset the caller passes in, instead of always returning all 10.

### Step 3 — Add `readFileSync` / `resolve` imports to `triage.ts`

```typescript
import { readFileSync } from "fs";
import { resolve } from "path";
```

These are already present in `github.ts` so the pattern is consistent.

## What changes

| File | Change |
|---|---|
| `mock/issues.json` | Add `category`, `status`, `summary` to all 10 objects |
| `src/triage.ts` | Add `readFileSync`/`resolve` imports + `USE_MOCK` early return |

No changes to `src/github.ts`, `src/index.ts`, or any schema/type definitions.

## Testing

```bash
# Full offline run — no tokens needed
USE_MOCK=1 npm start
```

Expected output: same formatted triage table as a live run, sourced entirely from local fixtures.

## Trade-offs

- **Single source of truth:** one file, two consumers. No sync problem between separate fixture files.
- **Filter-by-caller:** mock respects the `issues` argument, so tests that pass a subset still work correctly.
- **No schema change:** the extra fields on `mock/issues.json` objects are simply ignored by `github.ts`'s typed parse—TypeScript will not complain since `JSON.parse` returns `any`.
