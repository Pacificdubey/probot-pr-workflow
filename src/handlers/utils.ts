// handlers/utils.ts

export const deploymentAuthorMap = new Map<string, string>();

export function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
