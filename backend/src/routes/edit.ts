import { Router, Request, Response } from 'express';
import { EditRequest, EditResponse, SessionState, ItineraryBlock, POI } from '@shared/types';
import { sessionStore } from '../state/sessionStore';
import { evaluateEditCorrectness } from '../evals/edit_correctness';
import { extractEditCommand, EditCommand } from '../services/llm';

const router = Router();

/**
 * Apply edit command to itinerary - modifies only the targeted day/block
 */
function applyEditCommand(
  session: SessionState,
  command: EditCommand
): { changedDays: number[]; changedBlocks: string[] } {
  const changedDays: number[] = [];
  const changedBlocks: string[] = [];
  
  const targetDayIndex = command.scope?.dayIndex ? command.scope.dayIndex - 1 : undefined;
  const targetBlock = command.scope?.block;
  
  switch (command.action) {
    case 'MAKE_MORE_RELAXED': {
      // Reduce activities by shortening durations and adding relaxation note
      const daysToModify = targetDayIndex !== undefined 
        ? [session.itinerary.days[targetDayIndex]]
        : session.itinerary.days;
      
      daysToModify.forEach((day, idx) => {
        const actualIdx = targetDayIndex !== undefined ? targetDayIndex : idx;
        const blocks = targetBlock 
          ? day.blocks.filter(b => b.timeOfDay.toLowerCase() === targetBlock)
          : day.blocks;
        
        blocks.forEach(block => {
          // Always reduce duration slightly and add relaxation note
          if (block.durationHours > 1) {
            block.durationHours = Math.max(1, block.durationHours - 0.5);
          }
          block.notes.push('Pace relaxed - take your time');
          changedBlocks.push(`Day ${actualIdx + 1} ${block.timeOfDay}`);
        });
        
        day.totalPlannedHours = day.blocks.reduce((sum, b) => sum + b.durationHours + b.travelFromPrev.minutes / 60, 0);
        changedDays.push(actualIdx);
      });
      break;
    }
    
    case 'REDUCE_TRAVEL': {
      // Remove travel-heavy blocks or mark them as optional
      const daysToModify = targetDayIndex !== undefined 
        ? [session.itinerary.days[targetDayIndex]]
        : session.itinerary.days;
      
      daysToModify.forEach((day, idx) => {
        const actualIdx = targetDayIndex !== undefined ? targetDayIndex : idx;
        day.blocks.forEach(block => {
          if (block.travelFromPrev.minutes > 20) {
            block.notes.push('Consider skipping if short on time');
            changedBlocks.push(`Day ${actualIdx + 1} ${block.timeOfDay}`);
          }
        });
        changedDays.push(actualIdx);
      });
      break;
    }
    
    case 'SWAP_TO_INDOOR': {
      // Mark outdoor POIs with indoor alternative suggestion
      const daysToModify = targetDayIndex !== undefined 
        ? [session.itinerary.days[targetDayIndex]]
        : session.itinerary.days;
      
      daysToModify.forEach((day, idx) => {
        const actualIdx = targetDayIndex !== undefined ? targetDayIndex : idx;
        const blocks = targetBlock 
          ? day.blocks.filter(b => b.timeOfDay.toLowerCase() === targetBlock)
          : day.blocks;
        
        blocks.forEach(block => {
          block.notes.push('Indoor alternative available if weather is poor');
          changedBlocks.push(`Day ${actualIdx + 1} ${block.timeOfDay}`);
        });
        changedDays.push(actualIdx);
      });
      break;
    }
    
    case 'ADD_FOOD_PLACE': {
      // Add food place to evening slot
      const targetDay = targetDayIndex !== undefined 
        ? session.itinerary.days[targetDayIndex]
        : session.itinerary.days[0];
      const actualIdx = targetDayIndex !== undefined ? targetDayIndex : 0;
      
      const eveningBlock = targetDay.blocks.find(b => b.timeOfDay === 'Evening');
      if (eveningBlock) {
        eveningBlock.notes.push('Added: Try local Rajasthani thali at nearby restaurant');
        changedBlocks.push(`Day ${actualIdx + 1} Evening`);
      } else {
        targetDay.blocks.push({
          timeOfDay: 'Evening',
          poiId: null,
          title: 'Local Food Experience',
          durationHours: 1.5,
          travelFromPrev: { mode: 'walk', minutes: 10, method: 'distance_bucket' },
          notes: ['Try authentic Rajasthani thali', 'Dal Baati Churma recommended'],
        });
        changedBlocks.push(`Day ${actualIdx + 1} Evening`);
      }
      changedDays.push(actualIdx);
      break;
    }
    
    case 'SET_PACE': {
      // General pace adjustment
      const pace = command.params?.pace || 'moderate';
      session.constraints.pace = pace === 'moderate' ? 'normal' : pace;
      session.itinerary.days.forEach((day, idx) => {
        changedDays.push(idx);
      });
      break;
    }
  }
  
  return { changedDays: [...new Set(changedDays)], changedBlocks };
}

router.post('/', async (req: Request, res: Response) => {
  try {
    const { sessionId, utterance, intentHint } = req.body as EditRequest;
    
    // Log intent (no backend reclassification - /edit always executes EDIT logic)
    console.log('[/edit] Executing EDIT logic', { intentHint: intentHint || 'none', utterance });
    
    let session = sessionStore.get(sessionId);

    if (!session) {
      console.log('[/edit] Session not found:', sessionId);
      return res.status(404).json({ 
        error: { 
          message: 'No active session. Please create an itinerary first.',
          code: 'NO_SESSION'
        }
      });
    }
    
    if (!session.itinerary || !session.itinerary.days.length) {
      console.log('[/edit] No itinerary in session');
      return res.status(400).json({
        error: {
          message: 'No itinerary to edit. Please create an itinerary first.',
          code: 'NO_ITINERARY'
        }
      });
    }

    console.log('[/edit] Current itinerary has', session.itinerary.days.length, 'days');
    console.log('[/edit] Extracting edit command from:', utterance);
    
    // Extract edit command using LLM with deterministic fallback
    const editCommand = await extractEditCommand(utterance);
    console.log('[/edit] Extracted command:', JSON.stringify(editCommand, null, 2));
    
    // Apply the edit command
    const { changedDays, changedBlocks } = applyEditCommand(session, editCommand);
    console.log('[/edit] Changed days:', changedDays, 'blocks:', changedBlocks);
    
    session.updatedAtISO = new Date().toISOString();

    // Run edit correctness eval
    const editCorrectness = await evaluateEditCorrectness();
    session.evals.editCorrectness = editCorrectness;

    sessionStore.set(sessionId, session);
    
    res.json({ 
      session,
      editApplied: {
        command: editCommand,
        changedDays,
        changedBlocks,
      }
    });
  } catch (error: any) {
    console.error('[/edit] Error:', error);
    res.status(500).json({ 
      error: { 
        message: error.message || 'Failed to apply edit',
        code: 'EDIT_FAILED'
      }
    });
  }
});

export default router;

