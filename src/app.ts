import type { Probot, Context } from "probot";
import { loadConfig } from "./config";
import { isDeploymentAllowed } from "./permissions";
import { validateChecks } from "./checks";
import { checkOngoingDeployment, environmentExists } from "./deployment";

let deploymentActor: string | undefined = undefined;

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export default (app: Probot) => {
  app.log.info("🔧 Probot App loaded.");

  app.on("issue_comment.created", async (context) => {
    const body = context.payload.comment.body.trim();
    if (!context.payload.issue.pull_request || !body.toLowerCase().startsWith("deploy")) return;

    const { owner, repo } = context.repo();
    const user = context.payload.comment.user.login;
    const prNumber = context.payload.issue.number;

    const match = body.match(/^\.?deploy(?: to)? ([a-z0-9_-]+)/i);
    const environment = match ? match[1] : "dev";

    const pr = await context.octokit.pulls.get({ owner, repo, pull_number: prNumber });
    const branch = pr.data.head.ref;
    const sha = pr.data.head.sha;

    const config = await loadConfig(context);

    const perm = await isDeploymentAllowed(context, config, environment, branch, user);
    if (!perm.allowed) {
      await context.octokit.issues.createComment(context.issue({ body: `❌ ${perm.reason}` }));
      return;
    }

    const skipCI = config.checks?.skip_ci ?? false;
    if (!skipCI) {
      const failedChecks = await validateChecks(context, sha, config);
      if (failedChecks.length > 0) {
        await context.octokit.issues.createComment(context.issue({
          body: `❌ Deployment blocked. These required checks failed or are missing:\n\n${failedChecks.map(f => `- \`${f}\``).join("\n")}`
        }));
        return;
      }
    }

    if (!(await environmentExists(context, environment))) {
      await context.octokit.issues.createComment(context.issue({
        body: `❌ Environment **${environment}** does not exist in GitHub settings.`
      }));
      return;
    }

    if (await checkOngoingDeployment(context, environment)) {
      await context.octokit.issues.createComment(context.issue({
        body: `⚠️ A deployment to **${environment}** is already in progress. Please wait for it to complete.`
      }));
      return;
    }

    deploymentActor = user;
    const placeholderUrl = `https://github.com/${owner}/${repo}/actions`;
    const triggerComment = await context.octokit.issues.createComment(context.issue({
      body: `## 🚀 **Deployment Triggered**\n${user} started a branch deployment to **${environment}** (branch: \`${branch}\`).\n\nYou can watch the deployment progress [here](${placeholderUrl}) 🔗\n\n---`
    }));
    const triggerCommentId = triggerComment.data.id;

    try {
      await context.octokit.actions.createWorkflowDispatch({
        owner,
        repo,
        workflow_id: "deploy.yml",
        ref: branch,
        inputs: {
          pr_number: prNumber.toString(),
          comment_author: user,
          environment: environment
        }
      });
      app.log.warn("🚀 Workflow dispatched successfully.");
    } catch (error) {
      app.log.error(`❌ Workflow dispatch failed: ${(error as Error).message}`);
      await context.octokit.issues.createComment(context.issue({
        body: `## ❌ **Deployment Failed to Start**\n${user} attempted to deploy branch \`${branch}\` to **${environment}**, but workflow could not start ⚠️`
      }));
      return;
    }

    let workflowRunId: number | null = null;
    let retries = 5;
    while (retries > 0 && !workflowRunId) {
      const runsResponse = await context.octokit.actions.listWorkflowRunsForRepo({
        owner,
        repo,
        event: "workflow_dispatch",
        branch,
        per_page: 5
      });

      for (const run of runsResponse.data.workflow_runs) {
        if (run.head_branch === branch && run.status !== "completed" &&
          (run.triggering_actor?.type === "Bot" || run.triggering_actor?.type === "App")) {
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
      body: `## 🚀 **Deployment Triggered**\n${user} started a branch deployment to **${environment}** (branch: \`${branch}\`).\n\nYou can watch the deployment progress [here](${realRunUrl}) 🔗\n\n---`
    });
    app.log.warn("🔗 Updated comment with real workflow run URL.");
  });

  // app.on("deployment_status.created", async (context) => {
  //   const deploymentState = context.payload.deployment_status.state;
  //   const environment = context.payload.deployment.environment;
  //   const owner = context.payload.repository.owner.login;
  //   const repo = context.payload.repository.name;
  //   const sha = context.payload.deployment.sha;
  //   const deploymentId = context.payload.deployment.id;

  //   app.log.warn(`🔔 Deployment status received: ${deploymentState} for ${environment}`);

  //   if (deploymentState === "in_progress") {
  //     app.log.warn("⏳ Deployment still in progress...");
  //     return;
  //   }

  //   const allStatuses = await context.octokit.repos.listDeploymentStatuses({
  //     owner,
  //     repo,
  //     deployment_id: deploymentId,
  //     per_page: 5
  //   });

  //   const latestStatus = allStatuses.data[0];
  //   if (!latestStatus || latestStatus.state !== deploymentState) {
  //     app.log.warn(`🛑 Skipping outdated deployment status: ${deploymentState}`);
  //     return;
  //   }

  //   const prs = await context.octokit.repos.listPullRequestsAssociatedWithCommit({
  //     owner,
  //     repo,
  //     commit_sha: sha
  //   });

  //   const pr = prs.data[0];
  //   if (!pr) {
  //     app.log.error("❌ No associated PR found for commit.");
  //     return;
  //   }

  //   const prNumber = pr.number;
  //   const actor = deploymentActor || context.payload.deployment.creator.login;
  //   const resultTitle = deploymentState === "success" ? "✅ **Deployment Results**" : "❌ **Deployment Results**";
  //   const resultBody = deploymentState === "success"
  //     ? `${actor} successfully deployed branch \`${context.payload.deployment.ref}\` to **${environment}** 🚀`
  //     : `${actor} failed to deploy branch \`${context.payload.deployment.ref}\` to **${environment}** ❌`;

  //   await context.octokit.issues.createComment({
  //     owner,
  //     repo,
  //     issue_number: prNumber,
  //     body: `## ${resultTitle}\n${resultBody}`
  //   });

  //   app.log.warn(`🎯 Deployment result comment posted to PR #${prNumber}`);
  // });

  app.on("deployment_status.created", async (context) => {
    const deploymentState = context.payload.deployment_status.state;
    const environment = context.payload.deployment.environment;
    const owner = context.payload.repository.owner.login;
    const repo = context.payload.repository.name;
    const sha = context.payload.deployment.sha;
    const deploymentId = context.payload.deployment.id;
    const statusId = context.payload.deployment_status.id;
  
    app.log.warn(`🔔 Deployment status received: ${deploymentState} for ${environment}`);
  
    // ✅ Only act on final states
    if (!["success", "failure"].includes(deploymentState)) {
      app.log.warn(`⏩ Skipping non-final deployment status: ${deploymentState}`);
      return;
    }
  
    // 🛡️ Ensure this status is the latest one for this deployment
    const allStatuses = await context.octokit.repos.listDeploymentStatuses({
      owner,
      repo,
      deployment_id: deploymentId,
      per_page: 5,
    });
  
    const latestStatus = allStatuses.data[0];
    if (!latestStatus || latestStatus.id !== statusId) {
      app.log.warn(`🛑 Skipping outdated deployment status: ${deploymentState}`);
      return;
    }
  
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
    const actor = deploymentActor || context.payload.deployment.creator.login;
    const resultTitle = deploymentState === "success" ? "✅ **Deployment Results**" : "❌ **Deployment Results**";
    const resultBody = deploymentState === "success"
      ? `${actor} successfully deployed branch \`${context.payload.deployment.ref}\` to **${environment}** 🚀`
      : `${actor} failed to deploy branch \`${context.payload.deployment.ref}\` to **${environment}** ❌`;
  
    await context.octokit.issues.createComment({
      owner,
      repo,
      issue_number: prNumber,
      body: `## ${resultTitle}\n${resultBody}`
    });
  
    app.log.warn(`🎯 Deployment result comment posted to PR #${prNumber}`);
  });
};
