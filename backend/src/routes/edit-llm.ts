import { Router, Request, Response } from 'express';
import { EditRequest, EditResponse, SessionState } from '@shared/types';
import { sessionStore } from '../state/sessionStore';
import { evaluateEditCorrectness } from '../evals/edit_correctness';
import { extractEditCommand, resolveIntentWithFallback } from '../services/llm';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
  try {
    const { sessionId, utterance } = req.body as EditRequest;
    let session = sessionStore.get(sessionId);

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
    const intentResult = await resolveIntentWithFallback(utterance, 'EDIT');

    // LLM: Extract edit command
    const editCommand = await extractEditCommand(utterance);
    console.log('[/edit] extractEditCommand result:', { action: editCommand.action, dayIndex: editCommand.scope?.dayIndex, block: editCommand.scope?.block });

    // Apply edit (simple demo: add note to target day/block or first day)
    const targetDayIndex = (editCommand.scope?.dayIndex || 1) - 1;
    const targetBlock = editCommand.scope?.block || 'morning';
    console.log('[/edit] target:', { dayIndex: editCommand.scope?.dayIndex, targetDayIndex, block: targetBlock, totalDays: session.itinerary.days.length });

    if (targetDayIndex < session.itinerary.days.length) {
      const targetDay = session.itinerary.days[targetDayIndex];
      const blockIndex = targetDay.blocks.findIndex((b) => b.timeOfDay.toLowerCase() === targetBlock.toLowerCase());
      console.log('[/edit] blockIndex search:', { targetBlock, found: blockIndex, availableBlocks: targetDay.blocks.map(b => b.timeOfDay) });
      if (blockIndex >= 0) {
        targetDay.blocks[blockIndex].notes = targetDay.blocks[blockIndex].notes || [];
        targetDay.blocks[blockIndex].notes.push(
          `[${editCommand.action}] ${utterance}`
        );
      }
    }

    session.updatedAtISO = new Date().toISOString();

    const editCorrectness = await evaluateEditCorrectness();
    session.evals.editCorrectness = editCorrectness;

    // Add tool trace with intent tracking
    session.toolTrace.calls.push({
      toolName: 'llm_intent_detect',
      inputSummary: `Detect EDIT intent`,
      outputSummary: `Intent: ${intentResult.intent}, Confidence: ${intentResult.confidence.toFixed(2)}, Original: ${(intentResult as any).original || 'N/A'}, Resolved: ${(intentResult as any).resolved || 'N/A'}`,
      timestampISO: new Date().toISOString(),
    });

    session.toolTrace.calls.push({
      toolName: 'llm_extract_edit_command',
      inputSummary: `Extract edit command`,
      outputSummary: `Action: ${editCommand.action}, Day: ${editCommand.scope?.dayIndex || 'any'}, Block: ${editCommand.scope?.block || 'any'}`,
      timestampISO: new Date().toISOString(),
    });

    sessionStore.set(sessionId, session);
    res.json({
      session,
      llm: {
        intent: intentResult,
        editCommand,
      },
    } as any);
  } catch (error) {
    console.error('[/edit] Error:', error);
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
