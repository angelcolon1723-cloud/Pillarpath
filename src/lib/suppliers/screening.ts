/**
 * Kid-safety product screening (server-only).
 *
 * Every supplier product passes through `screenProduct()` before it can reach
 * the storefront. Verdicts:
 *   - `approved`    — confidently kid-related, age-appropriate, no red flags.
 *   - `quarantined` — needs a human reviewer (ambiguous, unlicensed-IP risk,
 *                     missing safety signals, spammy listing…).
 *   - `rejected`    — adult, dangerous, or otherwise disqualifying content.
 *
 * Two engines, conservative by design:
 *   1. `heuristicScreen()` — deterministic keyword/category rules. A heuristic
 *      `rejected` is FINAL (the AI can never override a hard reject).
 *   2. Optional AI provider (`SCREENING_PROVIDER=openai`, any OpenAI-compatible
 *      chat-completions endpoint) — second opinion on anything the heuristics
 *      didn't reject. On AI failure/timeout the heuristic verdict stands, but
 *      never upgrades to `approved` beyond what the heuristics decided.
 *
 * Quarantine-by-default: when neither engine is confident, the product waits
 * for a human. Ambiguity is never auto-approved.
 */

if (typeof window !== "undefined") {
  throw new Error(
    "@/lib/suppliers/screening is server-only — never import it from client code.",
  );
}

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type ScreeningVerdict = "approved" | "quarantined" | "rejected";

export interface ScreeningReason {
  /** Machine-readable code, e.g. "not_kid_related". */
  code: string;
  /** Human-readable explanation. */
  message: string;
  severity: "info" | "warn" | "block";
}

export interface ScreeningInput {
  title: string;
  description?: string;
  category?: string;
  imageUrls?: string[];
  supplierProductId?: string;
  supplier?: string;
}

export interface ScreeningResult {
  verdict: ScreeningVerdict;
  reasons: ScreeningReason[];
  /** Which engine produced the final verdict. */
  provider: "heuristic" | "ai";
  /** ISO timestamp of the screening. */
  checkedAt: string;
}

/** Pluggable AI second-opinion provider. */
export interface AiScreeningProvider {
  readonly name: string;
  screen(input: ScreeningInput): Promise<Pick<ScreeningResult, "verdict" | "reasons">>;
}

/* ------------------------------------------------------------------ */
/* Heuristic engine                                                    */
/* ------------------------------------------------------------------ */

