import { fetchIssues } from "./github.js";

export async function main(): Promise<void> {
  const result = await fetchIssues();

  if ("error" in result) {
    console.error("Failed to fetch issues:", result.error);
    return;
  }

  console.log(`Fetched ${result.issues.length} issue(s):\n`);
  for (const issue of result.issues) {
    console.log(`#${issue.number} — ${issue.title}`);
    console.log(`  Labels: ${result.issues.length > 0 && issue.labels.length > 0 ? issue.labels.join(", ") : "(none)"}`);
    console.log(`  Body preview: ${issue.body.slice(0, 120).replace(/\n/g, " ")}...`);
    console.log();
  }
}

main();
