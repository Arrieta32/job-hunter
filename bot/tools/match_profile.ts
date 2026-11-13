import { defineTool } from "@grok/agent-sdk/tools";
import * as z from "zod/v4";
import { rankJobAgainstProfile } from "../lib/jobs.js";
import { loadProfileMarkdown, profileSnippet } from "../lib/profile.js";

export default defineTool({
  description:
    "Score one job against Marcos's profile.md and return fit reasons / gaps. Read-only.",
  execution: "server",
  effect: "read",
  inputSchema: z.object({
    title: z.string(),
    company: z.string(),
    location: z.string().optional(),
    url: z.string().optional(),
    tags: z.array(z.string()).optional(),
    description: z.string().optional(),
  }),
  async execute(job) {
    const profile = await loadProfileMarkdown();
    const ranking = rankJobAgainstProfile(
      {
        title: job.title,
        company: job.company,
        location: job.location ?? "",
        tags: job.tags,
        description: job.description,
      },
      profile,
    );
    return {
      ...ranking,
      url: job.url ?? null,
      profileChars: profile.length,
      profilePreview: profileSnippet(profile, 400),
    };
  },
});
