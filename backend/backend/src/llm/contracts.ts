import { z } from 'zod';

export const IntentResultSchema = z.object({
  intent: z.enum(['PLAN', 'EDIT', 'EXPLAIN', 'UNKNOWN']),
  confidence: z.number().min(0).max(1),
  rationale: z.string().min(1).max(200)
});
export type IntentResult = z.infer<typeof IntentResultSchema>;

export const PlanConstraintsLLMSchema = z.object({
  city: z.string().optional(),
  numDays: z.number().int().min(1).max(7).optional(),
  pace: z.enum(['relaxed', 'moderate', 'packed']).optional(),
  interests: z.array(z.string()).max(5).optional(),
  maxDailyHours: z.number().min(1).max(12).optional()
});
export type PlanConstraintsLLM = z.infer<typeof PlanConstraintsLLMSchema>;

export const EditCommandSchema = z.object({
  action: z.enum(['SET_PACE', 'MAKE_MORE_RELAXED', 'REDUCE_TRAVEL', 'SWAP_TO_INDOOR', 'ADD_FOOD_PLACE']),
  scope: z.object({
    dayIndex: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
    block: z.enum(['morning', 'afternoon', 'evening']).optional()
  }).optional(),
  params: z.object({
    pace: z.enum(['relaxed', 'moderate', 'packed']).optional(),
    note: z.string().optional()
  }).optional()
});
export type EditCommand = z.infer<typeof EditCommandSchema>;

export const CitationSchema = z.object({
  sourceType: z.enum(['OSM', 'WIKIVOYAGE', 'WEATHER']),
  ref: z.string(),
  quote: z.string().max(15)
});
export const ExplainResultSchema = z.object({
  answer: z.string().min(1),
  citations: z.array(CitationSchema).optional()
});
export type ExplainResult = z.infer<typeof ExplainResultSchema>;

export function validateIntentResult(data: unknown): IntentResult {
  return IntentResultSchema.parse(data);
}
export function validatePlanConstraints(data: unknown): PlanConstraintsLLM {
  return PlanConstraintsLLMSchema.parse(data);
}
export function validateEditCommand(data: unknown): EditCommand {
  return EditCommandSchema.parse(data);
}
export function validateExplainResult(data: unknown): ExplainResult {
  return ExplainResultSchema.parse(data);
}
