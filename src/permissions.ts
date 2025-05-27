import { Context } from "probot";
import { minimatch } from "minimatch";

export async function isDeploymentAllowed(
  context: Context,
  config: any,
  environment: string,
  branch: string,
  user: string
): Promise<{ allowed: boolean; reason?: string }> {
  const envTarget = config.environment_targets?.[environment];
  if (!envTarget) {
    return { allowed: false, reason: `Environment ${environment} not defined.` };
  }

  const allowedBranches: string[] = envTarget.branches || [];
  const allowedUsers: string[] = envTarget.users || config.permissions?.users || [];
  const allowedTeams: string[] = envTarget.teams || config.permissions?.teams || [];

  if (allowedBranches.length && !allowedBranches.some(p => minimatch(branch, p))) {
    return { allowed: false, reason: `Branch ${branch} not allowed for ${environment}.` };
  }

  if (allowedUsers.includes(user)) return { allowed: true };

  for (const team of allowedTeams) {
    try {
      await context.octokit.teams.getMembershipForUserInOrg({
        org: context.repo().owner,
        team_slug: team,
        username: user
      });
      return { allowed: true };
    } catch {
      continue;
    }
  }

  return { allowed: false, reason: `User ${user} not permitted to deploy.` };
}
