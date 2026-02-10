import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const MODEL = process.env.GROQ_MODEL ?? "llama-3.1-8b-instant";

function safeJsonExtract(text: string): any {
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error("No JSON object found in LLM output");
  }
  return JSON.parse(text.slice(firstBrace, lastBrace + 1));
}

async function groqJson(prompt: string): Promise<any> {
  const resp = await groq.chat.completions.create({
    model: MODEL,
    temperature: 0,
    max_tokens: 500,
    messages: [
      { role: "system", content: "You are a strict JSON generator. Output ONLY valid JSON. No markdown." },
      { role: "user", content: prompt },
    ],
  });
  return safeJsonExtract(resp.choices?.[0]?.message?.content ?? "");
}

export type Intent = "PLAN" | "EDIT" | "EXPLAIN" | "UNKNOWN";

export async function detectIntent(transcript: string) {
  const prompt = `Return ONLY JSON: { "intent": "PLAN|EDIT|EXPLAIN|UNKNOWN", "confidence": 0.0, "rationale": "short reason" } Utterance: ${JSON.stringify(transcript)}`;
  return await groqJson(prompt);
}

export async function extractPlanConstraints(transcript: string) {
  const prompt = `Extract constraints. Return ONLY JSON: { "pace": "relaxed|moderate|packed", "interests": ["culture","food"], "maxDailyHours": 6 } Transcript: ${JSON.stringify(transcript)}`;
  return await groqJson(prompt);
}

export async function extractEditCommand(transcript: string, constraints: any) {
  const prompt = `Return ONLY JSON: { "action": "SET_PACE|SWAP_TO_INDOOR|REDUCE_TRAVEL|ADD_FOOD_PLACE|MAKE_MORE_RELAXED", "scope": { "dayIndex": 1, "block": "morning" }, "params": {} } Transcript: ${JSON.stringify(transcript)}`;
  return await groqJson(prompt);
}