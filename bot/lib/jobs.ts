export type JobListing = {
  id: string;
  source: "remotive" | "remoteok" | "arbeitnow";
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
  "dotnet",
  "c#",
  "csharp",
  "asp.net",
  "aspnet",
  "tech lead",
  "engineering lead",
  "backend",
  "fintech",
  "banking",
  "microservices",
  "oracle",
  "postgresql",
  "azure",
];

const DOTNET_MARKERS = [".net", "dotnet", "c#", "csharp", "asp.net", "aspnet", "f#"];

function normalize(text: string): string {
  return text.toLowerCase();
}

function truncate(text: string, max = 1600): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  return cleaned.length <= max ? cleaned : `${cleaned.slice(0, max)}…`;
}

function jobHaystack(job: JobListing): string {
  return normalize(
    [job.title, job.company, job.location, job.tags.join(" "), job.description].join(" "),
  );
}

export function hasDotNetSignal(job: JobListing): boolean {
  const hay = jobHaystack(job);
  return DOTNET_MARKERS.some((m) => hay.includes(m));
}

export function hasDotNetInTitle(job: { title: string }): boolean {
  const title = normalize(job.title);
  return DOTNET_MARKERS.some((m) => title.includes(m));
}

function matchesQuery(job: JobListing, query: string | undefined): boolean {
  if (!query?.trim()) return true;
  const hay = jobHaystack(job);
  return query
    .toLowerCase()
    .split(/[\s,]+/)
    .filter(Boolean)
    .some((token) => hay.includes(token));
}

function scoreAgainstKeywords(job: JobListing, keywords: string[]): number {
  const hay = jobHaystack(job);
  let score = 0;
  for (const keyword of keywords) {
    if (hay.includes(keyword)) score += 1;
  }
  // Prefer real .NET titles over mega-tag noise
  if (hasDotNetInTitle(job)) score += 5;
  return score;
}

function mapRemotiveJob(job: {
  id: number | string;
  url?: string;
  title?: string;
  company_name?: string;
  candidate_required_location?: string;
  tags?: string[];
  description?: string;
  salary?: string;
  publication_date?: string;
}): JobListing {
  return {
    id: `remotive:${job.id}`,
    source: "remotive",
    title: job.title ?? "Untitled",
    company: job.company_name ?? "Unknown",
    url: job.url ?? "",
    location: job.candidate_required_location ?? "Remote",
    tags: job.tags ?? [],
    description: truncate(job.description ?? ""),
    salary: job.salary || null,
    publishedAt: job.publication_date ?? null,
  };
}

