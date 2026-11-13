export type JobListing = {
  id: string;
  source: "remotive" | "remoteok";
  title: string;
  company: string;
  url: string;
  location: string;
  tags: string[];
  description: string;
  salary: string | null;
  publishedAt: string | null;
};

const DEFAULT_KEYWORDS = [
  ".net",
  "c#",
  "csharp",
  "asp.net",
  "tech lead",
  "engineering lead",
  "backend",
  "fintech",
  "banking",
  "microservices",
  "oracle",
  "postgresql",
];

function normalize(text: string): string {
  return text.toLowerCase();
}

function truncate(text: string, max = 1200): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  return cleaned.length <= max ? cleaned : `${cleaned.slice(0, max)}…`;
}

function matchesQuery(job: JobListing, query: string | undefined): boolean {
  if (!query?.trim()) return true;
  const hay = normalize(
    [job.title, job.company, job.location, job.tags.join(" "), job.description].join(" "),
  );
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((token) => hay.includes(token));
}

function scoreAgainstKeywords(job: JobListing, keywords: string[]): number {
  const hay = normalize(
    [job.title, job.company, job.tags.join(" "), job.description].join(" "),
  );
  let score = 0;
  for (const keyword of keywords) {
    if (hay.includes(keyword)) score += 1;
  }
  return score;
}

async function fetchRemotive(limit: number): Promise<JobListing[]> {
  const res = await fetch("https://remotive.com/api/remote-jobs?category=software-dev");
  if (!res.ok) {
    throw new Error(`Remotive HTTP ${res.status}`);
  }
  const data = (await res.json()) as {
    jobs?: Array<{
      id: number | string;
      url?: string;
      title?: string;
      company_name?: string;
      candidate_required_location?: string;
      tags?: string[];
      description?: string;
      salary?: string;
      publication_date?: string;
    }>;
  };
  return (data.jobs ?? []).slice(0, limit).map((job) => ({
    id: `remotive:${job.id}`,
    source: "remotive" as const,
    title: job.title ?? "Untitled",
    company: job.company_name ?? "Unknown",
    url: job.url ?? "",
    location: job.candidate_required_location ?? "Remote",
    tags: job.tags ?? [],
    description: truncate(job.description ?? ""),
    salary: job.salary || null,
    publishedAt: job.publication_date ?? null,
  }));
}

async function fetchRemoteOk(limit: number): Promise<JobListing[]> {
  const res = await fetch("https://remoteok.com/api", {
    headers: { "User-Agent": "job-hunter-agent/0.1" },
  });
  if (!res.ok) {
    throw new Error(`RemoteOK HTTP ${res.status}`);
  }
  const data = (await res.json()) as Array<Record<string, unknown>>;
  return data
    .filter((row) => typeof row.id !== "undefined" && typeof row.position === "string")
    .slice(0, limit)
    .map((row) => {
      const tags = Array.isArray(row.tags)
        ? row.tags.filter((t): t is string => typeof t === "string")
        : [];
      return {
        id: `remoteok:${String(row.id)}`,
        source: "remoteok" as const,
        title: String(row.position),
        company: typeof row.company === "string" ? row.company : "Unknown",
        url: typeof row.url === "string" ? row.url : `https://remoteok.com/remote-jobs/${row.id}`,
        location: typeof row.location === "string" ? row.location : "Remote",
        tags,
        description: truncate(typeof row.description === "string" ? row.description : ""),
        salary:
          typeof row.salary_min === "number" || typeof row.salary_max === "number"
            ? `${row.salary_min ?? "?"}-${row.salary_max ?? "?"} ${typeof row.salary_currency === "string" ? row.salary_currency : ""}`.trim()
            : null,
        publishedAt:
          typeof row.date === "string"
            ? row.date
            : typeof row.epoch === "number"
              ? new Date(row.epoch * 1000).toISOString()
              : null,
      };
    });
}

