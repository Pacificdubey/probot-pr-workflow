// handlers/prOpenedHandler.ts

import type { Context, Probot } from "probot";

export async function handlePrOpened(app: Probot, context: Context<"pull_request.opened">) {
  await context.octokit.issues.createComment(context.issue({
    body: "🚀 Thanks for opening this pull request! We are reviewing it. Stay tuned! 👀"
  }));
}
