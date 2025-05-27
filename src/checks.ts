import { Context } from "probot";

export async function validateChecks(context: Context, sha: string, config: any): Promise<string[]> {
  const requiredChecks: string[] = config.checks?.required || [];
  const ignoredChecks: string[] = config.checks?.ignored || [];
  const checksResp = await context.octokit.checks.listForRef({
    ...context.repo(),
    ref: sha
  });

  const checks = checksResp.data.check_runs.map(c => ({
    name: c.name,
    state: c.conclusion === "success" ? "success" : "failure"
  }));

  return requiredChecks.filter(name => {
    if (ignoredChecks.includes(name)) return false;
    const match = checks.find(c => c.name === name);
    return !match || match.state !== "success";
  });
}
