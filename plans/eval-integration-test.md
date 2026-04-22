# Plan: Eval Integration Test for Anthropic Triage

## Goal

Create a repeatable eval that sends a single real issue through the live Anthropic API and checks whether the model's `category` and `status` match the expected ground-truth labels from `mock/issues.json`. Run 3 times to surface prompt inconsistency.

---

## Test case

**Issue #36318** — *useOptimistic fails with overlapping async actions*
- Expected `category`: `"bug"`
- Expected `status`: `"actionable"`

Chosen because it is a well-described, self-contained bug report with reproduction steps — the model should classify it unambiguously and consistently.

---

## Assertions per run

| Assertion | Check |
|-----------|-------|
| No API error | `result.error` is undefined |
| Exactly 1 issue returned | `result.issues.length === 1` |
| `category` matches ground truth | `issue.category === "bug"` |
| `status` matches ground truth | `issue.status === "actionable"` |
| Non-empty summary | `issue.summary.length > 0` |

Each run logs the model's `category`, `status`, and `summary` to stdout for manual inspection.

---

## Files changed

| File | Change |
|------|--------|
| `src/triage.eval.test.ts` | New eval test file — 3 `it()` blocks, one per run |
| `package.json` | Add `"test:eval"` script |

---

## Running the eval

```bash
# Requires ANTHROPIC_API_KEY to be set
npm run test:eval
```

Script: `node --import tsx/esm --test 'src/**/*.eval.test.ts'`

> **Note:** Each run makes one live Anthropic API call. Three runs = three billed requests.

---

## Acceptance criteria

- All 3 runs pass with correct `category` and `status`
- If any run fails, it surfaces the actual vs expected values in the assertion message
- Test is isolated: does not depend on `USE_MOCK`, does not write files, leaves no side effects
