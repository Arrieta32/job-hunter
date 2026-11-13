import { slackChannel } from "@grok/agent-sdk/channels/slack";

// Tokens: JOB_HUNTER_SLACK_BOT_TOKEN + JOB_HUNTER_SLACK_APP_TOKEN
// Mint with: npx @grok/agent-sdk@0.6.0 slack create --dir . --name "Job Hunter"
export default slackChannel({
  envPrefix: "JOB_HUNTER",
  suggestedPrompts: [
    {
      title: "Buscar roles",
      message: "Buscá ofertas remotas de Tech Lead / Senior .NET y rankealas contra mi profile.",
    },
    {
      title: "Reporte aquí",
      message:
        "Suscribime al reporte diario en este canal. Usá subscribe_reports con el channel id de esta conversación.",
    },
    {
      title: "Borrador",
      message: "Prepará un borrador de postulación (ES+EN) para la oferta #1 del último listado.",
    },
  ],
});
