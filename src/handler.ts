import { Probot } from "probot";
import { createLambdaFunction } from "@probot/adapter-aws-lambda-serverless";
import app from "./app";
import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";

const log = (...args: any[]) => console.log("[INIT]", ...args);
const ssm = new SSMClient({ region: process.env.AWS_REGION || "us-east-1" });

async function getParameter(name: string): Promise<string> {
  const command = new GetParameterCommand({
    Name: name,
    WithDecryption: true,
  });
  try {
    const response = await ssm.send(command);
    if (!response.Parameter?.Value) {
      throw new Error(`Missing value for SSM parameter: ${name}`);
    }
    return response.Parameter.Value;
  } catch (err) {
    log(`❌ Error fetching ${name} from SSM`, err);
    throw err;
  }
}

async function getProbotOptions() {
  const paramPrefix = process.env.PROBOT_PARAM_PREFIX || "/bot/probot";

  const [appId, webhookSecret, privateKey] = await Promise.all([
    getParameter(`${paramPrefix}/APP_ID`),
    getParameter(`${paramPrefix}/WEBHOOK_SECRET`),
    getParameter(`${paramPrefix}/PRIVATE_KEY`)
  ]);
  if (!appId || !webhookSecret || !privateKey) {
    log("Missing required Probot parameters from SSM");
  }
  log("🔍 Raw appId from SSM:", appId);
  log("appId raw type:", typeof appId);
  log("appId as JSON:", JSON.stringify(appId));
  const parsedAppId = parseInt(appId.trim(), 10);
   if (isNaN(parsedAppId)) {
     throw new Error(`Invalid appId fetched from SSM: ${appId}`);
  }
  return {
    appId: parseInt(appId, 10),
    privateKey,
    secret: webhookSecret
  };
}

export const handler = async (event: any, context: any) => {
  const probotOptions = await getProbotOptions();
  log("🔧 Probot options:", JSON.stringify(probotOptions, null, 2));
  const probot = new Probot(probotOptions); 
  // const probot = createProbot(probotOptions);
  const lambdaFunction = createLambdaFunction(app, { probot });
  return lambdaFunction(event, context);
};
