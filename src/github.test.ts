import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { fetchIssues } from "./github.js";

// ---------------------------------------------------------------------------
// fetchIssues — mock mode (USE_MOCK=1)
// ---------------------------------------------------------------------------

describe("fetchIssues (mock mode)", () => {
  let prevMock: string | undefined;

  before(() => {
    prevMock = process.env.USE_MOCK;
    process.env.USE_MOCK = "1";
  });

  after(() => {
    if (prevMock === undefined) delete process.env.USE_MOCK;
    else process.env.USE_MOCK = prevMock;
  });

  it("returns a non-empty issues array with the correct shape", async () => {
    const result = await fetchIssues();
    assert.ok("issues" in result, "result should have issues key");
    assert.ok(result.issues.length > 0, "issues array should be non-empty");
    for (const issue of result.issues) {
      assert.equal(typeof issue.number, "number");
      assert.equal(typeof issue.title, "string");
      assert.equal(typeof issue.body, "string");
      assert.ok(Array.isArray(issue.labels));
    }
  });

  it("all labels are strings", async () => {
    const result = await fetchIssues();
    assert.ok("issues" in result);
    for (const issue of result.issues) {
      for (const label of issue.labels) {
        assert.equal(typeof label, "string");
      }
    }
  });
});

// ---------------------------------------------------------------------------
// fetchIssues — live API path (injected fake Octokit)
// ---------------------------------------------------------------------------

describe("fetchIssues (live API path)", () => {
  let prevMock: string | undefined;

  before(() => {
    prevMock = process.env.USE_MOCK;
    delete process.env.USE_MOCK;
  });

  after(() => {
    if (prevMock !== undefined) process.env.USE_MOCK = prevMock;
  });

  function makeOctokit(data: unknown[]): any {
    return {
      rest: {
        issues: {
          listForRepo: async () => ({ data }),
        },
      },
    };
  }

  it("maps number, title, body, and labels from the response", async () => {
    const fake = makeOctokit([{
      number: 42,
      title: "Fix bug",
      body: "Details here",
      labels: [{ name: "bug" }],
    }]);
    const result = await fetchIssues(fake);
    assert.ok("issues" in result);
    assert.equal(result.issues.length, 1);
    assert.equal(result.issues[0].number, 42);
    assert.equal(result.issues[0].title, "Fix bug");
    assert.equal(result.issues[0].body, "Details here");
    assert.deepEqual(result.issues[0].labels, ["bug"]);
  });

  it("truncates body to 2000 characters", async () => {
    const fake = makeOctokit([{
      number: 1,
      title: "T",
      body: "x".repeat(3000),
      labels: [],
    }]);
    const result = await fetchIssues(fake);
    assert.ok("issues" in result);
    assert.equal(result.issues[0].body.length, 2000);
  });

  it("normalises a string label directly", async () => {
    const fake = makeOctokit([{ number: 1, title: "T", body: "", labels: ["bug"] }]);
    const result = await fetchIssues(fake);
    assert.ok("issues" in result);
    assert.deepEqual(result.issues[0].labels, ["bug"]);
  });

  it("normalises an object label using its name property", async () => {
    const fake = makeOctokit([{ number: 1, title: "T", body: "", labels: [{ name: "enhancement" }] }]);
    const result = await fetchIssues(fake);
    assert.ok("issues" in result);
    assert.deepEqual(result.issues[0].labels, ["enhancement"]);
  });

  it("uses empty string for an object label with null name", async () => {
    const fake = makeOctokit([{ number: 1, title: "T", body: "", labels: [{ name: null }] }]);
    const result = await fetchIssues(fake);
    assert.ok("issues" in result);
    assert.deepEqual(result.issues[0].labels, [""]);
  });

  it("returns an error object when the API throws", async () => {
    const fake = {
      rest: {
        issues: {
          listForRepo: async () => { throw new Error("rate limited"); },
        },
      },
    };
    const result = await fetchIssues(fake as any);
    assert.deepEqual(result, { error: "rate limited", issues: [] });
  });
});
