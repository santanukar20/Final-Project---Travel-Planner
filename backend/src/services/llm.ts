import Groq from "groq-sdk";
import { z } from "zod";
import { extractCityDeterministic } from "./cityExtract";

const LLM_DISABLED = process.env.LLM_DISABLED === "true";
const groq = LLM_DISABLED ? null : new Groq({ apiKey: process.env.GROQ_API_KEY });
const MODEL = process.env.GROQ_MODEL ?? "llama-3.1-8b-instant";

// ============ SCHEMAS ============
export const IntentResultSchema = z.object({
  intent: z.enum(["PLAN", "EDIT", "EXPLAIN", "UNKNOWN"]),
  confidence: z.number().min(0).max(1),
  rationale: z.string().min(1).max(500),
});
export type IntentResult = z.infer<typeof IntentResultSchema>;

export const PlanConstraintsSchema = z.object({
  city: z.string().optional(),
  numDays: z.number().int().min(1).max(7).optional(),
  pace: z.enum(["relaxed", "moderate", "packed"]).optional(),
  interests: z.array(z.string()).max(5).optional(),
  maxDailyHours: z.number().min(1).max(12).optional(),
});
export type PlanConstraints = z.infer<typeof PlanConstraintsSchema>;

export const EditCommandSchema = z.object({
  action: z.enum([
    "SET_PACE",
    "MAKE_MORE_RELAXED",
    "REDUCE_TRAVEL",
    "SWAP_TO_INDOOR",
    "ADD_FOOD_PLACE",
  ]),
  scope: z
    .object({
      dayIndex: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
      block: z.enum(["morning", "afternoon", "evening"]).optional(),
    })
    .optional(),
  params: z
    .object({
      pace: z.enum(["relaxed", "moderate", "packed"]).optional(),
      note: z.string().optional(),
    })
    .optional(),
});
export type EditCommand = z.infer<typeof EditCommandSchema>;

export const CitationSchema = z.object({
  sourceType: z.enum(["OSM", "WIKIVOYAGE", "WEATHER"]),
  ref: z.string(),
  quote: z.string().max(15),
});

export const ExplainResultSchema = z.object({
  answer: z.string().min(1),
  citations: z.array(CitationSchema).optional(),
});
export type ExplainResult = z.infer<typeof ExplainResultSchema>;

// ============ GROQ CLIENT ============
function safeJsonExtract(text: string): any {
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error("No JSON object found in LLM output");
  }
  return JSON.parse(text.slice(firstBrace, lastBrace + 1));
}

async function callGroqJson(
  prompt: string,
  retryOnce = true
): Promise<any> {
  if (LLM_DISABLED || !groq) {
    throw new Error("LLM disabled");
  }

  try {
    const resp = await groq.chat.completions.create({
      model: MODEL,
      temperature: 0,
      max_tokens: 500,
      messages: [
        {
          role: "system",
          content:
            "You are a strict JSON generator. Output ONLY valid JSON. No markdown. No prose.",
        },
        { role: "user", content: prompt },
      ],
    });
    return safeJsonExtract(resp.choices?.[0]?.message?.content ?? "");
  } catch (err) {
    if (retryOnce) {
      const retryPrompt =
        "Your previous output was invalid JSON. Output ONLY valid JSON now.\n" +
        prompt;
      return callGroqJson(retryPrompt, false);
    }
    throw err;
  }
}

// ============ DETERMINISTIC FALLBACKS ============
function fallbackIntent(transcript: string): IntentResult {
  const lower = transcript.toLowerCase();
  let intent: "PLAN" | "EDIT" | "EXPLAIN" | "UNKNOWN" = "UNKNOWN";
  let confidence = 0.4;

  if (lower.match(/plan|create|build|show|itinerary|suggest|trip|travel|days|vacation|explore/)) {
    intent = "PLAN";
    confidence = 0.8;
  } else if (lower.match(/change|swap|add|remove|edit|modify|replace/)) {
    intent = "EDIT";
    confidence = 0.75;
  } else if (lower.match(/why|explain|how|feasible|doable|possible/)) {
    intent = "EXPLAIN";
    confidence = 0.6;
  }

  return {
    intent,
    confidence,
    rationale: `fallback: keyword matching (${intent.toLowerCase()})`,
  };
}

