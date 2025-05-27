import { Context } from "probot";

export async function checkOngoingDeployment(context: Context, environment: string): Promise<boolean> {
  const { owner, repo } = context.repo();
  const deployments = await context.octokit.repos.listDeployments({ owner, repo, environment, per_page: 5 });

  for (const dep of deployments.data) {
    const statuses = await context.octokit.repos.listDeploymentStatuses({ owner, repo, deployment_id: dep.id });
    const status = statuses.data[0];
    if (status?.state === "in_progress" || status?.state === "queued") return true;
  }
  return false;
}

export async function environmentExists(context: Context, env: string): Promise<boolean> {
  const envs = await context.octokit.repos.getAllEnvironments(context.repo());
  const available = envs.data.environments ?? [];
  return available.map(e => e.name.toLowerCase()).includes(env.toLowerCase());
}
