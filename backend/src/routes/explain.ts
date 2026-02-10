import { Router, Request, Response } from 'express';
import { ExplainRequest, ExplainResponse } from '@shared/types';
import { sessionStore } from '../state/sessionStore';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
  try {
    const { sessionId, question, poiId } = req.body as ExplainRequest;
    const session = sessionStore.get(sessionId);

    if (!session) {
      return res.status(404).json({ answer: '', citations: [] });
    }

    const answer =
      poiId === 'osm:node:1'
        ? 'Amber Fort was selected because it is a UNESCO World Heritage Site and offers stunning views of Jaipur. It is a must-see for understanding the city\'s Mughal history.'
        : 'This POI was selected based on your interests in culture and food, and availability within your daily time constraints.';

    res.json({
      answer,
      citations: [
        {
          source: 'Wikivoyage',
          page: 'Jaipur',
          anchor: 'See',
          snippet: 'Amber Fort is a magnificent fortified palace complex.',
        },
      ],
      relatedEvals: [session.evals.feasibility, session.evals.grounding],
    } as ExplainResponse);
  } catch (error) {
    res.status(500).json({ answer: '', citations: [] });
  }
});

export default router;