const norm = (s: string | undefined | null) =>
  (s ?? "").toLowerCase().replace(/[''`]/g, "");

function hasAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(text));
}

const word = (w: string) => new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}s?\\b`);

// --- Hard reject: adult, sexual, or physically dangerous content. ---
const REJECT_PATTERNS: { re: RegExp; code: string; message: string }[] = [
  { re: word("gun"), code: "dangerous_item", message: "References a firearm." },
  { re: word("rifle"), code: "dangerous_item", message: "References a firearm." },
  { re: word("pistol"), code: "dangerous_item", message: "References a firearm." },
  { re: word("knife"), code: "dangerous_item", message: "References a bladed weapon." },
  { re: word("blade"), code: "dangerous_item", message: "References a bladed weapon." },
  { re: word("taser"), code: "dangerous_item", message: "References a weapon." },
  { re: word("machete"), code: "dangerous_item", message: "References a weapon." },
  { re: word("crossbow"), code: "dangerous_item", message: "References a weapon." },
  { re: word("vape"), code: "adult_content", message: "References vaping/tobacco products." },
  { re: word("cigarette"), code: "adult_content", message: "References tobacco products." },
  { re: word("cigar"), code: "adult_content", message: "References tobacco products." },
  { re: word("alcohol"), code: "adult_content", message: "References alcohol." },
  { re: word("liquor"), code: "adult_content", message: "References alcohol." },
  { re: word("whiskey"), code: "adult_content", message: "References alcohol." },
  { re: word("vodka"), code: "adult_content", message: "References alcohol." },
  { re: word("beer"), code: "adult_content", message: "References alcohol." },
  { re: word("wine"), code: "adult_content", message: "References alcohol." },
  { re: word("lingerie"), code: "adult_content", message: "Adult apparel." },
  { re: /\bsex(ual|y)?\b/, code: "adult_content", message: "Sexual content." },
  { re: word("porn"), code: "adult_content", message: "Sexual content." },
  { re: word("erotic"), code: "adult_content", message: "Sexual content." },
  { re: word("fetish"), code: "adult_content", message: "Sexual content." },
  { re: word("cannabis"), code: "adult_content", message: "References drugs." },
  { re: word("marijuana"), code: "adult_content", message: "References drugs." },
  { re: word("thc"), code: "adult_content", message: "References drugs." },
  { re: word("cbd"), code: "adult_content", message: "References drugs." },
  { re: word("cocaine"), code: "adult_content", message: "References drugs." },
  { re: /\b18\+/, code: "adult_content", message: "Marketed as 18+." },
  { re: word("firework"), code: "dangerous_item", message: "Fireworks are unsafe for children." },
  { re: word("firecracker"), code: "dangerous_item", message: "Fireworks are unsafe for children." },
  { re: word("chainsaw"), code: "dangerous_item", message: "Dangerous power tool." },
  { re: word("angle grinder"), code: "dangerous_item", message: "Dangerous power tool." },
];

// --- Branded character IP: likely unlicensed when sold via dropship feeds. ---
// Never auto-rejects (a licensed wholesale line is possible) — quarantines.
const IP_PATTERNS: { re: RegExp; label: string }[] = [
  { re: word("disney"), label: "Disney" },
  { re: word("marvel"), label: "Marvel" },
  { re: /star\s*wars/, label: "Star Wars" },
  { re: word("pokemon"), label: "Pokémon" },
  { re: word("nintendo"), label: "Nintendo" },
  { re: word("lego"), label: "LEGO" },
  { re: word("barbie"), label: "Barbie" },
  { re: /hello\s*kitty/, label: "Hello Kitty" },
  { re: /paw\s*patrol/, label: "Paw Patrol" },
  { re: /peppa\s*pig/, label: "Peppa Pig" },
  { re: word("sanrio"), label: "Sanrio" },
  { re: /my\s*little\s*pony/, label: "My Little Pony" },
  { re: word("transformers"), label: "Transformers" },
  { re: /spider[\s-]*man/, label: "Spider-Man" },
  { re: word("batman"), label: "Batman" },
  { re: word("superman"), label: "Superman" },
  { re: word("avengers"), label: "Avengers" },
  { re: word("minions"), label: "Minions" },
  { re: word("minecraft"), label: "Minecraft" },
  { re: word("roblox"), label: "Roblox" },
  { re: word("bluey"), label: "Bluey" },
  { re: word("cocomelon"), label: "Cocomelon" },
  { re: word("elsa"), label: "Frozen/Elsa" },
  { re: /\bfrozen\b.*(doll|toy|dress)/, label: "Frozen" },
  { re: word("hot wheels"), label: "Hot Wheels" },
  { re: word("nerf"), label: "Nerf" },
  { re: word("fisher-price"), label: "Fisher-Price" },
];

// --- Positive kid signals. ---
const KID_POSITIVE = [
  "kid", "kids", "child", "children", "baby", "babies", "toddler", "infant",
  "tween", "teen", "boy", "boys", "girl", "girls", "son", "daughter",
  "toy", "toys", "game", "games", "puzzle", "block", "blocks", "plush",
  "doll", "dolls", "teddy", "stuffed animal", "coloring", "crayon",
  "school", "backpack", "notebook", "pencil", "student", "classroom",
  "play", "playset", "educational", "learning", "preschool", "kindergarten",
  "nursery", "stroller", "diaper", "bottle", "onesie", "crib",
  "cartoon", "fairy", "dinosaur", "pirate", "princess", "superhero",
  "building set", "lego-compatible", "rc car", "kite", "ball pit",
  "art set", "paint set", "drawing", "craft", "sticker",
].map(word);

// --- Clearly-not-for-kids category signals. ---
const NOT_KID_PATTERNS: { re: RegExp; message: string }[] = [
  { re: word("automotive"), message: "Automotive parts are not kids' products." },
  { re: /car\s*parts?/, message: "Car parts are not kids' products." },
  { re: word("engine"), message: "Engine parts are not kids' products." },
  { re: /power\s*tool/, message: "Power tools are not kids' products." },
  { re: word("drill"), message: "Power tools are not kids' products." },
  { re: word("soldering"), message: "Soldering equipment is not for children." },
  { re: word("industrial"), message: "Industrial equipment is not kids' products." },
  { re: word("fishing"), message: "Fishing gear with hooks is not for young children." },
  { re: /hunting/, message: "Hunting gear is not for children." },
  { re: word("motorcycle"), message: "Motorcycle gear is not kids' products." },
  { re: /home\s*improvement/, message: "Home improvement is not kids' products." },
  { re: word("plumbing"), message: "Plumbing supplies are not kids' products." },
  { re: word("fertilizer"), message: "Garden chemicals are not kids' products." },
  { re: word("pesticide"), message: "Pesticides are not kids' products." },
];

// --- Safety-certification signals (positive, informational). ---
const CERT_PATTERNS = [
  /cpsia/, /children'?s product certificate/, /\bcpc\b.*certif/, /astm\s*f?963/,
  /en\s*71/, /phthalate[\s-]*free/, /\bbpa[\s-]*free\b/, /lead[\s-]*free/,
  /non[\s-]*toxic/, /\bce\b.*certified/, /safety\s*tested/,
];

// Young-child markers: products for babies/toddlers carry the highest safety bar.
const YOUNG_CHILD = [word("baby"), word("babies"), word("toddler"), word("infant"), word("newborn"), /0-12\s*months?/, /6-12\s*months?/];

/** Deterministic first pass. A `rejected` verdict here is final. */
export function heuristicScreen(input: ScreeningInput): ScreeningResult {
  const checkedAt = new Date().toISOString();
  const text = norm([input.title, input.description, input.category].filter(Boolean).join(" | "));
  const reasons: ScreeningReason[] = [];

  // 1. Hard rejects first — final.
  for (const p of REJECT_PATTERNS) {
    if (p.re.test(text)) {
      return {
        verdict: "rejected",
        reasons: [{ code: p.code, message: p.message, severity: "block" }],
        provider: "heuristic",
        checkedAt,
      };
    }
  }

  // 2. Branded IP → quarantine (could be licensed, needs a human).
  const ipHit = IP_PATTERNS.find((p) => p.re.test(text));
  if (ipHit) {
    return {
      verdict: "quarantined",
      reasons: [
        {
          code: "unlicensed_ip_risk",
          message: `Mentions "${ipHit.label}" branding — verify it is genuinely licensed before listing.`,
          severity: "warn",
        },
      ],
      provider: "heuristic",
      checkedAt,
    };
  }

  // 3. Kid-relatedness scoring.
  const kidHits = KID_POSITIVE.filter((re) => re.test(text)).length;
  const notKidHit = NOT_KID_PATTERNS.find((p) => p.re.test(text));
  if (notKidHit && kidHits === 0) {
    return {
      verdict: "quarantined",
      reasons: [
        {
          code: "not_kid_related",
          message: `${notKidHit.message} No kid-related signals found.`,
          severity: "warn",
        },
      ],
      provider: "heuristic",
      checkedAt,
    };
  }
  if (kidHits === 0) {
    return {
      verdict: "quarantined",
      reasons: [
        {
          code: "not_kid_related",
          message: "No kid/child-related signals in title, description, or category.",
          severity: "warn",
        },
      ],
      provider: "heuristic",
      checkedAt,
    };
  }
  reasons.push({
    code: "kid_related",
    message: `Matched ${kidHits} kid-related signal${kidHits === 1 ? "" : "s"}.`,
    severity: "info",
  });

  // 4. Safety-certification signals.
  const certHit = CERT_PATTERNS.some((re) => re.test(text));
  const youngChild = hasAny(text, YOUNG_CHILD);
  if (certHit) {
    reasons.push({
      code: "safety_cert_mentioned",
      message: "Listing mentions safety testing/certification language.",
      severity: "info",
    });
  } else if (youngChild) {
    // Highest bar: products explicitly for babies/toddlers should show certs.
    return {
      verdict: "quarantined",
      reasons: [
        ...reasons,
        {
          code: "safety_cert_unverified",
          message:
            "Product is marketed for babies/toddlers but the listing shows no CPSIA/ASTM/CPC safety-certification language — verify before listing.",
          severity: "warn",
        },
      ],
      provider: "heuristic",
      checkedAt,
    };
  }

  // 5. Spammy-listing signals → human review.
  const title = input.title ?? "";
  if (title.length > 12 && title === title.toUpperCase() && /[A-Z]/.test(title)) {
    return {
      verdict: "quarantined",
      reasons: [
        ...reasons,
        { code: "spam_signals", message: "Title is all-caps — possible spam listing.", severity: "warn" },
      ],
      provider: "heuristic",
      checkedAt,
    };
  }
  if ((title.match(/!/g) ?? []).length >= 3) {
    return {
      verdict: "quarantined",
      reasons: [
        ...reasons,
        { code: "spam_signals", message: "Excessive punctuation in title — possible spam listing.", severity: "warn" },
      ],
      provider: "heuristic",
      checkedAt,
    };
  }

  return { verdict: "approved", reasons, provider: "heuristic", checkedAt };
}

/* ------------------------------------------------------------------ */
/* AI provider (OpenAI-compatible chat completions)                     */
/* ------------------------------------------------------------------ */

const AI_TIMEOUT_MS = 25_000;

export class OpenAiCompatibleScreeningProvider implements AiScreeningProvider {
  readonly name = "openai-compatible";
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly model: string;

  constructor(opts: { apiKey: string; baseUrl?: string; model?: string }) {
    this.apiKey = opts.apiKey;
    this.baseUrl = (opts.baseUrl ?? "https://api.openai.com/v1").replace(/\/$/, "");
    this.model = opts.model ?? "gpt-4o-mini";
  }

  async screen(input: ScreeningInput): Promise<Pick<ScreeningResult, "verdict" | "reasons">> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
    try {
      const res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.model,
          temperature: 0,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content:
                "You screen dropshipped products for a children's store. " +
                "Decide: is this product genuinely for kids, age-appropriate, and safe to list? " +
                "Reject adult, sexual, or dangerous items (weapons, vaping, alcohol, drugs). " +
                "Quarantine anything ambiguous: unclear kid-relevance, branded character names that may be unlicensed " +
                "(Disney, Marvel, Pokémon, LEGO, Barbie, etc.), baby/toddler products without safety-certification mentions, or spammy listings. " +
                "Respond with strict JSON only: {\"verdict\": \"approved\"|\"quarantined\"|\"rejected\", " +
                "\"reasons\": [{\"code\": \"snake_case\", \"message\": \"...\"}]}. " +
                "Be conservative: when unsure, quarantine.",
            },
            {
              role: "user",
              content: JSON.stringify({
                title: input.title,
                description: input.description ?? "",
                category: input.category ?? "",
              }),
            },
          ],
        }),
      });
      if (!res.ok) throw new Error(`AI screening HTTP ${res.status}`);
      const body = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const content = body.choices?.[0]?.message?.content ?? "";
      const parsed = JSON.parse(content) as {
        verdict?: string;
        reasons?: { code?: string; message?: string }[];
      };
      const verdict: ScreeningVerdict =
        parsed.verdict === "approved" || parsed.verdict === "rejected" || parsed.verdict === "quarantined"
          ? parsed.verdict
          : "quarantined"; // unparseable verdict → quarantine, never approve
      const reasons: ScreeningReason[] = Array.isArray(parsed.reasons)
        ? parsed.reasons.map((r) => ({
            code: typeof r.code === "string" && r.code ? r.code : "ai_flag",
            message: typeof r.message === "string" && r.message ? r.message : "Flagged by AI review.",
            severity: (verdict === "rejected" ? "block" : verdict === "quarantined" ? "warn" : "info") as ScreeningReason["severity"],
          }))
        : [{ code: "ai_review", message: "Reviewed by AI.", severity: "info" as const }];
      return { verdict, reasons };
    } finally {
      clearTimeout(timer);
    }
  }
}