async function fetchRemotiveSearch(search: string, limit: number): Promise<JobListing[]> {
  const url = new URL("https://remotive.com/api/remote-jobs");
  url.searchParams.set("category", "software-dev");
  url.searchParams.set("search", search);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Remotive HTTP ${res.status} (${search})`);
  }
  const data = (await res.json()) as { jobs?: Array<Parameters<typeof mapRemotiveJob>[0]> };
  return (data.jobs ?? []).slice(0, limit).map(mapRemotiveJob);
}

async function fetchRemotiveDotNet(limit: number): Promise<JobListing[]> {
  const queries = [".net", "csharp", "asp.net", "dotnet"];
  const byId = new Map<string, JobListing>();
  const errors: string[] = [];
  await Promise.all(
    queries.map(async (q) => {
      try {
        const jobs = await fetchRemotiveSearch(q, limit);
        for (const job of jobs) byId.set(job.id, job);
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
      }
    }),
  );
  if (byId.size === 0 && errors.length) throw new Error(errors[0]);
  return [...byId.values()];
}

async function fetchRemoteOk(limit: number): Promise<JobListing[]> {
  const res = await fetch("https://remoteok.com/api", {
    headers: { "User-Agent": "job-hunter-agent/0.1" },
  });
  if (!res.ok) throw new Error(`RemoteOK HTTP ${res.status}`);
  const data = (await res.json()) as Array<Record<string, unknown>>;
  return data
    .filter((row) => typeof row.id !== "undefined" && typeof row.position === "string")
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
    })
    .filter(hasDotNetSignal)
    .slice(0, limit);
}

async function fetchArbeitnowDotNet(limit: number): Promise<JobListing[]> {
  const res = await fetch("https://www.arbeitnow.com/api/job-board-api", {
    headers: { "User-Agent": "job-hunter-agent/0.1" },
  });
  if (!res.ok) throw new Error(`Arbeitnow HTTP ${res.status}`);
  const data = (await res.json()) as {
    data?: Array<{
      slug?: string;
      title?: string;
      company_name?: string;
      url?: string;
      location?: string;
      remote?: boolean;
      tags?: string[];
      description?: string;
      created_at?: number | string;
    }>;
  };

  return (data.data ?? [])
    .map((job) => {
      const listing: JobListing = {
        id: `arbeitnow:${job.slug ?? job.url ?? job.title ?? Math.random()}`,
        source: "arbeitnow",
        title: job.title ?? "Untitled",
        company: job.company_name ?? "Unknown",
        url: job.url ?? "",
        location: job.remote ? `Remote · ${job.location ?? ""}`.trim() : (job.location ?? "Unknown"),
        tags: job.tags ?? [],
        description: truncate(job.description ?? ""),
        salary: null,
        publishedAt:
          typeof job.created_at === "number"
            ? new Date(job.created_at * 1000).toISOString()
            : typeof job.created_at === "string"
              ? job.created_at
              : null,
      };
      return listing;
    })
    .filter(hasDotNetSignal)
    .slice(0, limit);
}

export async function searchJobListings(input: {
  query?: string;
  keywords?: string[];
  limit?: number;
  requireDotNet?: boolean;
}): Promise<{ jobs: JobListing[]; sources: Record<string, string>; keywordHits: number }> {
  const limit = Math.min(Math.max(input.limit ?? 15, 1), 50);
  const requireDotNet = input.requireDotNet !== false;
  const keywords = (input.keywords?.length ? input.keywords : DEFAULT_KEYWORDS).map((k) =>
    k.toLowerCase(),
  );
  const perSource = Math.max(limit * 5, 50);
  const sources: Record<string, string> = {};
  const collected: JobListing[] = [];

  const tasks: Array<[string, () => Promise<JobListing[]>]> = [
    ["remotive", () => fetchRemotiveDotNet(perSource)],
    ["remoteok", () => fetchRemoteOk(perSource)],
    ["arbeitnow", () => fetchArbeitnowDotNet(perSource)],
  ];

  await Promise.all(
    tasks.map(async ([name, fn]) => {
      try {
        collected.push(...(await fn()));
        sources[name] = "ok";
      } catch (error) {
        sources[name] = error instanceof Error ? error.message : "failed";
      }
    }),
  );

  const byId = new Map<string, JobListing>();
  for (const job of collected) byId.set(job.id, job);

  const filtered = [...byId.values()]
    .filter((job) => (requireDotNet ? hasDotNetSignal(job) : true))
    // Drop marketplace mega-tag noise unless the title itself is .NET/C#
    .filter((job) => {
      const company = normalize(job.company);
      if (company.includes("lemon.io") && !hasDotNetInTitle(job)) return false;
      return true;
    })
    .filter((job) => matchesQuery(job, input.query))
    .map((job) => ({ job, score: scoreAgainstKeywords(job, keywords) }))
    .filter((row) => row.score > 0 || Boolean(input.query))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return {
    jobs: filtered.map((row) => row.job),
    sources,
    keywordHits: filtered.filter((row) => row.score > 0).length,
  };
}

export function rankJobAgainstProfile(
  job: {
    title: string;
    company: string;
    location: string;
    tags?: string[];
    description?: string;
  },
  profileText: string,
): {
  score: number;
  reasons: string[];
  gaps: string[];
} {
  const title = normalize(job.title);
  const company = normalize(job.company);
  const body = normalize([job.company, job.location, job.description ?? ""].join(" "));
  const tags = normalize((job.tags ?? []).slice(0, 12).join(" "));
  const profile = normalize(profileText);
  const reasons: string[] = [];
  const gaps: string[] = [];
  let score = 0;

  const positives: Array<[string, number, string]> = [
    [".net", 28, "Strong .NET match"],
    ["dotnet", 28, "Strong .NET match"],
    ["c#", 26, "C# mentioned"],
    ["csharp", 26, "C# mentioned"],
    ["asp.net", 18, "ASP.NET stack"],
    ["aspnet", 18, "ASP.NET stack"],
    ["tech lead", 16, "Leadership title fit"],
    ["engineering lead", 14, "Lead role"],
    ["senior", 6, "Senior level"],
    ["backend", 12, "Backend focus"],
    ["microservices", 8, "Microservices"],
    ["fintech", 10, "Fintech domain"],
    ["bank", 8, "Banking domain"],
    ["oracle", 6, "Oracle experience"],
    ["postgresql", 6, "PostgreSQL"],
    ["azure", 8, "Azure"],
    ["aws", 4, "AWS"],
  ];

  const seenLabels = new Set<string>();
  for (const [needle, points, label] of positives) {
    const inTitle = title.includes(needle);
    const inBody = body.includes(needle);
    const inTags = tags.includes(needle);
    if (!inTitle && !inBody && !inTags) continue;

    let gained = 0;
    if (inTitle) gained += points;
    else if (inBody) gained += Math.floor(points * 0.75);
    else gained += Math.floor(points * 0.25);

    if (profile.includes(needle.replace("bank", "banking").split(" ")[0]!)) {
      score += gained;
    } else {
      score += Math.floor(gained / 2);
    }
    if (!seenLabels.has(label)) {
      seenLabels.add(label);
      reasons.push(inTitle ? label : `${label}${inTags && !inBody ? " (tags)" : ""}`);
    }
  }

  const stackInTitle = hasDotNetInTitle({ title: job.title });
  if (stackInTitle) {
    score += 12;
    reasons.unshift(".NET/C# in title");
  } else {
    score -= 6;
    gaps.push("Title doesn't mention .NET/C# explicitly");
  }

  if (company.includes("lemon.io") && !stackInTitle) {
    score -= 25;
    gaps.push("Marketplace listing without .NET in title");
  }

  if (
    (title.includes("react") || title.includes("frontend") || title.includes("rails") || title.includes("php")) &&
    !stackInTitle
  ) {
    score -= 20;
    gaps.push("Title stack looks off-profile (.NET/backend)");
  }
  if (title.includes("junior") || title.includes("intern")) {
    score -= 20;
    gaps.push("Seniority looks below Tech Lead / Senior");
  }

  score = Math.max(0, Math.min(100, score));
  return { score, reasons: reasons.slice(0, 6), gaps: gaps.slice(0, 4) };
}
