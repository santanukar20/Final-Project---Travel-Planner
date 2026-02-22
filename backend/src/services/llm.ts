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
  quote: z.string().max(200),
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

  // Handle both digit and word numbers for day
  const dayDigitMatch = lower.match(/day\s*(\d+)/);
  const dayWordMatch = lower.match(/day\s*(one|two|three|four|five|1|2|3|4|5)/i);
  
  if (dayDigitMatch) {
    cmd.scope!.dayIndex = parseInt(dayDigitMatch[1], 10) as 1 | 2 | 3;
  } else if (dayWordMatch) {
    const wordToNum: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5 };
    const num = wordToNum[dayWordMatch[1].toLowerCase()] || parseInt(dayWordMatch[1], 10);
    cmd.scope!.dayIndex = num as 1 | 2 | 3;
  }

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

/**
 * Generate context-aware explanation with POI-specific reasoning
 */
export async function generateExplanationV2(params: {
  question: string;
  itinerary: any;
  constraints: any;
  poiCatalog: Record<string, any>;
  targetPoiId?: string;
}): Promise<ExplainResult> {
  const { question, itinerary, constraints, poiCatalog, targetPoiId } = params;

  // Determine mode and POI context BEFORE try block so catch can use it
  let mode: 'poi' | 'itinerary' = 'itinerary';
  let poiContext: any = null;
  let targetSlot: { day: number; timeOfDay: string } | null = null;

  if (targetPoiId && poiCatalog[targetPoiId]) {
    // POI mode: specific POI provided
    mode = 'poi';
    poiContext = poiCatalog[targetPoiId];
    
    // Find where this POI appears in itinerary
    for (let dayIdx = 0; dayIdx < itinerary.days.length; dayIdx++) {
      const day = itinerary.days[dayIdx];
      for (const block of day.blocks) {
        if (block.poiId === targetPoiId) {
          targetSlot = { day: dayIdx + 1, timeOfDay: block.timeOfDay };
          break;
        }
      }
      if (targetSlot) break;
    }
  } else {
    // Try to extract POI name from question (case-insensitive substring match)
    const lowerQuestion = question.toLowerCase();
    let longestMatch = '';
    let matchedPoiId = '';
    
    // Build list of all POI names from itinerary
    for (const day of itinerary.days) {
      for (const block of day.blocks) {
        if (block.poiId && poiCatalog[block.poiId]) {
          const poiName = poiCatalog[block.poiId].name.toLowerCase();
          const blockTitle = block.title.toLowerCase();
            
            // Try matching against both POI name and block title
            // Also split POI name into words for partial matching (e.g., "Albert Hall" matches "Albert Hall Museum")
            const poiWords = poiName.split(/\s+/);
            const titleWords = blockTitle.split(/\s+/);
            
            // Check full name match
            if (lowerQuestion.includes(poiName) && poiName.length > longestMatch.length) {
              longestMatch = poiName;
              matchedPoiId = block.poiId;
            }
            
            // Check title match
            if (lowerQuestion.includes(blockTitle) && blockTitle.length > longestMatch.length) {
              longestMatch = blockTitle;
              matchedPoiId = block.poiId;
            }
            
            // Check partial word match (at least 2 words from POI name)
            if (poiWords.length >= 2) {
              let matchedWords = 0;
              for (const word of poiWords) {
                if (word.length > 3 && lowerQuestion.includes(word)) {
                  matchedWords++;
                }
              }
              if (matchedWords >= 2 && poiName.length > longestMatch.length) {
                longestMatch = poiName;
                matchedPoiId = block.poiId;
              }
            }
            
            // Check partial word match for title
            if (titleWords.length >= 2) {
              let matchedWords = 0;
              for (const word of titleWords) {
                if (word.length > 3 && lowerQuestion.includes(word)) {
                  matchedWords++;
                }
              }
              if (matchedWords >= 2 && blockTitle.length > longestMatch.length) {
                longestMatch = blockTitle;
                matchedPoiId = block.poiId;
              }
            }
          }
        }
      }
      
      if (matchedPoiId) {
        mode = 'poi';
        poiContext = poiCatalog[matchedPoiId];
        
        // Find slot
        for (let dayIdx = 0; dayIdx < itinerary.days.length; dayIdx++) {
          const day = itinerary.days[dayIdx];
          for (const block of day.blocks) {
            if (block.poiId === matchedPoiId) {
              targetSlot = { day: dayIdx + 1, timeOfDay: block.timeOfDay };
              break;
            }
          }
          if (targetSlot) break;
        }
      }
    }

  try {
    let prompt: string;
    let qualityCheck: (answer: string) => boolean;

    if (mode === 'poi' && poiContext && targetSlot) {
      // POI-specific explanation
      const poiMetadata = {
        name: poiContext.name,
        type: poiContext.type,
        typicalDuration: poiContext.typicalDurationHours,
        tags: poiContext.tags,
      };

      prompt = `You are explaining why "${poiContext.name}" was included in a ${constraints.pace} ${constraints.numDays}-day Jaipur itinerary.

STRICT OUTPUT RULES:
1. MUST mention "${poiContext.name}" by name in the first sentence
2. Explain using ONLY this metadata: ${JSON.stringify(poiMetadata, null, 2)}
3. Reference that it's in Day ${targetSlot.day} ${targetSlot.timeOfDay} slot
4. Mention typicalDuration=${poiContext.typicalDurationHours}h fits ${constraints.pace} pace
5. Add 1 practical tip from tags
6. NO generic phrases like "optimized" or "based on available sources"
7. Be conversational and specific

Return ONLY JSON: {"answer": "3-5 sentences explaining why this POI was chosen", "citations": [{"sourceType": "OSM", "ref": "${poiContext.name}", "quote": "POI metadata"}]}

Question: ${question}`;

      qualityCheck = (answer: string) => {
        const lowerAnswer = answer.toLowerCase();
        const poiNameLower = poiContext.name.toLowerCase();
        return lowerAnswer.includes(poiNameLower);
      };
    } else {
      // Itinerary-wide explanation
      const itineraryPois = itinerary.days.flatMap((day: any, dayIdx: number) =>
        day.blocks
          .filter((b: any) => b.poiId && poiCatalog[b.poiId])
          .map((b: any) => ({
            day: dayIdx + 1,
            timeOfDay: b.timeOfDay,
            name: poiCatalog[b.poiId].name,
            type: poiCatalog[b.poiId].type,
          }))
      );

      prompt = `You are explaining a ${constraints.pace} ${constraints.numDays}-day Jaipur itinerary.

STRICT OUTPUT RULES:
1. MUST mention at least 2 POI names from: ${itineraryPois.map((p: any) => p.name).join(', ')}
2. Explain day-by-day flow with specific POI types (${itineraryPois.map((p: any) => p.type).join(', ')})
3. Reference ${constraints.pace} pace and ${constraints.numDays} days
4. NO generic phrases like "optimized" or "based on available sources"
5. Be conversational and specific

Return ONLY JSON: {"answer": "3-5 sentences explaining the itinerary logic", "citations": [{"sourceType": "OSM", "ref": "Jaipur", "quote": "POI data"}]}

Question: ${question}
POIs: ${JSON.stringify(itineraryPois, null, 2)}`;

      qualityCheck = (answer: string) => {
        const lowerAnswer = answer.toLowerCase();
        let mentionedCount = 0;
        for (const poi of itineraryPois.slice(0, 3)) {
          if (lowerAnswer.includes(poi.name.toLowerCase())) mentionedCount++;
        }
        return mentionedCount >= 2;
      };
    }

    console.log(`[EXPLAIN] Mode: ${mode}, POI: ${poiContext?.name || 'N/A'}, Slot: ${targetSlot ? `Day ${targetSlot.day} ${targetSlot.timeOfDay}` : 'N/A'}`);

    // Try LLM with quality check
    let result = await callGroqJson(prompt);
    let explanation = ExplainResultSchema.parse(result);

    if (!qualityCheck(explanation.answer)) {
      console.warn('[EXPLAIN] Quality check failed, retrying with stronger instruction...');
      prompt = prompt.replace('STRICT OUTPUT RULES:', 'CRITICAL: YOU WILL BE PENALIZED IF YOU USE GENERIC TEXT. STRICT OUTPUT RULES:');
      result = await callGroqJson(prompt);
      explanation = ExplainResultSchema.parse(result);
    }

    // Final quality check - use deterministic fallback if still bad
    if (!qualityCheck(explanation.answer)) {
      console.warn('[EXPLAIN] Quality check failed again, using deterministic fallback');
      
      if (mode === 'poi' && poiContext && targetSlot) {
        explanation.answer = `${poiContext.name} is a ${poiContext.type} site included in your Day ${targetSlot.day} ${targetSlot.timeOfDay} slot. It typically takes ${poiContext.typicalDurationHours} hours to visit, which fits your ${constraints.pace} pace perfectly. This location was selected from OpenStreetMap data for its cultural significance and accessibility in Jaipur.`;
      } else {
        const firstTwo = itinerary.days[0]?.blocks.slice(0, 2).map((b: any) => b.title).join(' and ') || 'key sites';
        explanation.answer = `Your ${constraints.numDays}-day ${constraints.pace}-paced Jaipur itinerary includes ${firstTwo}, carefully selected to balance cultural experiences with comfortable timing. Each day is structured with morning, afternoon, and evening activities chosen from verified OpenStreetMap points of interest.`;
      }
    }

    return explanation;
  } catch (err) {
    console.error("[EXPLAIN] Generation failed completely, using emergency fallback", err);
    
    // Emergency deterministic fallback - USE MATCHED POI CONTEXT if available
    if (mode === 'poi' && poiContext && targetSlot) {
      return {
        answer: `${poiContext.name} is included in your Day ${targetSlot.day} ${targetSlot.timeOfDay} slot. As a ${poiContext.type || 'notable'} site in Jaipur, it typically takes ${poiContext.typicalDurationHours || 1.5} hours to visit, fitting well with your ${constraints.pace} pace. This location was selected from OpenStreetMap data for its cultural significance.`,
        citations: [{ sourceType: 'OSM', ref: poiContext.name, quote: 'POI data' }],
      };
    } else {
      const firstPoi = itinerary.days[0]?.blocks[0]?.title || 'activities';
      return {
        answer: `Your ${constraints.numDays}-day Jaipur itinerary starts with ${firstPoi}, selected for its cultural significance and accessibility. The ${constraints.pace} pace ensures comfortable exploration with proper time at each location.`,
        citations: [{ sourceType: 'OSM', ref: 'Jaipur', quote: 'POI data' }],
      };
    }
  }
}

// Keep old function for backward compatibility
export async function generateExplanation(
  question: string,
  itinerary: any,
  sources: any
): Promise<ExplainResult> {
  console.warn('[EXPLAIN] Using deprecated generateExplanation, switch to generateExplanationV2');
  return {
    answer: `The itinerary was designed based on available sources and optimization criteria.`,
    citations: [],
  };
}