/** Build the configured AI provider, or null when AI screening is off. */
export function createAiProviderFromEnv(): AiScreeningProvider | null {
  const provider = process.env.SCREENING_PROVIDER?.trim().toLowerCase();
  if (provider !== "openai") return null;
  const apiKey = process.env.SCREENING_AI_API_KEY?.trim();
  if (!apiKey) return null;
  return new OpenAiCompatibleScreeningProvider({
    apiKey,
    baseUrl: process.env.SCREENING_AI_BASE_URL?.trim() || undefined,
    model: process.env.SCREENING_AI_MODEL?.trim() || undefined,
  });
}

/* ------------------------------------------------------------------ */
/* Orchestrator                                                        */
/* ------------------------------------------------------------------ */

/**
 * Screen one supplier product. Heuristics run first and a heuristic `rejected`
 * is final. Otherwise the AI provider (when configured) gives a second
 * opinion; any failure falls back to the heuristic verdict. Uncertainty
 * quarantines — it never approves.
 */
export async function screenProduct(input: ScreeningInput): Promise<ScreeningResult> {
  const heuristic = heuristicScreen(input);
  if (heuristic.verdict === "rejected") return heuristic;

  const ai = createAiProviderFromEnv();
  if (!ai) return heuristic;

  try {
    const aiResult = await ai.screen(input);
    // The AI may only move the verdict DOWN the confidence ladder, except it
    // may lift a heuristic quarantine to approved when it is confident.
    if (heuristic.verdict === "quarantined" && aiResult.verdict === "approved") {
      return {
        verdict: "approved",
        reasons: [
          ...heuristic.reasons,
          ...aiResult.reasons.map((r) => ({ ...r, severity: "info" as const })),
          {
            code: "ai_second_opinion",
            message: "AI review cleared the heuristic quarantine flags.",
            severity: "info" as const,
          },
        ],
        provider: "ai",
        checkedAt: new Date().toISOString(),
      };
    }
    if (aiResult.verdict === "rejected" || aiResult.verdict === "quarantined") {
      return {
        verdict: aiResult.verdict,
        reasons: [...heuristic.reasons, ...aiResult.reasons],
        provider: "ai",
        checkedAt: new Date().toISOString(),
      };
    }
    return heuristic;
  } catch {
    // AI unavailable or misbehaving: keep the heuristic verdict as-is.
    return heuristic;
  }
}
