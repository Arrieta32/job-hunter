import { defineTool } from "@grok/agent-sdk/tools";
import * as z from "zod/v4";

type DecisionRecord = {
  jobId: string;
  decision: "approve" | "skip" | "applied" | "interested";
  title?: string;
  company?: string;
  url?: string;
  notes?: string;
  at: string;
};

export default defineTool({
  description:
    "Record Marcos's human decision for a job (approve draft, skip, interested, or applied). Idempotent per jobId+decision.",
  execution: "server",
  effect: "idempotent",
  inputSchema: z.object({
    jobId: z.string(),
    decision: z.enum(["approve", "skip", "applied", "interested"]),
    title: z.string().optional(),
    company: z.string().optional(),
    url: z.string().optional(),
    notes: z.string().optional(),
  }),
  async execute(input, ctx) {
    const key = "job-decisions";
    const existing = (await ctx.host.kv.get(key)) as DecisionRecord[] | undefined;
    const list = Array.isArray(existing) ? [...existing] : [];
    const at = new Date().toISOString();
    const next: DecisionRecord = {
      jobId: input.jobId,
      decision: input.decision,
      title: input.title,
      company: input.company,
      url: input.url,
      notes: input.notes,
      at,
    };
    const withoutDup = list.filter(
      (row) => !(row.jobId === next.jobId && row.decision === next.decision),
    );
    withoutDup.push(next);
    const trimmed = withoutDup.slice(-200);
    await ctx.host.kv.put(key, trimmed);

    const seenKey = "seen-job-ids";
    const seenRaw = (await ctx.host.kv.get(seenKey)) as string[] | undefined;
    const seen = new Set(Array.isArray(seenRaw) ? seenRaw : []);
    seen.add(input.jobId);
    await ctx.host.kv.put(seenKey, [...seen].slice(-500));

    return {
      saved: true,
      decision: next,
      totalDecisions: trimmed.length,
    };
  },
});
