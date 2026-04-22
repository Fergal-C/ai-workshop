import { fetchIssues as defaultFetchIssues } from "./github.js";
import { triageIssues as defaultTriageIssues } from "./triage.js";
import { writeFileSync } from "fs";
import { fileURLToPath } from "url";

export async function main(
  fetchFn: typeof defaultFetchIssues = defaultFetchIssues,
  triageFn: typeof defaultTriageIssues = defaultTriageIssues,
): Promise<void> {
  const result = await fetchFn();

  if ("error" in result) {
    console.error("Failed to fetch issues:", result.error);
    return;
  }

  console.log(`Fetched ${result.issues.length} issues. Running triage...`);

  const triageResult = await triageFn(result.issues);

  if (triageResult.error) {
    console.error("Triage failed:", triageResult.error);
    return;
  }

  const lines: string[] = ["=== Triage Results ===", ""];

  for (const issue of triageResult.issues) {
    lines.push(`#${issue.number} [${issue.category}] [${issue.status}] — ${issue.title}`);
    lines.push(`  ${issue.summary}`);
    lines.push("");
  }

  const output = lines.join("\n");
  console.log("\n" + output);

  const outFile = "output.txt";
  writeFileSync(outFile, output);
  console.log(`Results saved to ${outFile}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
