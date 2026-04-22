# Bug Triage Bot — Implementation Task List

## Phase 0 — Project Setup

- [ ] Initialize a Node.js/TypeScript project (`npm init`, `tsconfig.json`)
- [ ] Install dependencies: `@anthropic-ai/sdk`, `zod`, `@octokit/rest`
- [ ] Add a `.env` file (or env config) for `ANTHROPIC_API_KEY` and `GITHUB_TOKEN`
- [ ] Create `src/index.ts` as the entry point

---

## Phase 1 — Pull Issues from GitHub (Step 1)

- [ ] Instantiate an Octokit REST client using `GITHUB_TOKEN`
- [ ] Implement `fetchIssues()` to call `GET /repos/facebook/react/issues` with params: `state: "open"`, `sort: "created"`, `direction: "desc"`, `per_page: 10`
- [ ] Extract `number`, `title`, `body` (truncated to 2000 chars), and `labels` from each issue
- [ ] Handle API errors: catch exceptions and return `{ error: string, issues: [] }`
- [ ] Handle partial results: process whatever count is returned if fewer than 10 issues come back

---

## Phase 2 — Categorize Issues (Step 2)

- [ ] Define the three categories: `bug`, `feature`, `other`
- [ ] Write categorization logic/prompt instructions that use title + body as primary signal
- [ ] Include label hints (`Type:` labels) as secondary signal only
- [ ] Handle ambiguous issues: prefer `bug` when framed as broken behaviour, `feature` when framed as missing capability

---

## Phase 3 — Filter Issues (Step 3)

- [ ] Define `actionable` vs `noise` classification
- [ ] Implement actionable signals: expected vs actual behaviour, reproduction case, version reference, concrete feature proposal
- [ ] Implement noise signals: empty/template body, usage question, suspected duplicate, missing reproduction, `Resolution:` labels, unanswered maintainer follow-ups
- [ ] Apply `other` category rule: noise by default unless it identifies a docs gap that causes misuse
- [ ] Apply tiebreaker: when signals conflict, prefer `noise`

---

## Phase 4 — Summarize Issues (Step 4)

- [ ] Write summary prompt instructions for 1–2 sentence format
- [ ] First sentence: plain-language description of the problem/request (not a restatement of the title)
- [ ] Second sentence (actionable): highlight the most useful contributor detail
- [ ] Second sentence (noise): state the disqualifying reason clearly
- [ ] Enforce third-person, present-tense style

---

## Phase 5 — Structured Output Schema

- [ ] Define `TriageResultSchema` using Zod:
  - [ ] `error?: string`
  - [ ] `issues: Array<{ number, title, category, status, summary }>`
- [ ] Wire up `client.messages.parse()` with `output_config` to enforce the schema
- [ ] Validate that all fetched issues appear in the output array
- [ ] Ensure `error` is only populated when Step 1 fails, with `issues: []`

---

## Phase 6 — Integration & Testing

- [ ] Wire all phases together in `src/index.ts`
- [ ] Run end-to-end against live `facebook/react` issues and inspect output
- [ ] Verify categorization accuracy on a sample of issues
- [ ] Verify noise/actionable classification against manual review
- [ ] Test error path by simulating a bad GitHub token or network failure
