# Plan: Mock GitHub Issues API

## Goal

Replace live Octokit network calls with local fixture data when `USE_MOCK=1` is set,
so the triage pipeline can be iterated and tested without hitting GitHub's API or
requiring a token.

## Approach

Toggle behaviour inside `fetchIssues()` via the `USE_MOCK` environment variable.
When set, the function reads from a single JSON fixture file instead of calling Octokit.
The public signature of `fetchIssues()` is unchanged, so `index.ts` and `triage.ts`
need no modifications.

## Files

| File | Change |
|---|---|
| `mock/issues.json` | **New.** Array of `Issue` objects matching the shape in `github.ts`. Edit this file to adjust fixture data. |
| `src/github.ts` | **Modified.** Add a `loadMockIssues()` helper that reads `mock/issues.json`, and branch on `USE_MOCK` at the top of `fetchIssues()`. |

## Implementation Steps

### 1. Create `mock/issues.json`

The file contains a JSON array of objects with the fields that match the internal
`Issue` interface:

```ts
interface Issue {
  number: number;
  title: string;
  body: string;
  labels: string[];
}
```

Seed it with a representative sample (a mix of bugs, features, noise, and bot spam)
so all triage branches are exercised. The file lives at the repo root under `mock/`
so it is easy to find and edit.

### 2. Modify `src/github.ts`

Add a branch at the top of `fetchIssues()`:

```ts
import { readFileSync } from "fs";
import { resolve } from "path";

export async function fetchIssues(): Promise<FetchIssuesResult> {
  if (process.env.USE_MOCK === "1") {
    const raw = readFileSync(resolve("mock/issues.json"), "utf-8");
    const issues: Issue[] = JSON.parse(raw);
    return { issues };
  }
  // ... existing Octokit code unchanged ...
}
```

No new modules, no dependency injection — just a guarded early-return.

### 3. Usage

```bash
# Use mock data (fast, no token needed)
USE_MOCK=1 npm start

# Use live GitHub API (as before)
npm start
```

## Trade-offs

- **Simplicity over flexibility:** a single env-var toggle is enough for the current
  use case. If multiple fixture scenarios are needed later, the `USE_MOCK` value can
  be changed from `"1"` to a filename (e.g. `USE_MOCK=noise-heavy`).
- **No test framework introduced:** the mock is used at the `npm start` level, not
  inside a unit test. This keeps the change minimal and consistent with the current
  project structure.
- **Fixture data stays in sync manually:** the JSON file is not auto-generated.
  Re-run the live pipeline and copy `output.txt` data back if it drifts too far from
  real issues.
