import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { formatIssues, triageIssues } from "./triage.js";

// ---------------------------------------------------------------------------
// formatIssues — pure function, no I/O
// ---------------------------------------------------------------------------

describe("formatIssues", () => {
  it("includes header, title, labels, and body for a single issue", () => {
    const out = formatIssues([{ number: 1, title: "T", body: "B", labels: ["bug"] }]);
    assert.ok(out.includes("--- Issue #1 ---"), "header missing");
    assert.ok(out.includes("Title: T"), "title missing");
    assert.ok(out.includes("Labels: bug"), "labels missing");
    assert.ok(out.includes("Body:"), "Body: label missing");
    assert.ok(out.includes("B"), "body text missing");
  });

  it('shows "none" when labels array is empty', () => {
    const out = formatIssues([{ number: 2, title: "T", body: "B", labels: [] }]);
    assert.ok(out.includes("Labels: none"));
  });

  it('shows "(empty)" when body is an empty string', () => {
    const out = formatIssues([{ number: 3, title: "T", body: "", labels: [] }]);
    assert.ok(out.includes("(empty)"));
  });

  it("formats multiple issues in input order", () => {
    const out = formatIssues([
      { number: 1, title: "First", body: "B1", labels: [] },
      { number: 2, title: "Second", body: "B2", labels: [] },
    ]);
    assert.ok(out.indexOf("Issue #1") < out.indexOf("Issue #2"));
  });
});

// ---------------------------------------------------------------------------
// triageIssues — mock mode (USE_MOCK=1)
// ---------------------------------------------------------------------------

describe("triageIssues (mock mode)", () => {
  let prevMock: string | undefined;

  before(() => {
    prevMock = process.env.USE_MOCK;
    process.env.USE_MOCK = "1";
  });

  after(() => {
    if (prevMock === undefined) delete process.env.USE_MOCK;
    else process.env.USE_MOCK = prevMock;
  });

  it("returns only issues whose numbers match the input", async () => {
    const input = [
      { number: 36318, title: "X", body: "", labels: [] },
      { number: 36321, title: "Y", body: "", labels: [] },
    ];
    const result = await triageIssues(input);
    assert.equal(result.issues.length, 2);
    const numbers = result.issues.map((i) => i.number);
    assert.ok(numbers.includes(36318));
    assert.ok(numbers.includes(36321));
  });

  it("returns empty issues array for empty input", async () => {
    const result = await triageIssues([]);
    assert.deepEqual(result, { issues: [] });
  });

  it("excludes issue numbers not present in the mock file", async () => {
    const result = await triageIssues([{ number: 99999, title: "X", body: "", labels: [] }]);
    assert.equal(result.issues.length, 0);
  });

  it("each returned issue has the required fields with correct types", async () => {
    const result = await triageIssues([{ number: 36318, title: "X", body: "", labels: [] }]);
    assert.equal(result.issues.length, 1);
    const issue = result.issues[0];
    assert.equal(typeof issue.number, "number");
    assert.equal(typeof issue.title, "string");
    assert.ok(["bug", "feature", "other"].includes(issue.category));
    assert.ok(["actionable", "noise"].includes(issue.status));
    assert.equal(typeof issue.summary, "string");
  });
});

// ---------------------------------------------------------------------------
// triageIssues — live API path (injected fake Anthropic client)
// ---------------------------------------------------------------------------

describe("triageIssues (live API path)", () => {
  let prevMock: string | undefined;

  before(() => {
    prevMock = process.env.USE_MOCK;
    delete process.env.USE_MOCK;
  });

  after(() => {
    if (prevMock !== undefined) process.env.USE_MOCK = prevMock;
  });

  const sampleInput = [{ number: 1, title: "T", body: "B", labels: [] }];
  const sampleResult = {
    issues: [{
      number: 1,
      title: "T",
      category: "bug" as const,
      status: "actionable" as const,
      summary: "S",
    }],
  };

  it("returns parsed_output from the API client on success", async () => {
    const fakeClient = {
      messages: { parse: async () => ({ parsed_output: sampleResult }) },
    } as any;
    const result = await triageIssues(sampleInput, fakeClient);
    assert.deepEqual(result, sampleResult);
  });

  it("returns { issues: [] } when parsed_output is null", async () => {
    const fakeClient = {
      messages: { parse: async () => ({ parsed_output: null }) },
    } as any;
    const result = await triageIssues(sampleInput, fakeClient);
    assert.deepEqual(result, { issues: [] });
  });

  it("returns an error object when the API throws", async () => {
    const fakeClient = {
      messages: {
        parse: async () => { throw new Error("timeout"); },
      },
    } as any;
    const result = await triageIssues(sampleInput, fakeClient);
    assert.deepEqual(result, { error: "timeout", issues: [] });
  });
});
