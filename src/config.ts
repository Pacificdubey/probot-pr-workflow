import { Context } from "probot";
import * as toml from "@iarna/toml";

export async function loadConfig(context: Context): Promise<any> {
  const { owner, repo } = context.repo();
  const response = await context.octokit.repos.getContent({
    owner,
    repo,
    path: "config.toml",
    ref: "main"
  });
  const raw = Buffer.from((response.data as any).content, "base64").toString();
  const config = toml.parse(raw);
  context.log.info(`✅ Loaded config.toml:\n${JSON.stringify(config, null, 2)}`);
  return config;
}
