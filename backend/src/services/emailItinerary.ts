/**
 * Email itinerary PDF service.
 * Calls n8n webhook to render PDF and send via Gmail.
 */

const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || 'http://localhost:5678/webhook/send-itinerary';

interface SendItineraryEmailParams {
  toEmail: string;
  sessionId: string;
  itinerary: any;
  constraints: any;
  sources?: any;
  weather?: any;
}

interface N8nWebhookResponse {
  ok: boolean;
  messageId?: string;
  sentTo?: string;
  error?: string;
}

/**
 * Send itinerary PDF via n8n webhook.
 * Calls N8N_WEBHOOK_URL with itinerary data.
 * Returns { ok, messageId, sentTo, error }
 */
export async function sendItineraryEmail(
  params: SendItineraryEmailParams
): Promise<N8nWebhookResponse> {
  const startTime = performance.now();

  try {
    const payload = {
      toEmail: params.toEmail,
      subject: `Your Trip to ${params.constraints?.resolvedCity || params.constraints?.city || 'Trip'} Itinerary`,
      sessionId: params.sessionId,
      itinerary: params.itinerary,
      constraints: params.constraints,
      sources: params.sources || {},
      weather: params.weather || {},
    };

    console.log('[emailItinerary] Calling n8n webhook:', {
      url: N8N_WEBHOOK_URL,
      toEmail: params.toEmail,
      sessionId: params.sessionId,
    });

    const response = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      timeout: 20000, // 20 second timeout
    } as any);

    const duration = Math.round(performance.now() - startTime);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[emailItinerary] HTTP error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
        duration,
      });
      return {
        ok: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    const result = await response.json();
    console.log('[emailItinerary] Success:', { ...result, duration });

    return result;
  } catch (error: any) {
    const duration = Math.round(performance.now() - startTime);
    console.error('[emailItinerary] Error:', {
      message: error.message,
      code: error.code,
      duration,
    });

    return {
      ok: false,
      error: error.message || 'Failed to send email',
    };
  }
}
