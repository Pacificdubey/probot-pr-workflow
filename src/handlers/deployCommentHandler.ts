// handlers/deployCommentHandler.ts

import type { Context, Probot } from "probot";
import { deploymentAuthorMap, sleep } from "./utils";

export async function handleDeployComment(app: Probot, context: Context<"issue_comment.created">) {
  const body = context.payload.comment.body.toLowerCase();
  const isPR = !!context.payload.issue.pull_request;
  const owner = context.payload.repository.owner.login;
  const repo = context.payload.repository.name;
  const prNumber = context.payload.issue.number;
  const commentAuthor = context.payload.comment.user.login;

  if (!isPR || !body.startsWith("deploy")) return;

  let environment = "dev";
  if (body.startsWith("deploy to")) {
    environment = body.replace("deploy to", "").trim();
  }

  app.log.warn(`🚀 Requested deploy to: ${environment}`);

  if (environment === "prod") {
    await context.octokit.issues.createComment(context.issue({
      body: `❌ Deployment to **prod** is not allowed.`
    }));
    return;
  }

  const envResponse = await context.octokit.repos.getAllEnvironments({ owner, repo });
  const availableEnvs = (envResponse.data.environments ?? []).map(env => env.name.toLowerCase());

  if (!availableEnvs.includes(environment)) {
    await context.octokit.issues.createComment(context.issue({
      body: `❌ Environment **${environment}** does not exist.\n\nAvailable environments: ${availableEnvs.join(", ")}`
    }));
    return;
  }

  const pullRequest = await context.octokit.pulls.get({ owner, repo, pull_number: prNumber });
  const branchRef = pullRequest.data.head.ref;
  const commitSha = pullRequest.data.head.sha;
  deploymentAuthorMap.set(branchRef, commentAuthor);

  const placeholderUrl = `https://github.com/${owner}/${repo}/actions`;
  const triggerComment = await context.octokit.issues.createComment(context.issue({
    body: `## 🚀 **Deployment Triggered**\n${commentAuthor} started a branch deployment to **${environment}** (branch: \`${branchRef}\`).\n\nYou can watch the deployment progress [here](${placeholderUrl}) 🔗\n\n---`
  }));
  const triggerCommentId = triggerComment.data.id;

  try {
    await context.octokit.actions.createWorkflowDispatch({
      owner,
      repo,
      workflow_id: "deploy.yml",
      ref: branchRef,
      inputs: {
        pr_number: prNumber.toString(),
        comment_author: commentAuthor,
        environment: environment
      }
    });
    app.log.warn("🚀 Workflow dispatched successfully.");

  } catch (error) {
    app.log.error(`❌ Workflow dispatch failed: ${(error as Error).message}`);
    await context.octokit.issues.createComment(context.issue({
      body: `## ❌ **Deployment Failed to Start**\n${commentAuthor} attempted to deploy branch \`${branchRef}\` to **${environment}**, but workflow could not start ⚠️`
    }));
    return;
  }

  // Find workflow run
  let workflowRunId: number | null = null;
  let retries = 5;
  while (retries > 0 && !workflowRunId) {
    const runsResponse = await context.octokit.actions.listWorkflowRunsForRepo({
      owner,
      repo,
      event: "workflow_dispatch",
      branch: branchRef,
      per_page: 5
    });

    for (const run of runsResponse.data.workflow_runs) {
      if (run.head_branch === branchRef && run.status !== "completed" && run.triggering_actor?.type === "Bot") {
        workflowRunId = run.id;
        break;
      }
    }

    if (!workflowRunId) {
      app.log.warn(`⏳ No workflow run found yet. Retrying... (${retries} retries left)`);
      await sleep(5000);
      retries--;
    }
  }

  if (!workflowRunId) {
    app.log.error("❌ Could not find workflow run.");
    return;
  }

  const realRunUrl = `https://github.com/${owner}/${repo}/actions/runs/${workflowRunId}`;
  await context.octokit.issues.updateComment({
    owner,
    repo,
    comment_id: triggerCommentId,
    body: `## 🚀 **Deployment Triggered**\n${commentAuthor} started a branch deployment to **${environment}** (branch: \`${branchRef}\`).\n\nYou can watch the deployment progress [here](${realRunUrl}) 🔗\n\n---`
  });

  app.log.warn("🔗 Updated comment with real workflow run URL.");
}
