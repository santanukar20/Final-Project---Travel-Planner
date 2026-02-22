import { Router, Request, Response } from 'express';
import { ExplainRequest, ExplainResponse } from '@shared/types';
import { sessionStore } from '../state/sessionStore';
import { generateExplanationV2, resolveIntentWithFallback } from '../services/llm';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
  try {
    const { sessionId, question, poiId, intentHint } = req.body as ExplainRequest;
    
    // Log intent (no backend reclassification - /explain always executes EXPLAIN logic)
    console.log('[/explain] Executing EXPLAIN logic', { intentHint: intentHint || 'none', question, poiId: poiId || 'none' });
    
    const session = sessionStore.get(sessionId);

    if (!session) {
      console.log('[/explain] Session not found:', sessionId);
      return res.status(404).json({
        error: {
          message: 'Session not found',
          code: 'SESSION_NOT_FOUND',
          details: { sessionId },
        },
      } as any);
    }

    if (!session.itinerary || !session.itinerary.days.length) {
      console.log('[/explain] No itinerary in session');
      return res.status(400).json({
        error: {
          message: 'No itinerary to explain. Please create an itinerary first.',
          code: 'NO_ITINERARY',
        },
      } as any);
    }

    console.log('[/explain] Generating explanation with V2 (POI grounding)');

    // Generate context-aware explanation with POI metadata
    const explanation = await generateExplanationV2({
      question,
      itinerary: session.itinerary,
      constraints: session.constraints,
      poiCatalog: session.poiCatalog,
      targetPoiId: poiId,
    });

    console.log('[/explain] Generated answer:', explanation.answer.slice(0, 100) + '...');

    // Add tool trace
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
