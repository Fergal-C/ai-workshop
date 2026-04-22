import { Octokit } from "@octokit/rest";

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
