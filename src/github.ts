import { Octokit } from "@octokit/rest";
import { readFileSync } from "fs";
import { resolve } from "path";

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

interface Issue {
  number: number;
  title: string;
  body: string;
  labels: string[];
}

type FetchIssuesResult =
  | { issues: Issue[] }
  | { error: string; issues: [] };

export async function fetchIssues(): Promise<FetchIssuesResult> {
  if (process.env.USE_MOCK === "1") {
    const raw = readFileSync(resolve("mock/issues.json"), "utf-8");
    const issues: Issue[] = JSON.parse(raw);
    return { issues };
  }

  try {
    const response = await octokit.rest.issues.listForRepo({
      owner: "facebook",
      repo: "react",
      state: "open",
      sort: "created",
      direction: "desc",
      per_page: 10,
    });

    const issues: Issue[] = response.data.map((issue) => ({
      number: issue.number,
      title: issue.title,
      body: (issue.body ?? "").slice(0, 2000),
      labels: issue.labels.map((label) =>
        typeof label === "string" ? label : (label.name ?? "")
      ),
    }));

    return { issues };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { error: message, issues: [] };
  }
}
