// app.ts

import type { Probot } from "probot";
import { handlePrOpened } from "./handlers/prOpenedHandler";
import { handleDeployComment } from "./handlers/deployCommentHandler";
import { handleDeploymentStatus } from "./handlers/deploymentStatusHandler";

export default (app: Probot) => {
  app.log.warn("🚀 App loaded successfully!");

  app.on("pull_request.opened", async (context) => {
    await handlePrOpened(app, context);
  });

  app.on("issue_comment.created", async (context) => {
    await handleDeployComment(app, context);
  });

  app.on("deployment_status.created", async (context) => {
    await handleDeploymentStatus(app, context);
  });
};
