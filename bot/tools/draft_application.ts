import { defineTool } from "@grok/agent-sdk/tools";
import * as z from "zod/v4";
import { loadProfileMarkdown, profileSnippet } from "../lib/profile.js";

export default defineTool({
  description:
    "Build a structured application draft (Spanish + English bullets) for one job using Marcos's profile. Does not send or apply.",
  execution: "server",
  effect: "read",
  inputSchema: z.object({
    title: z.string(),
    company: z.string(),
    url: z.string().optional(),
    highlights: z
      .array(z.string())
      .optional()
      .describe("Job requirements to emphasize"),
    language: z.enum(["es", "en", "both"]).optional(),
  }),
  async execute({ title, company, url, highlights, language }) {
    const profile = await loadProfileMarkdown();
    const lang = language ?? "both";
    const focus = highlights?.length
      ? highlights.map((h) => `- ${h}`).join("\n")
      : "- Backend .NET / leadership / transactional systems";

    const es = [
      `Hola equipo de ${company},`,
      "",
      `Me interesa el rol de ${title}. Soy Tech Lead con 12+ años, fuerte en C#/.NET, microservicios e integraciones transaccionales (banca/fintech/ATM), con liderazgo de equipos y buenas prácticas (SOLID, OWASP, PCI DSS).`,
      "",
      "Por qué encajo:",
      focus,
      "",
      "Actualmente lidero soluciones ATM/KAL en iTTi (Paraguay) y dicto programación/bases de datos en UniNorte. Abierto a remoto desde Asunción.",
      "",
      "Adjunto CV. Gracias,",
      "Marcos Arrieta",
      "markos.arieta23@gmail.com · linkedin.com/in/marcos-arrieta",
    ].join("\n");

    const en = [
      `Hello ${company} team,`,
      "",
      `I'm interested in the ${title} role. I'm a Tech Lead with 12+ years focused on C#/.NET, microservices, and high-concurrency transactional integrations (banking/fintech/ATM), plus team leadership and secure engineering practices (SOLID, OWASP, PCI DSS).`,
      "",
      "Why I'm a fit:",
      focus,
      "",
      "I currently lead ATM/KAL solutions at iTTi (Paraguay) and teach programming/databases at UniNorte. Open to remote from Asunción.",
      "",
      "CV attached. Thank you,",
      "Marcos Arrieta",
      "markos.arieta23@gmail.com · linkedin.com/in/marcos-arrieta",
    ].join("\n");

    return {
      job: { title, company, url: url ?? null },
      language: lang,
      coverLetterEs: lang === "en" ? null : es,
      coverLetterEn: lang === "es" ? null : en,
      talkingPoints: [
        "Tech Lead for critical ATM/KAL transactional systems",
        ".NET Core microservices + Oracle/PostgreSQL/SQL Server",
        "PCI DSS / OWASP / secure coding in regulated environments",
        "AI-assisted delivery with Cursor / LLMs",
        "University teaching reinforces mentoring and clear technical communication",
      ],
      profilePreview: profileSnippet(profile, 500),
      nextStep:
        "Wait for Marcos to approve before applying. Prefer human submit on LinkedIn/company ATS.",
    };
  },
});
