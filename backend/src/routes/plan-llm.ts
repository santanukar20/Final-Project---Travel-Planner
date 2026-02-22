import { Router, Request, Response } from 'express';
import { PlanRequest, PlanResponse, Constraints, SessionState, POI, Pace } from '@shared/types';
import { sessionStore } from '../state/sessionStore';
import { poiSearchMcp } from '../tools/poi_search_mcp';
import { itineraryBuilderMcp } from '../tools/itinerary_builder_mcp';
import { wikivoyageMcp } from '../tools/wikivoyage_mcp';
import { weatherMcp } from '../tools/weather_mcp';
import { evaluateFeasibility } from '../evals/feasibility';
import { evaluateGrounding } from '../evals/grounding';
import { extractPlanConstraints } from '../services/llm';
import { validateCityInIndia } from '../services/geocode';
import { extractCityDeterministic } from '../services/cityExtract';;

const router = Router();

router.post('/', async (req: Request<{}, {}, PlanRequest>, res: Response<PlanResponse>) => {
  try {
    const { utterance, sessionId, defaults, intentHint } = req.body;
    const newSessionId = sessionId || sessionStore.generateSessionId();

    // Log intent (no backend reclassification - /plan always executes PLAN logic)
    console.log('[/plan] Executing PLAN logic', { intentHint: intentHint || 'none', utterance });

    // JAIPUR DEMO: Hard-lock city to Jaipur - ignore transcript city extraction
    const LOCKED_CITY = 'Jaipur';
    console.log('[/plan] CITY_LOCK: Using hard-coded city:', LOCKED_CITY);
    
    // LLM: Extract constraints (but ignore city)
    const extractedConstraints = await extractPlanConstraints(utterance);
    
    // Use pre-defined Jaipur coordinates (skip geocoding API call)
    const geocodeResult = {
      resolvedCity: LOCKED_CITY,
      lat: 26.9124,
      lon: 75.7873,
    };

    // Clamp numDays to 2-5
    let numDays = extractedConstraints.numDays || 3;
    if (numDays < 2) numDays = 3;
    if (numDays > 5) numDays = 5;

    // Map extracted pace to Pace type (moderate -> normal)
    const mappedPace: Pace = extractedConstraints.pace === 'moderate' ? 'normal' : extractedConstraints.pace || 'normal';

    const constraints: Constraints = {
      city: geocodeResult.resolvedCity,
      resolvedCity: geocodeResult.resolvedCity,
      lat: geocodeResult.lat,
      lon: geocodeResult.lon,
      numDays,
      datesText: 'next weekend',
      pace: mappedPace,
      interests: extractedConstraints.interests || ['culture', 'food'],
      maxDailyHours: extractedConstraints.maxDailyHours || 6,
      indoorPreference: false,
      notes: [utterance],
      ...defaults,
    };

    const poiResult = await poiSearchMcp({
      city: constraints.city,
      interests: constraints.interests,
      pace: constraints.pace,
      maxCandidates: 10,
    });

    const poiCatalog: Record<string, POI> = {};
    poiResult.pois.forEach((poi) => {
      poiCatalog[poi.id] = poi;
    });

    const itineraryResult = await itineraryBuilderMcp({
      city: constraints.city,
      days: constraints.numDays,
      dailyTimeLimitHours: constraints.maxDailyHours,
      pace: constraints.pace,
      candidatePoiIds: poiResult.pois.map((p) => p.id),
      poiCatalog,
      maxPoisPerDay: 3,
      startEndLocation: 'hotel',
    });

    const feasibilityEval = await evaluateFeasibility();
    const groundingEval = await evaluateGrounding();
    const selectedPoiCount = poiResult.pois.length - itineraryResult.meta.unselectedPoiIds.length;

    const tips = await wikivoyageMcp({
      city: constraints.city,
      interests: constraints.interests,
    });

    const weatherTips = await weatherMcp({
      city: constraints.city,
      numDays: constraints.numDays,
    });

    const allTips = [...tips, ...weatherTips];

    let tipsTraceSummary = `Generated ${tips.length} tips`;
    if (tips.length > 0) {
      const anchors = tips
        .map((t) => t.citations?.[0]?.anchor)
        .filter((a) => a)
        .join(', ');
      tipsTraceSummary += ` (sections: ${anchors})`;
    } else {
      tipsTraceSummary += ' (no sections matched)';
    }

    const session: SessionState = {
      sessionId: newSessionId,
      constraints,
      poiResult,
      poiCatalog,
      itinerary: itineraryResult.itinerary,
      dayHashes: {},
      tips: allTips.length > 0 ? allTips : [],
      evals: {
        feasibility: feasibilityEval,
        editCorrectness: null,
        grounding: groundingEval,
      },
      toolTrace: {
        calls: [
          {
            toolName: 'llm_extract_constraints',
            inputSummary: `Extract constraints from utterance`,
            outputSummary: `Pace: ${extractedConstraints.pace || 'default'}, Interests: ${(extractedConstraints.interests || []).join(', ') || 'default'}`,
            timestampISO: new Date().toISOString(),
          },
          {
            toolName: 'poi_search_mcp',
            inputSummary: `Search POIs in ${constraints.city} for ${constraints.interests.join(', ')}`,
            outputSummary: poiResult.fallbackUsed ? `Found ${poiResult.pois.length} POIs (source=Mock fallbackUsed=true reason=${poiResult.fallbackReason})` : `Found ${poiResult.pois.length} POIs (source=Overpass)`,
            timestampISO: new Date().toISOString(),
          },
          {
            toolName: 'itinerary_builder_mcp',
            inputSummary: `Build ${constraints.numDays}-day itinerary`,
            outputSummary: `Created ${itineraryResult.itinerary.days.length} days with ${selectedPoiCount} POIs selected`,
            timestampISO: new Date().toISOString(),
          },
          {
            toolName: 'wikivoyage_mcp',
            inputSummary: `Fetch tips for ${constraints.city}`,
            outputSummary: tipsTraceSummary,
            timestampISO: new Date().toISOString(),
          },
          {
            toolName: 'weather_mcp',
            inputSummary: `Fetch weather forecast for ${constraints.city}`,
            outputSummary: `Generated ${weatherTips.length} weather tip(s)`,
            timestampISO: new Date().toISOString(),
          },
        ],
      },
      clarificationCount: 0,
      createdAtISO: new Date().toISOString(),
      updatedAtISO: new Date().toISOString(),
    };

    sessionStore.set(newSessionId, session);
    res.json({
      session,
      llm: {
        extractedConstraints,
      },
    } as any);
  } catch (error) {
    console.error('[/plan] Error:', error);
    res.status(500).json({
      error: {
        message: (error as any)?.message || 'Internal server error',
        code: 'INTERNAL_ERROR',
        details: process.env.NODE_ENV === 'development' ? { stack: (error as any)?.stack } : undefined,
      },
    } as any);
  }
});

export default router;
