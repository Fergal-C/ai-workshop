import { fetchIssues } from "./github.js";
import { triageIssues } from "./triage.js";

export async function main(): Promise<void> {
  const result = await fetchIssues();

  if ("error" in result) {
    console.error("Failed to fetch issues:", result.error);
    return;
  }

  console.log(`Fetched ${result.issues.length} issues. Running triage...`);

  const triageResult = await triageIssues(result.issues);

  if (triageResult.error) {
    console.error("Triage failed:", triageResult.error);
    return;
  }

  console.log("\n=== Triage Results ===\n");

  for (const issue of triageResult.issues) {
    console.log(`#${issue.number} [${issue.category}] [${issue.status}] — ${issue.title}`);
    console.log(`  ${issue.summary}`);
    console.log();
  }
}

main();
