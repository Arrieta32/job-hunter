# Job Hunter standalone (sin modelos Cursor)

Busca ofertas, las rankea con tu `profile.md` y manda un resumen a Slack.
**No usa Agent SDK / modelos del team.** PC puede estar apagada (GitHub Actions).

## 1. Crear Incoming Webhook en Slack

1. En Slack: https://api.slack.com/apps → **Create New App** → From scratch  
   Nombre: `Job Hunter Report` · workspace ParaguaySoft  
2. **Incoming Webhooks** → Activate → **Add New Webhook to Workspace**  
3. Elegí un canal (o DM vía canal) → Allow  
4. Copiá la URL `https://hooks.slack.com/services/...`  
   (no la pegues en el chat; guardala como secret)

## 2. Probar en local

```bash
cd job-hunter
npm install
export SLACK_WEBHOOK_URL='https://hooks.slack.com/services/...'
npm run report:dry    # solo imprime
npm run report        # publica en Slack
```

## 3. Automatizar (Lun–Vie 09:00 Asunción)

1. Repo: https://github.com/Arrieta32/job-hunter  
2. **Settings → Secrets and variables → Actions → New repository secret**  
   Name: `SLACK_WEBHOOK_URL` · Value: la URL del webhook  
3. Mergeá/pusheá este código a la branch **default** (`main`) — los cron de Actions solo corren ahí  
4. **Actions → Daily job report → Run workflow** (prueba manual)

El schedule del workflow: `0 12 * * 1-5` UTC = 09:00 America/Asuncion.

## Variables opcionales

| Env | Default |
| --- | --- |
| `JOB_QUERY` | _(vacío = solo keywords del perfil)_ |
| `JOB_LIMIT` | `10` |
| `JOB_MIN_SCORE` | `20` |

Editá el perfil en `bot/sandbox/workspace/profile.md`.