function fallbackPlanConstraints(transcript: string): PlanConstraints {
  const lower = transcript.toLowerCase();
  const constraints: PlanConstraints = {};

  // Try deterministic extraction first (fast and reliable)
  const cityDeterministic = extractCityDeterministic(transcript);
  if (cityDeterministic) {
    constraints.city = cityDeterministic;
  }

  // Extract pace
  if (lower.includes('relaxed') || lower.includes('easy')) {
    constraints.pace = 'relaxed';
  } else if (lower.includes('packed') || lower.includes('busy')) {
    constraints.pace = 'packed';
  } else {
    constraints.pace = 'moderate';
  }

  // Extract numDays and clamp to 2-5
  const dayMatch = transcript.match(/(\d+)\s*day/);
  if (dayMatch) {
    let days = parseInt(dayMatch[1], 10);
    if (days < 2) days = 3; // default to 3 if too small
    if (days > 5) days = 5; // clamp to max 5
    constraints.numDays = days;
  }

  // Extract interests
  if (lower.match(/culture|history|monument/)) {
    constraints.interests = ['culture'];
  } else if (lower.match(/food|eat|restaurant/)) {
    constraints.interests = ['food'];
  }

  return constraints;
}

function fallbackEditCommand(transcript: string): EditCommand {
  const lower = transcript.toLowerCase();
  let action: EditCommand["action"] = "SET_PACE";

  if (lower.match(/relaxed|slow|calm/)) action = "MAKE_MORE_RELAXED";
  else if (lower.match(/reduce|shorten|less.*travel/)) action = "REDUCE_TRAVEL";
  else if (lower.match(/indoor|rain|weather|inside/)) action = "SWAP_TO_INDOOR";
  else if (lower.match(/food|eat|restaurant/)) action = "ADD_FOOD_PLACE";
  else if (lower.match(/pace|speed|fast/)) action = "SET_PACE";

  const cmd: EditCommand = { action, scope: {} };

  const dayMatch = lower.match(/day\s*(\d+)/);
  if (dayMatch) cmd.scope!.dayIndex = parseInt(dayMatch[1], 10) as 1 | 2 | 3;

  if (lower.includes("morning")) cmd.scope!.block = "morning";
  else if (lower.includes("afternoon")) cmd.scope!.block = "afternoon";
  else if (lower.includes("evening")) cmd.scope!.block = "evening";

  return cmd;
}

// ============ MAIN EXPORTS ============
export async function detectIntent(
  transcript: string
): Promise<IntentResult> {
  try {
    const prompt = `You are an intent classifier for a travel itinerary assistant.

PLAN = user wants to create/plan/build/show an itinerary or trip
EDIT = user wants to modify/change/swap existing plans
EXPLAIN = user wants to understand WHY something is in the itinerary
UNKNOWN = user asks non-travel questions

If the user mentions: planning, days, trip, travel, itinerary, or a city name
→ MUST return intent = PLAN

Return UNKNOWN only for clearly non-travel content like science/history questions.

Return ONLY JSON: {"intent": "PLAN|EDIT|EXPLAIN|UNKNOWN", "confidence": 0..1, "rationale": "max 100 chars"}
Utterance: ${JSON.stringify(transcript)}`;

    const result = await callGroqJson(prompt);
    // Truncate rationale if too long
    if (result.rationale && result.rationale.length > 500) {
      result.rationale = result.rationale.substring(0, 497) + "...";
    }
    return IntentResultSchema.parse(result);
  } catch (err) {
    console.warn("[LLM] Intent detection failed, using fallback", err);
    return fallbackIntent(transcript);
  }
}

export async function resolveIntentForEndpoint(
  transcript: string,
  requestedIntent: "PLAN" | "EDIT" | "EXPLAIN"
): Promise<IntentResult> {
  const detected = await detectIntent(transcript);

  if (detected.intent === "UNKNOWN" && requestedIntent === "PLAN") {
    console.warn(`[/plan] Coercing UNKNOWN intent to PLAN for utterance: ${transcript}`);
    return {
      intent: "PLAN",
      confidence: 0.6,
      rationale: "forced PLAN fallback for itinerary request",
    };
  }

  return detected;
}