export async function searchJobListings(input: {
  query?: string;
  keywords?: string[];
  limit?: number;
}): Promise<{ jobs: JobListing[]; sources: Record<string, string>; keywordHits: number }> {
  const limit = Math.min(Math.max(input.limit ?? 12, 1), 25);
  const keywords = (input.keywords?.length ? input.keywords : DEFAULT_KEYWORDS).map((k) =>
    k.toLowerCase(),
  );
  const perSource = Math.max(limit * 3, 30);
  const sources: Record<string, string> = {};
  const collected: JobListing[] = [];

  try {
    collected.push(...(await fetchRemotive(perSource)));
    sources.remotive = "ok";
  } catch (error) {
    sources.remotive = error instanceof Error ? error.message : "failed";
  }

  try {
    collected.push(...(await fetchRemoteOk(perSource)));
    sources.remoteok = "ok";
  } catch (error) {
    sources.remoteok = error instanceof Error ? error.message : "failed";
  }

  const filtered = collected
    .filter((job) => matchesQuery(job, input.query))
    .map((job) => ({ job, score: scoreAgainstKeywords(job, keywords) }))
    .filter((row) => row.score > 0 || !input.query)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return {
    jobs: filtered.map((row) => row.job),
    sources,
    keywordHits: filtered.filter((row) => row.score > 0).length,
  };
}

export function rankJobAgainstProfile(job: {
  title: string;
  company: string;
  location: string;
  tags?: string[];
  description?: string;
}, profileText: string): {
  score: number;
  reasons: string[];
  gaps: string[];
} {
  // Tags-only boards (e.g. Lemon.io mega-lists) inflate matches — weight title/body more.
  const title = normalize(job.title);
  const body = normalize([job.company, job.location, job.description ?? ""].join(" "));
  const tags = normalize((job.tags ?? []).slice(0, 12).join(" "));
  const profile = normalize(profileText);
  const reasons: string[] = [];
  const gaps: string[] = [];
  let score = 0;

  const positives: Array<[string, number, string]> = [
    [".net", 22, "Strong .NET match"],
    ["c#", 20, "C# mentioned"],
    ["asp.net", 14, "ASP.NET stack"],
    ["tech lead", 18, "Leadership title fit"],
    ["engineering lead", 14, "Lead role"],
    ["backend", 12, "Backend focus"],
    ["microservices", 8, "Microservices"],
    ["fintech", 10, "Fintech domain"],
    ["bank", 8, "Banking domain"],
    ["oracle", 6, "Oracle experience"],
    ["postgresql", 6, "PostgreSQL"],
    ["azure", 5, "Azure"],
    ["aws", 4, "AWS"],
  ];

  for (const [needle, points, label] of positives) {
    const inTitle = title.includes(needle);
    const inBody = body.includes(needle);
    const inTags = tags.includes(needle);
    if (!inTitle && !inBody && !inTags) continue;

    let gained = 0;
    if (inTitle) gained += points;
    else if (inBody) gained += Math.floor(points * 0.7);
    else gained += Math.floor(points * 0.2); // tags-only: weak signal

    if (profile.includes(needle.replace("bank", "banking").split(" ")[0]!)) {
      score += gained;
      reasons.push(inTitle ? label : `${label}${inTags && !inBody ? " (tags)" : ""}`);
    } else {
      score += Math.floor(gained / 2);
      reasons.push(`${label} (job-side)`);
    }
  }

  if ((title.includes("react") || title.includes("frontend") || title.includes("rails")) &&
      !title.includes(".net") && !title.includes("c#") && !title.includes("backend")) {
    score -= 18;
    gaps.push("Title stack looks off-profile (.NET/backend lead)");
  }
  if (title.includes("junior") || title.includes("intern")) {
    score -= 20;
    gaps.push("Seniority looks below Tech Lead / Senior");
  }
  if (!body.includes("remote") && !title.includes("remote") && body.includes("on-site")) {
    gaps.push("May require on-site; confirm relocation/hybrid");
  }

  score = Math.max(0, Math.min(100, score));
  return { score, reasons: reasons.slice(0, 6), gaps: gaps.slice(0, 4) };
}
