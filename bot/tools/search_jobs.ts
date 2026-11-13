import { defineTool } from "@grok/agent-sdk/tools";
import * as z from "zod/v4";
import { searchJobListings } from "../lib/jobs.js";

export default defineTool({
  description:
    "Search public remote job boards (Remotive, RemoteOK) for openings matching keywords or a free-text query. Does not apply anywhere.",
  execution: "server",
  effect: "read",
  inputSchema: z.object({
    query: z
      .string()
      .optional()
      .describe("Free-text filter, e.g. '.NET Tech Lead remote'"),
    keywords: z
      .array(z.string())
      .optional()
      .describe("Optional keyword list used for ranking; defaults to Marcos's stack"),
    limit: z.number().int().min(1).max(25).optional(),
  }),
  async execute({ query, keywords, limit }) {
    const result = await searchJobListings({ query, keywords, limit });
    return {
      count: result.jobs.length,
      keywordHits: result.keywordHits,
      sources: result.sources,
      jobs: result.jobs,
      note: "Human approval required before any application. LinkedIn is not automated.",
    };
  },
});
