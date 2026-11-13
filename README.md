# job-hunter

Herramientas para Marcos Arrieta: buscar y rankear ofertas .NET / Tech Lead, con supervisión humana (sin auto-apply).

## Opción recomendada ahora: standalone + Slack webhook

No depende de modelos Cursor ni del team Itti.

→ Guía completa: [`standalone/README.md`](./standalone/README.md)

```bash
npm install
npm run report:dry
SLACK_WEBHOOK_URL='https://hooks.slack.com/services/...' npm run report
```

Cron automático: GitHub Action Lun–Vie 09:00 America/Asuncion (secret `SLACK_WEBHOOK_URL`).

## Agent SDK (pausado)

Hay un agente Cursor en `bot/` + deploy `job-hunter`, pero el team **Itti** bloquea modelos (`Model Blocked`). Cuando un admin habilite modelos, se puede retomar Slack Socket Mode / playground.

```bash
npx @grok/agent-sdk@0.6.0 validate --dir .
npx @grok/agent-sdk@0.6.0 deploy --dir . --ref cursor/job-hunter-cc45
```

## Perfil

`bot/sandbox/workspace/profile.md` (armado desde tus CVs).
