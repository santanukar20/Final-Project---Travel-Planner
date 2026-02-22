/**
 * Grounding Evaluation
 * 
 * Measures how well the itinerary is grounded in real data sources:
 * - POI existence: Every recommended place exists in OpenStreetMap
 * - Source coverage: % of blocks with valid OSM/WikiVoyage citations
 * - Coordinate accuracy: POI coordinates match known locations
 * - Content accuracy: WikiVoyage snippets are relevant to the POI
 * 
 * Scoring formula (planned):
 *   groundingScore = (validPOIs / totalPOIs) * 0.6 + (citedBlocks / totalBlocks) * 0.4
 * 
 * Current implementation: Stub returning passed=true
 * Future iteration: Compute actual grounding score from poiCatalog validation
 */
import { EvalResult } from '@shared/types';

export async function evaluateGrounding(): Promise<EvalResult> {
  // TODO: Implement grounding score calculation
  // - Count POIs with valid OSM IDs in poiCatalog
  // - Check citation coverage per block
  // - Return score 0-1 with failures array for ungrounded blocks
  return {
    name: 'grounding',
    passed: true,
    failures: [],
  };
}
