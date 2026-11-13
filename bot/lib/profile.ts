import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const bundledProfilePath = path.resolve(here, "../sandbox/workspace/profile.md");

export async function loadProfileMarkdown(workspaceProfile?: string): Promise<string> {
  if (workspaceProfile?.trim()) return workspaceProfile.trim();
  try {
    return (await readFile(bundledProfilePath, "utf8")).trim();
  } catch {
    return "Profile unavailable. Ask Marcos to update bot/sandbox/workspace/profile.md.";
  }
}

export function profileSnippet(profile: string, max = 2500): string {
  return profile.length <= max ? profile : `${profile.slice(0, max)}…`;
}
