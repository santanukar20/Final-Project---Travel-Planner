import { Router, Request, Response } from 'express';
import { PlanRequest, PlanResponse, Constraints, SessionState, POI } from '@shared/types';
import { sessionStore } from '../state/sessionStore';
import { poiSearchMcp } from '../tools/poi_search_mcp';
import { itineraryBuilderMcp } from '../tools/itinerary_builder_mcp';
import { wikivoyageMcp } from '../tools/wikivoyage_mcp';
import { weatherMcp } from '../tools/weather_mcp';
import { evaluateFeasibility } from '../evals/feasibility';
import { evaluateGrounding } from '../evals/grounding';

const router = Router();

router.post('/', async (req: Request<{}, {}, PlanRequest>, res: Response<PlanResponse>) => {
  try {
    const { utterance, sessionId, defaults } = req.body;
    const newSessionId = sessionId || sessionStore.generateSessionId();

    const constraints: Constraints = {
      city: 'Jaipur',
      numDays: 3,
      datesText: 'next weekend',
      pace: 'normal',
      interests: ['culture', 'food'],
      maxDailyHours: 6,
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

    // Fetch weather tip
    const weatherTips = await weatherMcp({
      city: constraints.city,
      numDays: constraints.numDays,
    });

    // Merge tips
    const allTips = [...tips, ...weatherTips];

    // Build tips trace summary
    let tipsTraceSummary = `Generated ${tips.length} tips`;
    if (tips.length > 0) {
      const anchors = tips
        .map((t) => t.citations?.[0]?.anchor)
        .filter((a) => a)
        .join(', ');
      tipsTraceSummary += ` (sections: ${anchors})`;
    } else {
      const debugHeadings = (global as any).wvDebugHeadings as string[] | undefined;
      if (debugHeadings && debugHeadings.length > 0) {
        const headingStr = debugHeadings.slice(0, 10).join(', ');
        tipsTraceSummary += ` (no match for: Get around/Eat/See). Headings found: ${headingStr}`;
      } else {
        tipsTraceSummary += ' (no sections matched)';
      }
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
    res.json({ session });
  } catch (error) {
    res.status(500).json({ session: {} as SessionState });
  }
});

export default router;
