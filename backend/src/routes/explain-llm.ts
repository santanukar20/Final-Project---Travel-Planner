import { Router, Request, Response } from 'express';
import { ExplainRequest, ExplainResponse } from '@shared/types';
import { sessionStore } from '../state/sessionStore';
import { generateExplanation, resolveIntentWithFallback } from '../services/llm';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
  try {
    const { sessionId, question, poiId } = req.body as ExplainRequest;
    const session = sessionStore.get(sessionId);

    if (!session) {
      return res.status(404).json({
        error: {
          message: 'Session not found',
          code: 'SESSION_NOT_FOUND',
          details: { sessionId },
        },
      } as any);
    }

    // LLM: Resolve intent with deterministic fallback (never fails)
    const intentResult = await resolveIntentWithFallback(question, 'EXPLAIN');

    // LLM: Generate explanation
    const explanation = await generateExplanation(
      question,
      session.itinerary,
      session.poiResult.pois
    );

    // Add tool trace with intent tracking
    session.toolTrace.calls.push({
      toolName: 'llm_intent_detect',
      inputSummary: `Detect EXPLAIN intent`,
      outputSummary: `Intent: ${intentResult.intent}, Confidence: ${intentResult.confidence.toFixed(2)}, Original: ${(intentResult as any).original || 'N/A'}, Resolved: ${(intentResult as any).resolved || 'N/A'}`,
      timestampISO: new Date().toISOString(),
    });

    session.toolTrace.calls.push({
      toolName: 'llm_generate_explanation',
      inputSummary: `Generate explanation for: ${question}`,
      outputSummary: `Generated explanation with ${(explanation.citations || []).length} citations`,
      timestampISO: new Date().toISOString(),
    });

    res.json({
      answer: explanation.answer,
      citations: explanation.citations || [],
      relatedEvals: [session.evals.feasibility, session.evals.grounding],
      llm: {
        intent: intentResult,
      },
    } as any);
  } catch (error) {
    console.error('[/explain] Error:', error);
    res.status(500).json({
      error: {
        message: (error as any)?.message || 'Internal server error',
        code: 'INTERNAL_ERROR',
        details: process.env.NODE_ENV === 'development' ? { stack: (error as any)?.stack } : undefined,
      },
    });
  }
});

export default router;
