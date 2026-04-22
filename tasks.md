# Bug Triage Bot — Implementation Task List

## Phase 0 — Project Setup

- [x] Initialize a Node.js/TypeScript project (`npm init`, `tsconfig.json`)
- [x] Install dependencies: `@anthropic-ai/sdk`, `zod`, `@octokit/rest`
- [x] Add a `.env` file (or env config) for `ANTHROPIC_API_KEY` and `GITHUB_TOKEN`
- [x] Create `src/index.ts` as the entry point

---

## Phase 1 — Pull Issues from GitHub (Step 1)

- [x] Instantiate an Octokit REST client using `GITHUB_TOKEN`
- [x] Implement `fetchIssues()` to call `GET /repos/facebook/react/issues` with params: `state: "open"`, `sort: "created"`, `direction: "desc"`, `per_page: 10`
- [x] Extract `number`, `title`, `body` (truncated to 2000 chars), and `labels` from each issue
- [x] Handle API errors: catch exceptions and return `{ error: string, issues: [] }`
- [x] Handle partial results: process whatever count is returned if fewer than 10 issues come back

---

## Phase 2 — Categorize Issues (Step 2)

- [x] Define the three categories: `bug`, `feature`, `other`
- [x] Write categorization logic/prompt instructions that use title + body as primary signal
- [x] Include label hints (`Type:` labels) as secondary signal only
- [x] Handle ambiguous issues: prefer `bug` when framed as broken behaviour, `feature` when framed as missing capability

---

## Phase 3 — Filter Issues (Step 3)

- [x] Define `actionable` vs `noise` classification
- [x] Implement actionable signals: expected vs actual behaviour, reproduction case, version reference, concrete feature proposal
- [x] Implement noise signals: empty/template body, usage question, suspected duplicate, missing reproduction, `Resolution:` labels, unanswered maintainer follow-ups
- [x] Apply `other` category rule: noise by default unless it identifies a docs gap that causes misuse
- [x] Apply tiebreaker: when signals conflict, prefer `noise`

---

## Phase 4 — Summarize Issues (Step 4)

- [x] Write summary prompt instructions for 1–2 sentence format
- [x] First sentence: plain-language description of the problem/request (not a restatement of the title)
- [x] Second sentence (actionable): highlight the most useful contributor detail
- [x] Second sentence (noise): state the disqualifying reason clearly
- [x] Enforce third-person, present-tense style

---

## Phase 5 — Structured Output Schema

- [x] Define `TriageResultSchema` using Zod:
  - [x] `error?: string`
  - [x] `issues: Array<{ number, title, category, status, summary }>`
- [x] Wire up `client.messages.parse()` with `output_config` to enforce the schema
- [x] Validate that all fetched issues appear in the output array
- [x] Ensure `error` is only populated when Step 1 fails, with `issues: []`

---

## Phase 6 — Integration & Testing

- [x] Wire all phases together in `src/index.ts`
- [ ] Run end-to-end against live `facebook/react` issues and inspect output
- [ ] Verify categorization accuracy on a sample of issues
- [ ] Verify noise/actionable classification against manual review
- [ ] Test error path by simulating a bad GitHub token or network failure
