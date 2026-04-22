import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "fs";
import { resolve } from "path";
import { triageIssues } from "./triage.js";

const EVAL_RUNS = 3;
const ISSUE_NUMBER = 36318;

interface MockIssue {
  number: number;
  title: string;
  body: string;
  labels: string[];
  category: "bug" | "feature" | "other";
  status: "actionable" | "noise";
  summary: string;
}

const mockData: MockIssue[] = JSON.parse(
  readFileSync(resolve("mock/issues.json"), "utf-8")
);

const expected = mockData.find((i) => i.number === ISSUE_NUMBER)!;
const testInput = [
  {
    number: expected.number,
    title: expected.title,
    body: expected.body,
    labels: expected.labels,
  },
];

describe(`Eval: triageIssues live API — issue #${ISSUE_NUMBER} (${EVAL_RUNS} runs)`, () => {
  let prevMock: string | undefined;

  before(() => {
    prevMock = process.env.USE_MOCK;
    delete process.env.USE_MOCK;
  });

  after(() => {
    if (prevMock !== undefined) process.env.USE_MOCK = prevMock;
  });

  for (let run = 1; run <= EVAL_RUNS; run++) {
    it(`run ${run}/${EVAL_RUNS}: classifies issue #${ISSUE_NUMBER} as ${expected.category}/${expected.status}`, async () => {
      const result = await triageIssues(testInput);

      assert.ok(!result.error, `API error on run ${run}: ${result.error}`);
      assert.equal(result.issues.length, 1, "Expected exactly 1 issue in result");

      const issue = result.issues[0];

      assert.equal(
        issue.category,
        expected.category,
        `Run ${run}: expected category "${expected.category}", got "${issue.category}"`
      );
      assert.equal(
        issue.status,
        expected.status,
        `Run ${run}: expected status "${expected.status}", got "${issue.status}"`
      );
      assert.ok(issue.summary.length > 0, "Summary should be non-empty");

      console.log(`  [run ${run}] category=${issue.category} status=${issue.status}`);
      console.log(`  [run ${run}] summary: ${issue.summary}`);
    });
  }
});
