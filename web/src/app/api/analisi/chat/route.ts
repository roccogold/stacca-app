import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/auth";
import { checkRateLimit, rateLimitKey, RATE_LIMITS } from "@/lib/rate-limit";
import { todayISO } from "@/lib/format";
import {
  availableYears,
  computeKpis,
  filterEntries,
  hoursByDipendente,
  hoursByLavorazione,
  hoursByLuogo,
  hoursBySettore,
  monthlyTrend,
  type AnalisiEntry,
  type AnalisiUser,
} from "@/lib/analisi";

export const dynamic = "force-dynamic";

// Haiku 4.5: il più rapido/economico, sufficiente per tradurre la domanda e
// riassumere numeri già calcolati dal codice (tool use → conti esatti).
const MODEL = "claude-haiku-4-5";
const MAX_TURNS = 5; // tetto sui giri di tool-use per evitare loop/costi
const MAX_MESSAGES = 16; // storico conversazione accettato dal client
const MAX_LEN = 1000; // lunghezza max di un singolo messaggio utente

type ClientMessage = { role: "user" | "assistant"; content: string };

function topLabels(rows: { label: string }[], n = 50): string[] {
  return rows.slice(0, n).map((r) => r.label);
}

/** La bolla chat mostra testo semplice: togli eventuale Markdown residuo. */
function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, "$1") // **grassetto**
    .replace(/__(.*?)__/g, "$1") // __grassetto__
    .replace(/(^|\s)\*(?=\S)(.*?)\*/g, "$1$2") // *corsivo*
    .replace(/`([^`]+)`/g, "$1") // `code`
    .replace(/^\s{0,3}#{1,6}\s+/gm, "") // # titoli
    .replace(/^\s*[-*]\s+/gm, "• "); // - elenco → bullet semplice
}

/** Aggregati esatti per un set di filtri — è ciò che Claude riceve dal tool. */
function queryDati(
  entries: AnalisiEntry[],
  users: AnalisiUser[],
  input: {
    year: number;
    month?: number | null;
    userId?: string | null;
    settore?: string | null;
    mansione?: string | null;
    luogo?: string | null;
  },
) {
  const filters = {
    year: input.year,
    month: input.month ?? null,
    userId: input.userId ?? null,
    settore: input.settore ?? null,
    mansione: input.mansione ?? null,
    luogo: input.luogo ?? null,
  };
  const filtered = filterEntries(entries, filters);
  // Andamento mensile: stessi filtri ma senza il mese (12 valori sull'anno).
  const yearFiltered = filterEntries(entries, { ...filters, month: null });

  const round = (n: number) => Math.round(n * 100) / 100;
  const kpis = computeKpis(filtered);

  return {
    filtriApplicati: filters,
    kpis: {
      oreTotali: round(kpis.oreTotali),
      numInterventi: kpis.numInterventi,
      mediaIntervento: round(kpis.mediaIntervento),
      dipendentiAttivi: kpis.dipendentiAttivi,
      giorniLavorati: kpis.giorniLavorati,
      mediaGiornaliera: round(kpis.mediaGiornaliera),
    },
    perLavorazione: hoursByLavorazione(filtered)
      .slice(0, 25)
      .map((r) => ({ nome: r.label, ore: round(r.hours), voci: r.count })),
    perLuogo: hoursByLuogo(filtered)
      .slice(0, 25)
      .map((r) => ({ nome: r.label, ore: round(r.hours), voci: r.count })),
    perDipendente: hoursByDipendente(filtered, users)
      .slice(0, 50)
      .map((r) => ({ nome: r.label, ore: round(r.hours), voci: r.count })),
    perSettore: hoursBySettore(filtered).map((r) => ({
      nome: r.label,
      ore: round(r.hours),
      voci: r.count,
    })),
    andamentoMensile: monthlyTrend(yearFiltered),
  };
}

const QUERY_TOOL: Anthropic.Tool = {
  name: "query_dati",
  description:
    "Interroga i dati delle ore lavorate dell'azienda con filtri opzionali e " +
    "ottieni aggregati ESATTI (KPI, ore per lavorazione/luogo/dipendente/settore, " +
    "andamento mensile). Usa SEMPRE questo strumento per qualsiasi numero: non " +
    "calcolare nulla a mente. Puoi chiamarlo più volte per confrontare periodi.",
  input_schema: {
    type: "object",
    properties: {
      year: { type: "integer", description: "Anno, es. 2025. Obbligatorio." },
      month: {
        type: ["integer", "null"],
        description: "Mese 1-12, oppure null/omesso per tutto l'anno.",
      },
      userId: {
        type: ["string", "null"],
        description:
          "id del dipendente (vedi elenco nel system prompt), oppure null per tutti.",
      },
      settore: {
        type: ["string", "null"],
        description: "Nome esatto del settore, oppure null per tutti.",
      },
      mansione: {
        type: ["string", "null"],
        description: "Nome esatto della lavorazione, oppure null per tutte.",
      },
      luogo: {
        type: ["string", "null"],
        description: "Nome esatto del luogo, oppure null per tutti.",
      },
    },
    required: ["year"],
  },
};

function buildSystemPrompt(
  entries: AnalisiEntry[],
  users: AnalisiUser[],
): string {
  const roster = users
    .map((u) => `- ${u.displayName} (id: ${u.id})`)
    .join("\n");
  const lavorazioni = topLabels(hoursByLavorazione(entries));
  const luoghi = topLabels(hoursByLuogo(entries));
  const settori = topLabels(hoursBySettore(entries));
  const anni = availableYears(entries);

  return [
    "Sei l'assistente analyst di Stacca, un'app per registrare le ore di lavoro di un'azienda agricola italiana.",
    "Rispondi in italiano, in modo conciso e diretto. Dai il numero richiesto e una frase di contesto, niente preamboli.",
    "",
    "REGOLE:",
    "- Per QUALSIASI numero usa lo strumento query_dati. Non inventare e non calcolare a mente.",
    "- Rispondi in testo semplice, SENZA Markdown: niente asterischi (**), cancelletti o elenchi puntati. Per enfatizzare un numero scrivilo e basta.",
    "- Le ore vanno scritte in formato italiano (es. 142 ore, 8,5 ore).",
    "- Se la domanda non riguarda i dati delle ore lavorate, dillo gentilmente.",
    "- Se un nome è ambiguo o non trovi il dipendente, chiedi di precisare invece di indovinare.",
    "- Quando l'utente dice 'questo mese'/'quest'anno', usa la data di oggi qui sotto.",
    "",
    `Data di oggi (Europe/Rome): ${todayISO()}.`,
    `Anni con dati: ${anni.join(", ")}.`,
    "",
    "DIPENDENTI (usa l'id nel campo userId):",
    roster || "(nessun dipendente)",
    "",
    `SETTORI: ${settori.join(", ") || "(nessuno)"}.`,
    `LAVORAZIONI: ${lavorazioni.join(", ") || "(nessuna)"}.`,
    `LUOGHI: ${luoghi.join(", ") || "(nessuno)"}.`,
  ].join("\n");
}

export async function POST(req: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const rl = checkRateLimit(
    rateLimitKey(req, "ai"),
    RATE_LIMITS.ai.limit,
    RATE_LIMITS.ai.windowMs,
  );
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Troppe richieste all'assistente. Riprova tra poco." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      { error: "Assistente non configurato (manca ANTHROPIC_API_KEY)." },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON non valido" }, { status: 400 });
  }

  const rawMessages = (body as { messages?: unknown })?.messages;
  if (!Array.isArray(rawMessages) || rawMessages.length === 0) {
    return NextResponse.json({ error: "Nessun messaggio" }, { status: 400 });
  }
  const clientMessages: ClientMessage[] = [];
  for (const m of rawMessages.slice(-MAX_MESSAGES)) {
    const role = (m as ClientMessage)?.role;
    const content = (m as ClientMessage)?.content;
    if ((role !== "user" && role !== "assistant") || typeof content !== "string")
      continue;
    const text = content.trim();
    if (!text) continue;
    clientMessages.push({ role, content: text.slice(0, MAX_LEN) });
  }
  if (clientMessages.length === 0 || clientMessages.at(-1)?.role !== "user") {
    return NextResponse.json(
      { error: "Manca una domanda dell'utente." },
      { status: 400 },
    );
  }

  const [entries, users] = await Promise.all([
    prisma.timeEntry.findMany({
      select: {
        date: true,
        hours: true,
        mansione: true,
        luogo: true,
        area: true,
        userId: true,
      },
    }),
    prisma.user.findMany({
      where: { archived: false },
      select: { id: true, displayName: true },
      orderBy: { displayName: "asc" },
    }),
  ]);

  const anthropic = new Anthropic({ apiKey });
  const system: Anthropic.TextBlockParam[] = [
    {
      type: "text",
      text: buildSystemPrompt(entries, users),
      // Prompt caching: il system prompt (roster/lavorazioni/…) si ripete
      // identico → input scontato del 90% sulle chiamate successive.
      cache_control: { type: "ephemeral" },
    },
  ];

  const messages: Anthropic.MessageParam[] = clientMessages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  try {
    for (let turn = 0; turn < MAX_TURNS; turn++) {
      const response = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 1024,
        system,
        tools: [QUERY_TOOL],
        messages,
      });

      if (response.stop_reason !== "tool_use") {
        const reply = response.content
          .filter((b): b is Anthropic.TextBlock => b.type === "text")
          .map((b) => b.text)
          .join("\n")
          .trim();
        return NextResponse.json({
          reply: reply ? stripMarkdown(reply) : "Non sono riuscito a rispondere. Riprova.",
        });
      }

      messages.push({ role: "assistant", content: response.content });

      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const block of response.content) {
        if (block.type !== "tool_use") continue;
        let result: unknown;
        if (block.name === "query_dati") {
          const input = block.input as Parameters<typeof queryDati>[2];
          result =
            input && typeof input.year === "number"
              ? queryDati(entries, users, input)
              : { errore: "Parametro 'year' mancante o non valido." };
        } else {
          result = { errore: `Strumento sconosciuto: ${block.name}` };
        }
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: JSON.stringify(result),
        });
      }
      messages.push({ role: "user", content: toolResults });
    }

    return NextResponse.json({
      reply:
        "La richiesta è troppo complessa da elaborare in pochi passaggi. Prova a semplificarla.",
    });
  } catch (err) {
    console.error("[analisi/chat] Anthropic error:", err);
    return NextResponse.json(
      { error: "Errore dell'assistente. Riprova tra poco." },
      { status: 502 },
    );
  }
}
