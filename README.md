# job-hunter

Agente Cursor (Agent SDK) con supervisión humana para Marcos Arrieta.

- Busca ofertas (Remotive + RemoteOK)
- Rankea contra `bot/sandbox/workspace/profile.md`
- Prepara borradores de postulación
- Reportes Slack Lun–Vie ~09:00 America/Asuncion
- **No aplica solo** y **no automatiza LinkedIn**

## Local

```bash
cd job-hunter
npx @grok/agent-sdk@0.6.0 login
npx @grok/agent-sdk@0.6.0 slack create --dir . --name "Job Hunter"
npx @grok/agent-sdk@0.6.0 slack doctor --prefix JOB_HUNTER
npx @grok/agent-sdk@0.6.0 dev
```

Playground: URL que imprime `dev`.  
Disparo manual del schedule:

```bash
curl -X POST http://127.0.0.1:3000/job-hunter/v1/dev/schedules/morning-report
```

Antes del schedule automático, en Slack: *“Suscribime al reporte diario en este canal”* (o seteá `JOB_HUNTER_SLACK_CHANNEL_ID`).

## Deploy (hosted)

1. Subí este repo a GitHub y hacé push.
2. `npx @grok/agent-sdk@0.6.0 slack create --dir . --name "Job Hunter" --env prod`
3. `npx @grok/agent-sdk@0.6.0 validate --dir .`
4. `npx @grok/agent-sdk@0.6.0 deploy --dir . --dry-run`
5. `npx @grok/agent-sdk@0.6.0 deploy --dir .` (guardá el alias token)
6. Dashboard: https://cursor.com/dashboard/deployed-agents
