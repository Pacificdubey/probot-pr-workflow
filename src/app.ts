// app.ts
import type { Probot, Context } from "probot";


const deploymentAuthorMap = new Map<string, string>();

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export default (app: Probot) => {
  app.log.warn("🚀 App loaded successfully!");

  // 1. Handle PR Opened
  app.on("pull_request.opened", async (context: Context) => {
    await context.octokit.issues.createComment(context.issue({
      body: "🚀 Thanks for opening this pull request! We are reviewing it. Stay tuned! 👀"
    }));
  });

  // 2. Handle 'deploy' comment
  app.on("issue_comment.created", async (context: Context<"issue_comment.created">) => {
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

    // Check if trying to deploy to 'prod'
    if (environment === "prod") {
      await context.octokit.issues.createComment(context.issue({
        body: `❌ Deployment to **prod** is not allowed.`
      }));
      return;
    }

    // Fetch available environments
    const envResponse = await context.octokit.repos.getAllEnvironments({ owner, repo });
    const availableEnvs = (envResponse.data.environments ?? []).map(env => env.name.toLowerCase());

    if (!availableEnvs.includes(environment)) {
      await context.octokit.issues.createComment(context.issue({
        body: `❌ Environment **${environment}** does not exist.\n\nAvailable environments: ${availableEnvs.join(", ")}`
      }));
      return;
    }

    // Fetch PR info
    const pullRequest = await context.octokit.pulls.get({ owner, repo, pull_number: prNumber });
    const branchRef = pullRequest.data.head.ref;
    const commitSha = pullRequest.data.head.sha;
    deploymentAuthorMap.set(branchRef, commentAuthor); // Save author for later use

    // Post 'Deployment Triggered' comment
    const placeholderUrl = `https://github.com/${owner}/${repo}/actions`;
    const triggerComment = await context.octokit.issues.createComment(context.issue({
      body: `## 🚀 **Deployment Triggered**\n${commentAuthor} started a branch deployment to **${environment}** (branch: \`${branchRef}\`).\n\nYou can watch the deployment progress [here](${placeholderUrl}) 🔗\n\n---`
    }));
    const triggerCommentId = triggerComment.data.id;

    // trigger workflow
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
    }

    // Wait and find workflow run
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
    
      // Update previous comment with real workflow run URL
      await context.octokit.issues.updateComment({
        owner,
        repo,
        comment_id: triggerCommentId,
        body: `## 🚀 **Deployment Triggered**\n${commentAuthor} started a branch deployment to **${environment}** (branch: \`${branchRef}\`).\n\nYou can watch the deployment progress [here](${realRunUrl}) 🔗\n\n---`
      });
    
      app.log.warn("🔗 Updated comment with real workflow run URL.");
    });


  // 3. Handle deployment status webhook (new event)
  app.on("deployment_status.created", async (context: Context<"deployment_status.created">) => {
    const deploymentState = context.payload.deployment_status.state; // success / failure / in_progress
    const environment = context.payload.deployment.environment;
    const deploymentUrl = context.payload.deployment_status.environment_url;
    const owner = context.payload.repository.owner.login;
    const repo = context.payload.repository.name;
    const sha = context.payload.deployment.sha;
    const deploymentId = context.payload.deployment.id;

    app.log.warn(`🔔 Deployment status received: ${deploymentState} for ${environment}`);

    if (deploymentState === "in_progress") {
      // Do nothing yet — wait for success/failure
      app.log.warn("⏳ Deployment still in progress...");
      return;
    }

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

    // Find PR associated with commit
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
    //const shortSha = sha.substring(0, 7);
    const actor = deploymentAuthorMap.get(context.payload.deployment.ref) || context.payload.deployment.creator.login; // Use saved author if possible

    const resultTitle = deploymentState === "success" ? "✅ **Deployment Results**" : "❌ **Deployment Results**";
    const resultBody = deploymentState === "success"
      ? `${actor} successfully deployed branch \`${context.payload.deployment.ref}\` to **${environment}** 🚀`
      : `${actor} failed to deploy branch \`${context.payload.deployment.ref}\` to **${environment}** ❌`;

    // Post result comment
    await context.octokit.issues.createComment({
      owner,
      repo,
      issue_number: prNumber,
      body: `## ${resultTitle}\n${resultBody}`
    });

    app.log.warn(`🎯 Deployment result comment posted to PR #${prNumber}`);
  });
};