export async function resolveIntentWithFallback(
  transcript: string,
  requestedIntent: "PLAN" | "EDIT" | "EXPLAIN"
): Promise<IntentResult & { original?: string; resolved?: string }> {
  const lower = transcript.toLowerCase();

  if (lower.match(/why|explain|how|reason|doable|feasible|what if|rain/)) {
    console.log(`[resolveIntent] EXPLAIN keywords detected, skipping LLM`);
    return {
      intent: "EXPLAIN",
      confidence: 0.9,
      rationale: "deterministic keyword match (explain)",
      original: "EXPLAIN (keywords)",
      resolved: "EXPLAIN",
    };
  }

  if (lower.match(/change|swap|make|add|remove|move|replace|more relaxed|reduce travel|stay in hotel/)) {
    console.log(`[resolveIntent] EDIT keywords detected, skipping LLM`);
    return {
      intent: "EDIT",
      confidence: 0.9,
      rationale: "deterministic keyword match (edit)",
      original: "EDIT (keywords)",
      resolved: "EDIT",
    };
  }

  if (lower.match(/plan|itinerary|trip|days|travel|vacation|explore/)) {
    console.log(`[resolveIntent] PLAN keywords detected, skipping LLM`);
    return {
      intent: "PLAN",
      confidence: 0.9,
      rationale: "deterministic keyword match (plan)",
      original: "PLAN (keywords)",
      resolved: "PLAN",
    };
  }

  console.log(`[resolveIntent] No keywords matched, calling LLM for intent detection`);
  const detected = await detectIntent(transcript);

  if (detected.intent === "UNKNOWN") {
    console.warn(
      `[resolveIntent] LLM returned UNKNOWN for requestedIntent=${requestedIntent}, coercing`
    );
    return {
      intent: requestedIntent,
      confidence: 0.6,
      rationale: `forced fallback to ${requestedIntent} due to UNKNOWN detection`,
      original: "UNKNOWN",
      resolved: requestedIntent,
    };
  }

  return {
    ...detected,
    original: detected.intent,
    resolved: detected.intent,
  };
}

export async function extractPlanConstraints(
  transcript: string
): Promise<PlanConstraints> {
  try {
    const prompt = `Extract travel constraints.
Return ONLY JSON: {"pace": "relaxed|moderate|packed", "interests": [...], "maxDailyHours": number, "numDays": number}
Transcript: ${JSON.stringify(transcript)}`;

    const result = await callGroqJson(prompt);
    return PlanConstraintsSchema.parse(result);
  } catch (err) {
    console.warn("[LLM] Plan constraints extraction failed, using fallback", err);
    return fallbackPlanConstraints(transcript);
  }
}

export async function extractEditCommand(
  transcript: string
): Promise<EditCommand> {
  try {
    const prompt = `Extract edit command.
Return ONLY JSON: {"action": "SET_PACE|MAKE_MORE_RELAXED|REDUCE_TRAVEL|SWAP_TO_INDOOR|ADD_FOOD_PLACE", "scope": {"dayIndex": 1|2|3, "block": "morning|afternoon|evening"}, "params": {}}
Transcript: ${JSON.stringify(transcript)}`;

    const result = await callGroqJson(prompt);
    return EditCommandSchema.parse(result);
  } catch (err) {
    console.warn("[LLM] Edit command extraction failed, using fallback", err);
    return fallbackEditCommand(transcript);
  }
}

export async function generateExplanation(
  question: string,
  itinerary: any,
  sources: any
): Promise<ExplainResult> {
  try {
    const sourceSummary = sources
      ? `Available sources: ${JSON.stringify(Object.keys(sources))}`
      : "No sources available";
    const prompt = `Generate explanation based on itinerary.
Return ONLY JSON: {"answer": "...", "citations": [{"sourceType": "OSM|WIKIVOYAGE|WEATHER", "ref": "...", "quote": "..."}]}
Question: ${JSON.stringify(question)}
${sourceSummary}`;

    const result = await callGroqJson(prompt);
    return ExplainResultSchema.parse(result);
  } catch (err) {
    console.warn("[LLM] Explanation generation failed, using fallback", err);
    return {
      answer: `The itinerary was designed based on available sources and optimization criteria.`,
      citations: [],
    };
  }
}
