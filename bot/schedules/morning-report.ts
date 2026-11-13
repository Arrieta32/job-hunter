import { defineSchedule } from "@grok/agent-sdk/schedules";

const TARGET_KEY = "slack-report-target";

type ReportTarget = {
  channelId?: string;
};

/**
 * Weekdays 09:00 America/Asuncion = 12:00 UTC (standard/PYT, no DST).
 */
export default defineSchedule({
  cron: "0 12 * * 1-5",
  async run({ receive, waitUntil, appAuth, host }) {
    const envChannel = process.env.JOB_HUNTER_SLACK_CHANNEL_ID?.trim();
    const stored = (await host.kv.get(TARGET_KEY)) as ReportTarget | undefined;
    const channelId = envChannel || stored?.channelId;

    if (!channelId) {
      await host.kv.put("last-morning-report", {
        at: new Date().toISOString(),
        status: "skipped",
        reason: "No Slack channel configured. DM the bot: subscribe daily reports here.",
      });
      return;
    }

    const client = await host.slack.getClient();
    const posted = await client.chat.postMessage({
      channel: channelId,
      text: "Job Hunter — reporte diario (buscando ofertas…)",
    });
    const threadTs = posted.ts;
    if (!threadTs) {
      await host.kv.put("last-morning-report", {
        at: new Date().toISOString(),
        status: "failed",
        reason: "chat.postMessage returned no ts",
        channelId,
      });
      return;
    }

    await host.kv.put("last-morning-report", {
      at: new Date().toISOString(),
      status: "started",
      channelId,
      threadTs,
    });

    waitUntil(
      receive("slack", {
        message: [
          "Morning job report for Marcos (America/Asuncion).",
          "1) Call search_jobs for Tech Lead / Senior .NET / backend fintech-banking roles (limit ~10).",
          "2) For the top matches, call match_profile.",
          "3) Skip jobs already decided/seen when obvious; prefer new strong fits.",
          "4) Post a concise Slack report: ranked list with title, company, score, url, 1-line why.",
          "5) Offer to draft_application for any item Marcos approves.",
          "6) Do NOT apply anywhere. Human supervision only. No LinkedIn automation.",
          "Reply in this thread.",
        ].join("\n"),
        auth: appAuth,
        target: { channelId, threadTs },
      }),
    );
  },
});
