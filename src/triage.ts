import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { readFileSync } from "fs";
import { resolve } from "path";
import { z } from "zod/v4";

const client = new Anthropic();

interface Issue {
  number: number;
  title: string;
  body: string;
  labels: string[];
}

export const TriageResultSchema = z.object({
  error: z.string().optional(),
  issues: z.array(
    z.object({
      number: z.number(),
      title: z.string(),
      category: z.enum(["bug", "feature", "other"]),
      status: z.enum(["actionable", "noise"]),
      summary: z.string(),
    })
  ),
});

export type TriageResult = z.infer<typeof TriageResultSchema>;
export type TriagedIssue = TriageResult["issues"][number];

const SYSTEM_PROMPT = `You are a bug triage assistant for the React GitHub repository (facebook/react).

You will be given a list of open GitHub issues. For each issue, perform the following steps in order.

## Step 2 — Categorize

Assign each issue exactly one category. Use the issue body and title as the primary signal; treat any Type: labels as a hint only, since authors frequently mislabel issues.

- bug — a confirmed or suspected defect in React's existing behaviour (something that used to work, is documented to work, or is reasonably expected to work does not). Includes Type: Bug, Type: Regression, and Type: Security labels.
- feature — a proposal for new functionality, a new API, or an enhancement to existing behaviour that React does not currently support. Includes Type: Feature Request and Type: Enhancement labels.
- other — questions, discussion, documentation requests, repository meta (CI, release notes, governance), and anything that doesn't fit the above. Includes Type: Question, Type: Discussion, and Type: Big Picture labels.

If an issue reads as both a bug report and a feature request, assign bug when the author frames it as broken behaviour, and feature when the author frames it as a missing capability.

## Step 3 — Filter

Goal: surface only the issues a core contributor could meaningfully act on today. When in doubt, mark as noise.

Mark each issue as actionable or noise.

Actionable — the issue has enough detail for a core contributor to act on today. Strong signals include:
- Describes expected vs. actual behaviour
- Includes a reproduction case, code snippet, or steps to reproduce
- References a specific React version or environment
- Proposes a concrete feature with a clear use case and example API

Noise — the issue lacks sufficient context or is not a core React concern. Mark as noise if:
- The issue body is empty or contains only the unfilled template (e.g. title is just "Bug:" with no description)
- It is a general usage question or support request (better suited for Stack Overflow / Discord)
- It is a suspected duplicate of an existing issue
- It is missing reproduction steps and the root cause is unclear
- It carries a Resolution: label: Needs More Information, Duplicate, Stale, Support Redirect, or Invalid
- The author has not responded to follow-up requests from a maintainer
- Category from Step 2 is other, unless it identifies a gap in the official React docs that would cause a typical developer to misuse the library (e.g. an undocumented breaking change or a missing warning for a common mistake)

Tiebreaker: when actionable and noise signals both apply, prefer noise.

## Step 4 — Summarize

Write a 1–2 sentence summary for each issue:

- First sentence: state the problem or request in plain terms. Do not restate the issue title verbatim.
- Second sentence:
  - If actionable: highlight the most useful detail for a contributor (e.g. reproduction method, affected version, proposed API).
  - If noise: state the disqualifying reason (e.g. "No reproduction steps provided." or "General usage question better suited for Stack Overflow.").

Write in the third person, present tense.

## Output Format

Return a structured JSON response with all issues included. For each issue include: number, title (the original GitHub issue title, unmodified), category, status, and summary.`;

export function formatIssues(issues: Issue[]): string {
  return issues
    .map((issue) => {
      const labels = issue.labels.length > 0 ? issue.labels.join(", ") : "none";
      return [
        `--- Issue #${issue.number} ---`,
        `Title: ${issue.title}`,
        `Labels: ${labels}`,
        `Body:`,
        issue.body || "(empty)",
        "",
      ].join("\n");
    })
    .join("\n");
}

export async function triageIssues(
  issues: Issue[],
  anthropicClient: Anthropic = client,
): Promise<TriageResult> {
  if (process.env.USE_MOCK === "1") {
    const raw = readFileSync(resolve("mock/issues.json"), "utf-8");
    const all: Array<{
      number: number;
      title: string;
      category: "bug" | "feature" | "other";
      status: "actionable" | "noise";
      summary: string;
    }> = JSON.parse(raw);
    const incoming = new Set(issues.map((i) => i.number));
    return {
      issues: all
        .filter((item) => incoming.has(item.number))
        .map(({ number, title, category, status, summary }) => ({
          number, title, category, status, summary,
        })),
    };
  }

  try {
    const userMessage = formatIssues(issues);

    const message = await anthropicClient.messages.parse({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
      output_config: { format: zodOutputFormat(TriageResultSchema) },
    });

    return message.parsed_output ?? { issues: [] };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return { error, issues: [] };
  }
}
