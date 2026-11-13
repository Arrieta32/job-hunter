import { defineTool } from "@grok/agent-sdk/tools";
import * as z from "zod/v4";

const TARGET_KEY = "slack-report-target";

export default defineTool({
  description:
    "Save or clear where morning Slack job reports should be posted (channel id). Call when Marcos says to send daily reports to this Slack conversation.",
  execution: "server",
  effect: "idempotent",
  inputSchema: z.object({
    action: z.enum(["set", "clear", "get"]),
    channelId: z
      .string()
      .optional()
      .describe("Slack channel or DM id (C…/D…). Required for set."),
    label: z.string().optional(),
  }),
  async execute({ action, channelId, label }, ctx) {
    if (action === "get") {
      const current = await ctx.host.kv.get(TARGET_KEY);
      return { target: current ?? null };
    }
    if (action === "clear") {
      await ctx.host.kv.delete(TARGET_KEY);
      return { cleared: true };
    }
    if (!channelId?.trim()) {
      return {
        content: [{ type: "text" as const, text: "channelId is required for action=set" }],
        isError: true,
      };
    }
    const target = {
      channelId: channelId.trim(),
      label: label ?? null,
      updatedAt: new Date().toISOString(),
    };
    await ctx.host.kv.put(TARGET_KEY, target);
    return { saved: true, target };
  },
});
