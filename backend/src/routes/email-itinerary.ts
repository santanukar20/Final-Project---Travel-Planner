import { Router, Request, Response } from 'express';
import { EmailItineraryRequest, EmailItineraryResponse } from '@shared/types';
import { sessionStore } from '../state/sessionStore';
import { sendItineraryEmail } from '../services/emailItinerary';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
  try {
    const { sessionId, toEmail } = req.body as EmailItineraryRequest;

    // Validate inputs
    if (!sessionId || !toEmail) {
      return res.status(400).json({
        ok: false,
        error: 'Missing sessionId or toEmail',
      } as EmailItineraryResponse);
    }

    // Validate email format (basic)
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(toEmail)) {
      return res.status(400).json({
        ok: false,
        error: 'Invalid email address',
      } as EmailItineraryResponse);
    }

    // Load session
    let session = sessionStore.get(sessionId);
    if (!session) {
      return res.status(404).json({
        ok: false,
        error: 'Session not found',
      } as EmailItineraryResponse);
    }

    // Validate session has itinerary
    if (!session.itinerary || !session.itinerary.days || session.itinerary.days.length === 0) {
      return res.status(400).json({
        ok: false,
        error: 'No itinerary found in session',
      } as EmailItineraryResponse);
    }

    // Log the request
    const startTime = performance.now();
    console.log('[/email-itinerary] Request:', { sessionId, toEmail });

    // Call n8n service
    const result = await sendItineraryEmail({
      toEmail,
      sessionId,
      itinerary: session.itinerary,
      constraints: session.constraints,
      sources: session.poiCatalog,
    });

    const duration = Math.round(performance.now() - startTime);

    if (result.ok) {
      console.log('[/email-itinerary] Success:', { duration, messageId: result.messageId });
      return res.json(result as EmailItineraryResponse);
    } else {
      console.error('[/email-itinerary] Failed:', { duration, error: result.error });
      return res.status(500).json(result as EmailItineraryResponse);
    }
  } catch (error: any) {
    console.error('[/email-itinerary] Error:', error);
    return res.status(500).json({
      ok: false,
      error: error.message || 'Internal server error',
    } as EmailItineraryResponse);
  }
});

export default router;
