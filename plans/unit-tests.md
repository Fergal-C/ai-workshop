# Plan: Unit Tests with Node's Built-in Test Library

## Goal

Add unit tests for each logical step using `node:test` and `node:assert`. The plan covers required refactors to make the code testable, the test file structure, and the changes to `package.json`.

---

## Refactoring Required

Three targeted changes make the code testable without over-engineering.

### 1. `src/triage.ts` — export `formatIssues` and inject the Anthropic client

`formatIssues` is currently unexported, so it cannot be tested directly. The module-level `client` is instantiated unconditionally, so tests cannot provide a fake.

**Changes:**
- Add `export` to `formatIssues`.
- Add an optional second parameter `anthropicClient` to `triageIssues`, defaulting to the module-level `client`.

```diff
-function formatIssues(issues: Issue[]): string {
+export function formatIssues(issues: Issue[]): string {

-export async function triageIssues(issues: Issue[]): Promise<TriageResult> {
+export async function triageIssues(
+  issues: Issue[],
+  anthropicClient: Anthropic = client,
+): Promise<TriageResult> {
```

Inside `triageIssues`, replace `client.messages.parse(...)` with `anthropicClient.messages.parse(...)`.

### 2. `src/github.ts` — inject the Octokit client

The module-level `octokit` instance is constructed at import time with `process.env.GITHUB_TOKEN`. Tests need to supply a fake.

**Changes:**
- Add an optional `octokitClient` parameter to `fetchIssues`, defaulting to the module-level `octokit`.

```diff
-export async function fetchIssues(): Promise<FetchIssuesResult> {
+export async function fetchIssues(
+  octokitClient: Octokit = octokit,
+): Promise<FetchIssuesResult> {
```

Inside, replace `octokit.rest.issues.listForRepo(...)` with `octokitClient.rest.issues.listForRepo(...)`.

### 3. `src/index.ts` — guard the auto-invocation

`main()` is called at module level, so importing it in a test immediately runs the application.

**Changes:**
- Wrap the call with an ESM entry-point guard.

```diff
+import { fileURLToPath } from "url";

-main();
+if (process.argv[1] === fileURLToPath(import.meta.url)) {
+  main();
+}
```

---

## Test File Structure

Place test files alongside source files in `src/`. The TypeScript compiler will include them in `dist/`, and `node --test` will discover them automatically.

```
src/
  triage.ts
  triage.test.ts   ← new
  github.ts
  github.test.ts   ← new
  index.ts
  index.test.ts    ← new
```

---

## `src/triage.test.ts`

### `formatIssues` tests (pure function — no I/O, no API)

| # | Description | Input | Expected output |
|---|-------------|-------|-----------------|
| 1 | Single issue with labels | `[{ number: 1, title: "T", body: "B", labels: ["bug"] }]` | Contains `--- Issue #1 ---`, `Title: T`, `Labels: bug`, `Body:`, `B` |
| 2 | Single issue, no labels | `labels: []` | Contains `Labels: none` |
| 3 | Empty body | `body: ""` | Contains `(empty)` |
| 4 | Multiple issues | Two issues | Both appear in order, separated by blank line |

### `triageIssues` tests — mock mode (`USE_MOCK=1`)

Set `process.env.USE_MOCK = "1"` in `before`, restore in `after`.

| # | Description | Input | Expected |
|---|-------------|-------|----------|
| 5 | Returns only issues matching input numbers | Pass issues `#36318` and `#36321` | Result contains exactly those two issues |
| 6 | Empty input returns empty array | `[]` | `{ issues: [] }` |
| 7 | Unknown issue number is excluded | Issue number not in mock file | Not present in result |
| 8 | Result shape matches schema | Any valid input | Each issue has `number`, `title`, `category`, `status`, `summary` |

### `triageIssues` tests — live API path (injected fake client)

Build a minimal fake Anthropic client object conforming to the shape expected by `triageIssues`.

| # | Description | Fake client behaviour | Expected |
|---|-------------|----------------------|----------|
| 9 | Successful parse | `messages.parse` resolves with `parsed_output: { issues: [...] }` | Returns that result |
| 10 | `parsed_output` is null/undefined | Resolves with `parsed_output: null` | Returns `{ issues: [] }` |
| 11 | API throws | `messages.parse` rejects with `new Error("timeout")` | Returns `{ error: "timeout", issues: [] }` |

---

## `src/github.test.ts`

### `fetchIssues` tests — mock mode (`USE_MOCK=1`)

| # | Description | Expected |
|---|-------------|----------|
| 12 | Returns issues from mock file | Array length > 0; each item has `number`, `title`, `body`, `labels` |
| 13 | `labels` is always an array of strings | Every label in every issue is a `string` |

### `fetchIssues` tests — live API path (injected fake Octokit)

Build a minimal fake Octokit object with a `rest.issues.listForRepo` stub.

| # | Description | Fake behaviour | Expected |
|---|-------------|----------------|----------|
| 14 | Maps response fields correctly | Returns one issue with all fields | Result issue has matching `number`, `title`, `body`, `labels` |
| 15 | Truncates body to 2000 chars | Body is 3000 chars long | `body.length === 2000` |
| 16 | Normalises string labels | Label is a plain string `"bug"` | `labels` contains `"bug"` |
| 17 | Normalises object labels | Label is `{ name: "bug" }` | `labels` contains `"bug"` |
| 18 | Object label with null name | Label is `{ name: null }` | `labels` contains `""` |
| 19 | API throws | `listForRepo` rejects with `new Error("rate limited")` | Returns `{ error: "rate limited", issues: [] }` |

---

## `src/index.test.ts`

Mock `fetchIssues` and `triageIssues` using `node:test`'s `mock.module()` to avoid any real I/O. Use a temp directory for `output.txt` so tests don't pollute the repo.

| # | Description | Mocked behaviour | Expected |
|---|-------------|------------------|----------|
| 20 | `fetchIssues` returns error | `{ error: "network error", issues: [] }` | Logs error, returns early, no file written |
| 21 | `triageIssues` returns error | fetch succeeds; triage returns `{ error: "API down", issues: [] }` | Logs triage error, returns early, no file written |
| 22 | Both succeed | fetch + triage both return valid data | Writes `output.txt` with correct content |
| 23 | Output file format | Same success case | File starts with `=== Triage Results ===` and contains `#<number>` entries |

---

## `package.json` Changes

### Add `tsx` as a dev dependency

`tsx` is used to run TypeScript test files via Node's `--import` flag during development (faster feedback without a full compile step). Production tests use the compile-first approach below.

```json
"devDependencies": {
  "tsx": "^4.0.0"
}
```

### Update the `test` script

Two modes:

**CI / full validation** — compile then run:
```json
"test": "npm run build && node --test 'dist/**/*.test.js'"
```

**Development (fast, no compile):**
```json
"test:dev": "node --import tsx/esm --test 'src/**/*.test.ts'"
```

---

## Implementation Order

1. Refactor `src/triage.ts` (export `formatIssues`, inject client)
2. Refactor `src/github.ts` (inject Octokit)
3. Refactor `src/index.ts` (guard auto-invocation)
4. Write `src/triage.test.ts`
5. Write `src/github.test.ts`
6. Write `src/index.test.ts`
7. Update `package.json` (add `tsx`, update `test` script)
8. Run `npm test` and confirm all tests pass

---

## What Is Not Covered

- The SYSTEM_PROMPT constant — its content is a product decision, not a unit of logic.
- Integration tests against the real GitHub API or real Anthropic API.
- End-to-end tests of the compiled binary.
