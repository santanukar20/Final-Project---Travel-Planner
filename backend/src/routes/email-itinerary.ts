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
    const session = sessionStore.get(sessionId);
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

    // Call email service
    const result = await sendItineraryEmail({
      toEmail,
      sessionId,
      itinerary: session.itinerary,
      constraints: session.constraints,
      sources: session.poiCatalog,
    });

    if (result.ok) {
      return res.json({
        ok: true,
        requestId: result.requestId,
        messageId: result.messageId,
        sentTo: result.sentTo,
        dryRun: result.dryRun,
        pdfSizeBytes: result.pdfSizeBytes,
      } as EmailItineraryResponse);
    } else {
      return res.status(500).json({
        ok: false,
        requestId: result.requestId,
        error: result.error,
      } as EmailItineraryResponse);
    }
  } catch (error: any) {
    console.error('[/email-itinerary] Unhandled error:', error);
    return res.status(500).json({
      ok: false,
      error: error.message || 'Internal server error',
    } as EmailItineraryResponse);
  }
});

export default router;
