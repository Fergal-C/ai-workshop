import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, rmSync } from "fs";
import { main } from "./index.js";

const OUTPUT_FILE = "output.txt";

const successFetch = async () => ({
  issues: [{ number: 1, title: "Bug title", body: "body", labels: [] }],
});

const successTriage = async () => ({
  issues: [{
    number: 1,
    title: "Bug title",
    category: "bug" as const,
    status: "actionable" as const,
    summary: "A short summary.",
  }],
});

describe("main", () => {
  let errors: string[] = [];
  let logs: string[] = [];
  const origError = console.error;
  const origLog = console.log;

  beforeEach(() => {
    errors = [];
    logs = [];
    console.error = (...args: unknown[]) => errors.push(args.map(String).join(" "));
    console.log = (...args: unknown[]) => logs.push(args.map(String).join(" "));
  });

  afterEach(() => {
    console.error = origError;
    console.log = origLog;
  });

  it("logs an error and returns early when fetchIssues fails", async () => {
    await main(
      async () => ({ error: "network error", issues: [] }),
      successTriage,
    );
    assert.ok(errors.some((e) => e.includes("network error")), "expected error log");
    assert.equal(logs.length, 0, "should not log progress");
  });

  it("logs an error and returns early when triageIssues fails", async () => {
    await main(
      successFetch,
      async () => ({ error: "API down", issues: [] }),
    );
    assert.ok(errors.some((e) => e.includes("API down")), "expected triage error log");
  });

  it("writes output.txt when both steps succeed", async () => {
    if (existsSync(OUTPUT_FILE)) rmSync(OUTPUT_FILE);
    await main(successFetch, successTriage);
    assert.ok(existsSync(OUTPUT_FILE), "output.txt should be created");
    rmSync(OUTPUT_FILE);
  });

  it("output.txt starts with the results header and contains the issue entry", async () => {
    if (existsSync(OUTPUT_FILE)) rmSync(OUTPUT_FILE);
    await main(successFetch, successTriage);
    const content = readFileSync(OUTPUT_FILE, "utf-8");
    assert.ok(content.startsWith("=== Triage Results ==="), "missing header");
    assert.ok(content.includes("#1"), "missing issue entry");
    rmSync(OUTPUT_FILE);
  });
});
