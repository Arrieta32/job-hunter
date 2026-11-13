import { defineAgent } from "@grok/agent-sdk";

export default defineAgent({
  name: "job-hunter",
  description:
    "Finds remote/.NET/Tech Lead jobs for Marcos, ranks them, drafts applications, and posts weekday Slack reports — never auto-applies.",
  model: {
    id: "grok-4.7",
    params: [
      { id: "reasoning_effort", value: "high" },
      { id: "fast", value: "true" },
    ],
  },
  hosting: {
    egressDomains: [
      "remotive.com",
      "remoteok.com",
      "www.remoteok.com",
      "www.arbeitnow.com",
      "arbeitnow.com",
    ],
    secretNames: [
      "JOB_HUNTER_SLACK_BOT_TOKEN",
      "JOB_HUNTER_SLACK_APP_TOKEN",
      "JOB_HUNTER_SLACK_CHANNEL_ID",
    ],
  },
});
