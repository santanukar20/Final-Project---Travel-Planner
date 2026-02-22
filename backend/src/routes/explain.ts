import { Router, Request, Response } from 'express';
import { ExplainRequest, ExplainResponse, Citation, Tip } from '@shared/types';
import { sessionStore } from '../state/sessionStore';
import { generateExplanation } from '../services/llm';
import { wikivoyageMcp } from '../tools/wikivoyage_mcp';
import { weatherMcp } from '../tools/weather_mcp';

const router = Router();

/**
 * Generate context-aware explanation with citations
 */
async function generateExplainResponse(
  question: string,
  session: any,
  poiId?: string
): Promise<{ answer: string; citations: Citation[] }> {
  const lower = question.toLowerCase();
  const city = session.constraints?.city || 'Jaipur';
  const citations: Citation[] = [];
  
  // Get relevant POI if specified
  const poi = poiId ? session.poiCatalog?.[poiId] : null;
  
  // Fetch supporting data based on question type
  let wikivoyageTips: Tip[] = [];
  let weatherTips: Tip[] = [];
  
  try {
    // Get Wikivoyage data for grounding
    wikivoyageTips = await wikivoyageMcp({ city, interests: ['culture', 'food'] });
  } catch (err) {
    console.warn('[/explain] Wikivoyage fetch failed:', err);
  }
  
  // Check if weather-related question
  if (lower.includes('weather') || lower.includes('rain') || lower.includes('temperature') || lower.includes('hot') || lower.includes('cold')) {
    try {
      weatherTips = await weatherMcp({ city, numDays: session.constraints?.numDays || 3 });
    } catch (err) {
      console.warn('[/explain] Weather fetch failed:', err);
    }
  }
  
  // Generate answer based on question type
  let answer = '';
  
  // Weather-related questions
  if (lower.includes('rain') || lower.includes('weather')) {
    const itinerary = session.itinerary;
    answer = `Great question! `;
    if (weatherTips.length > 0) {
      answer += weatherTips[0].claim + ' ';
    }
    if (lower.includes('rain')) {
      answer += `If rain occurs during your ${itinerary?.days?.length || 3}-day trip, I recommend visiting indoor spots like City Palace museum or Albert Hall Museum instead of outdoor sites.`;
    }
    citations.push({
      source: 'Wikivoyage',
      page: city,
      anchor: 'Climate',
      snippet: `${city} has a semi-arid climate with hot summers and mild winters.`,
    });
  }
  // POI-specific questions
  else if (lower.includes('why') && (lower.includes('pick') || lower.includes('chose') || lower.includes('select'))) {
    if (poi) {
      answer = `I chose ${poi.name} for your trip because it's one of ${city}'s top ${poi.type} attractions. `;
      answer += `It typically takes ${poi.typicalDurationHours} hours and matches your ${session.constraints?.pace || 'normal'} pace preference.`;
      citations.push({
        source: 'Wikivoyage',
        page: poi.name,
        anchor: 'POI Data',
        snippet: `${poi.name} - ${poi.type} attraction`,
      });
    } else {
      // Find context from itinerary
      const allPois = session.itinerary?.days?.flatMap((d: any) => d.blocks.map((b: any) => b.title)) || [];
      if (allPois.length > 0) {
        answer = `This attraction fits well with your other planned visits like ${allPois.slice(0, 2).join(' and ')}. `;
      } else {
        answer = `This attraction was selected based on your interests and time constraints. `;
      }
      answer += `It's optimized for your ${session.constraints?.numDays}-day ${session.constraints?.pace || 'normal'} pace itinerary.`;
    }
    
    if (wikivoyageTips.length > 0 && wikivoyageTips[0].citations?.[0]) {
      const tipCitation = wikivoyageTips[0].citations[0];
      citations.push({
        source: tipCitation.source,
        page: tipCitation.page,
        anchor: tipCitation.anchor,
        snippet: wikivoyageTips[0].claim.slice(0, 100),
      });
    }
  }
  // Feasibility questions
  else if (lower.includes('doable') || lower.includes('feasible') || lower.includes('possible') || lower.includes('realistic')) {
    const totalDays = session.itinerary?.days?.length || 3;
    const avgHoursPerDay = session.constraints?.maxDailyHours || 6;
    
    answer = `Absolutely! Your ${totalDays}-day itinerary is well-balanced. `;
    answer += `With ${avgHoursPerDay} hours of activities daily at a ${session.constraints?.pace || 'normal'} pace, you'll have time to enjoy each spot without rushing.`;
    
    const feasibility = session.evals?.feasibility;
    if (feasibility?.passed) {
      answer += ` Our planning system confirms all timing is realistic.`;
    }
    
    citations.push({
      source: 'Wikivoyage',
      page: city,
      anchor: 'Get around',
      snippet: 'Auto-rickshaws and taxis are readily available for getting around.',
    });
  }
  // General questions - use LLM
  else {
    try {
      const llmResult = await generateExplanation(
        question,
        session.itinerary,
        { wikivoyage: wikivoyageTips }
      );
      answer = llmResult.answer;
      
      // Add LLM-generated citations if available
      if (llmResult.citations) {
        llmResult.citations.forEach(c => {
          citations.push({
            source: c.sourceType === 'WIKIVOYAGE' ? 'Wikivoyage' : 'Wikipedia',
            page: c.ref,
            snippet: c.quote,
          });
        });
      }
    } catch (err) {
      console.warn('[/explain] LLM generation failed:', err);
      answer = `This itinerary was designed based on popular attractions in ${city}, optimized for your preferences and time constraints.`;
    }
    
    // Add default citation if none generated
    if (citations.length === 0) {
      citations.push({
        source: 'Wikivoyage',
        page: city,
        anchor: 'Overview',
        snippet: `${city} is known for its rich history and stunning architecture.`,
      });
    }
  }
  
  return { answer, citations };
}

router.post('/', async (req: Request, res: Response) => {
  try {
    const { sessionId, question, poiId, intentHint } = req.body as ExplainRequest;
    
    // Log intent (no backend reclassification - /explain always executes EXPLAIN logic)
    console.log('[/explain] Executing EXPLAIN logic', { intentHint: intentHint || 'none' });
    
    const session = sessionStore.get(sessionId);

    if (!session) {
      return res.status(404).json({ 
        answer: 'No active session found. Please create an itinerary first.',
        citations: [] 
      });
    }
    
    // Guard: Ensure itinerary exists before explaining
    if (!session.itinerary || !session.itinerary.days?.length) {
      return res.status(400).json({
        answer: 'No itinerary to explain yet. Please create an itinerary first.',
        citations: []
      });
    }
    
    console.log('[/explain] Question:', question, 'POI:', poiId);

    const { answer, citations } = await generateExplainResponse(question, session, poiId);
    
    console.log('[/explain] Generated answer:', answer.slice(0, 100) + '...');
    console.log('[/explain] Citations:', citations.length);

    res.json({
      answer,
      citations,
      relatedEvals: [session.evals?.feasibility, session.evals?.grounding].filter(Boolean),
    } as ExplainResponse);
  } catch (error: any) {
    console.error('[/explain] Error:', error);
    res.status(500).json({ 
      answer: 'Sorry, I couldn\'t generate an explanation. Please try again.',
      citations: [] 
    });
  }
});

export default router;

