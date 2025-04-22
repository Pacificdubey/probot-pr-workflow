// handlers/deploymentStatusHandler.ts

import type { Context, Probot } from "probot";
import { deploymentAuthorMap } from "./utils";

export async function handleDeploymentStatus(app: Probot, context: Context<"deployment_status.created">) {
  const deploymentState = context.payload.deployment_status.state;
  const environment = context.payload.deployment.environment;
  const owner = context.payload.repository.owner.login;
  const repo = context.payload.repository.name;
  const sha = context.payload.deployment.sha;
  const deploymentId = context.payload.deployment.id;
  const ref = context.payload.deployment.ref;

  app.log.warn(`🔔 Deployment status received: ${deploymentState} for ${environment}`);

  if (deploymentState === "in_progress") {
    app.log.warn("⏳ Deployment still in progress...");
    return;
  }

  // Get associated PRs for this commit
  const prs = await context.octokit.repos.listPullRequestsAssociatedWithCommit({
    owner,
    repo,
    commit_sha: sha
  });

  const pr = prs.data[0];
  if (!pr) {
    app.log.error("❌ No associated PR found for commit.");
    return;
  }

  const prNumber = pr.number;

  // Now check if this deployment is the latest for the environment
  const allStatuses = await context.octokit.repos.listDeploymentStatuses({
    owner,
    repo,
    deployment_id: deploymentId,
    per_page: 5
  });

  const latestStatus = allStatuses.data[0];

  if (!latestStatus || latestStatus.state !== deploymentState) {
    app.log.warn(`🛑 Skipping outdated deployment status: ${deploymentState}`);
    return;
  }

  app.log.warn(`🎯 Deployment completed: ${deploymentState} for ${environment}`);

  const actor = deploymentAuthorMap.get(ref) || context.payload.deployment.creator.login;

  const resultTitle = deploymentState === "success" ? "✅ **Deployment Results**" : "❌ **Deployment Results**";
  const resultBody = deploymentState === "success"
    ? `${actor} successfully deployed branch \`${ref}\` to **${environment}** 🚀`
    : `${actor} failed to deploy branch \`${ref}\` to **${environment}** ❌`;

  await context.octokit.issues.createComment({
    owner,
    repo,
    issue_number: prNumber,
    body: `## ${resultTitle}\n${resultBody}`
  });

  app.log.warn(`🎯 Deployment result comment posted to PR #${prNumber}`);
}
