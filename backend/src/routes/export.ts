import { Router, Request, Response } from 'express';
import { ExportRequest, ExportResponse } from '@shared/types';
import { sessionStore } from '../state/sessionStore';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
  try {
    const { sessionId, emailTo } = req.body as ExportRequest;
    const session = sessionStore.get(sessionId);

    if (!session) {
      return res.status(404).json({ status: 'failed', message: 'Session not found' });
    }

    res.json({
      status: 'queued',
      message: `Itinerary queued for export to ${emailTo}`,
    } as ExportResponse);
  } catch (error) {
    res.status(500).json({ status: 'failed', message: 'Export failed' });
  }
});

export default router;
