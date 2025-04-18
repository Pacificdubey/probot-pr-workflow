import type { Probot, Context } from "probot";

export default (app: Probot) => {
  app.log.info("Yay! The app was loaded!");

  // Handler for when a pull request is opened
  app.on("pull_request.opened", async (context: Context) => {
    return context.octokit.issues.createComment(
      context.issue({
        body: "🚀 Thanks for opening this pull request! We are reviewing it. Stay tuned! 👀"
      })
    );
  });

  // Handler for when someone comments "deploy" on a pull request
  app.on("issue_comment.created", async (context: Context<"issue_comment.created">) => {
    const commentBody = context.payload.comment.body.toLowerCase();
    const isPullRequest = !!context.payload.issue.pull_request;

    if (isPullRequest && commentBody === "deploy") {
      const workflowFileName = "deploy.yml"; // Replace with your workflow file name
      const owner = context.payload.repository.owner.login;
      const repo = context.payload.repository.name;
      const prNumber = context.payload.issue.number; // Pull request number
       // Fetch the full pull request details
    const { data: pullRequest } = await context.octokit.pulls.get({
      owner,
      repo,
      pull_number: prNumber
    });

  const ref = pullRequest.head.ref; // Branch name of the PR

      await context.octokit.actions.createWorkflowDispatch({
        owner,
        repo,
        workflow_id: workflowFileName,
        ref, // Trigger the workflow on the PR branch
        inputs: {
          pr_number: context.payload.issue.number.toString(), // Pass the PR number as input
          comment_author: context.payload.comment.user.login // Pass the comment author as input
        }
      });

      return context.octokit.issues.createComment(
        context.issue({
          body: "🚀 Deployment workflow has been triggered! 🎉"
        })
      );
    }
  });
};