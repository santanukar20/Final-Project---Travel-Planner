import { Router, Request, Response } from 'express';
import { EditRequest, EditResponse, SessionState } from '@shared/types';
import { sessionStore } from '../state/sessionStore';
import { evaluateEditCorrectness } from '../evals/edit_correctness';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
  try {
    const { sessionId, utterance } = req.body as EditRequest;
    let session = sessionStore.get(sessionId);

    if (!session) {
      return res.status(404).json({ session: {} as SessionState });
    }

    session.itinerary.days[0].blocks[0].notes.push(`Edit: ${utterance}`);
    session.updatedAtISO = new Date().toISOString();

    const editCorrectness = await evaluateEditCorrectness();
    session.evals.editCorrectness = editCorrectness;

    sessionStore.set(sessionId, session);
    res.json({ session });
  } catch (error) {
    res.status(500).json({ session: {} as SessionState });
  }
});

export default router;
