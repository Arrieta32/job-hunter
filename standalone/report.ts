/**
 * Standalone daily job report — no Cursor models required.
 *
 * Usage:
 *   SLACK_WEBHOOK_URL=https://hooks.slack.com/... npm run report
 *   npm run report -- --dry-run
 */
import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { rankJobAgainstProfile, searchJobListings, type JobListing } from "../bot/lib/jobs.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const profilePath = path.join(root, "bot/sandbox/workspace/profile.md");
const statePath = path.join(root, ".standalone-state/seen.json");

// Prefer .NET-focused search (Remotive search=.net/csharp + RemoteOK filter).
const QUERY = process.env.JOB_QUERY ?? ".net,c#,csharp,asp.net,dotnet";
const LIMIT = Number(process.env.JOB_LIMIT ?? "15");
const MIN_SCORE = Number(process.env.JOB_MIN_SCORE ?? "12");
const REQUIRE_DOTNET = (process.env.JOB_REQUIRE_DOTNET ?? "true").toLowerCase() !== "false";
const DRY_RUN = process.argv.includes("--dry-run");

type SeenState = { ids: string[]; updatedAt: string };

async function loadProfile(): Promise<string> {
  return (await readFile(profilePath, "utf8")).trim();
}

async function loadSeen(): Promise<Set<string>> {
  try {
    const raw = JSON.parse(await readFile(statePath, "utf8")) as SeenState;
    return new Set(Array.isArray(raw.ids) ? raw.ids : []);
  } catch {
    return new Set();
  }
}

async function saveSeen(ids: string[]): Promise<void> {
  await mkdir(path.dirname(statePath), { recursive: true });
  const state: SeenState = { ids: ids.slice(-400), updatedAt: new Date().toISOString() };
  await writeFile(statePath, JSON.stringify(state, null, 2) + "\n", "utf8");
}

function draftBlurb(job: JobListing): string {
  return [
    `Interés en ${job.title} @ ${job.company}.`,
    "Perfil: Tech Lead .NET / C#, microservicios, fintech-banking/ATM, Oracle/PostgreSQL.",
    "Base: Asunción (remoto). CV listo — Marcos Arrieta.",
  ].join(" ");
}

function formatSlack(lines: Array<{
  job: JobListing;
  score: number;
  reasons: string[];
  gaps: string[];
  isNew: boolean;
}>): string {
  const header = [
    `*Job Hunter — reporte diario*`,
    `_America/Asuncion · ${new Date().toLocaleString("es-PY", { timeZone: "America/Asuncion" })}_`,
    `Query: \`${QUERY || "(keywords del perfil)"}\` · mínimo score ${MIN_SCORE}`,
    ``,
  ];

  if (lines.length === 0) {
    return header.concat(["No hubo matches fuertes hoy. Probá bajar `JOB_MIN_SCORE` o ampliar keywords."]).join("\n");
  }

  const body = lines.map((row, i) => {
    const badge = row.isNew ? " :new:" : "";
    const why = row.reasons.slice(0, 3).join(" · ") || "fit parcial";
    const gaps = row.gaps.length ? `\n   · Gaps: ${row.gaps.slice(0, 2).join("; ")}` : "";
    return [
      `*${i + 1}. ${row.job.title}* @ ${row.job.company}${badge}`,
      `   Score *${row.score}* · ${row.job.location || "Remote"}`,
      `   ${why}${gaps}`,
      `   <${row.job.url}|Ver oferta>`,
      `   _Borrador:_ ${draftBlurb(row.job)}`,
    ].join("\n");
  });

  return header
    .concat(body)
    .concat([
      "",
      "_Supervisión humana: abrí el link y postulá vos. No hay auto-apply ni LinkedIn bot._",
    ])
    .join("\n");
}

async function postSlack(text: string): Promise<void> {
  const url = process.env.SLACK_WEBHOOK_URL?.trim();
  if (!url) {
    throw new Error("SLACK_WEBHOOK_URL is missing. Create an Incoming Webhook in Slack and set the secret.");
  }
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Slack webhook HTTP ${res.status}: ${body}`);
  }
}

async function main(): Promise<void> {
  const profile = await loadProfile();
  const seen = await loadSeen();

  const { jobs, sources } = await searchJobListings({
    query: QUERY,
    limit: Math.min(Math.max(LIMIT * 3, 20), 40),
    requireDotNet: REQUIRE_DOTNET,
  });

  const ranked = jobs
    .map((job) => {
      const ranking = rankJobAgainstProfile(job, profile);
      return { job, ...ranking, isNew: !seen.has(job.id) };
    })
    .filter((row) => row.score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score || Number(b.isNew) - Number(a.isNew))
    .slice(0, LIMIT);

  const text = formatSlack(ranked);
  console.log("--- report ---");
  console.log(text);
  console.log("--- sources ---");
  console.log(sources);

  if (DRY_RUN) {
    console.log("dry-run: not posting to Slack, not updating seen state");
    return;
  }

  await postSlack(text);
  const nextSeen = [...seen];
  for (const row of ranked) nextSeen.push(row.job.id);
  await saveSeen(nextSeen);
  console.log(`posted ${ranked.length} jobs to Slack`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
