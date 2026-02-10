import { ItineraryBuilderInput, ItineraryBuilderResult, POI, Pace } from '@shared/types';
import { osrmRouteMcp } from './osrm_route_mcp';

export async function itineraryBuilderMcp(input: ItineraryBuilderInput): Promise<ItineraryBuilderResult> {
  // Sort POIs deterministically by confidence (desc) then id (asc)
  const sortedPoiIds = input.candidatePoiIds.sort((a, b) => {
    const poiA = input.poiCatalog[a];
    const poiB = input.poiCatalog[b];
    if (!poiA || !poiB) return a.localeCompare(b);
    
    if (poiB.confidence !== poiA.confidence) {
      return poiB.confidence - poiA.confidence;
    }
    return a.localeCompare(b);
  });

  // Filter POIs by interests
  const culturePoiIds = sortedPoiIds.filter((id) => {
    const poi = input.poiCatalog[id];
    return (
      poi.type === 'attraction' ||
      poi.type === 'museum' ||
      poi.type === 'viewpoint' ||
      poi.type === 'historic' ||
      poi.type === 'place_of_worship' ||
      poi.tags?.tourism?.includes('attraction') ||
      poi.tags?.tourism?.includes('museum') ||
      poi.tags?.amenity === 'place_of_worship'
    );
  });

  const foodPoiIds = sortedPoiIds.filter((id) => {
    const poi = input.poiCatalog[id];
    return (
      poi.type === 'restaurant' ||
      poi.type === 'cafe' ||
      poi.type === 'fast_food' ||
      poi.tags?.amenity?.includes('restaurant') ||
      poi.tags?.amenity?.includes('cafe') ||
      poi.tags?.amenity?.includes('fast_food')
    );
  });

  // Determine blocks per day based on pace
  const blocksPerDay = input.pace === 'relaxed' ? 2 : 3;

  const days = [];
  const usedPoiIds = new Set<string>();

  for (let dayNum = 1; dayNum <= input.days; dayNum++) {
    const blocks = [];
    const dayBlocks: ('Morning' | 'Afternoon' | 'Evening')[] =
      input.pace === 'relaxed'
        ? ['Morning', 'Evening']
        : ['Morning', 'Afternoon', 'Evening'];

    let prevBlockPoi: POI | null = null;

    for (const timeOfDay of dayBlocks) {
      let selectedPoiId: string | null = null;
      let selectedPoi: POI | null = null;

      // Select POI based on time of day and interests
      if (timeOfDay === 'Morning') {
        // Morning: prefer culture POIs
        const availableCulturePoiIds = culturePoiIds.filter((id) => !usedPoiIds.has(id));
        if (availableCulturePoiIds.length > 0) {
          selectedPoiId = availableCulturePoiIds[0];
        } else {
          const availablePoiIds = sortedPoiIds.filter((id) => !usedPoiIds.has(id));
          if (availablePoiIds.length > 0) {
            selectedPoiId = availablePoiIds[0];
          }
        }
      } else if (timeOfDay === 'Afternoon') {
        // Afternoon: prefer culture POIs (second pick)
        const availableCulturePoiIds = culturePoiIds.filter((id) => !usedPoiIds.has(id));
        if (availableCulturePoiIds.length > 0) {
          selectedPoiId = availableCulturePoiIds[0];
        } else {
          const availablePoiIds = sortedPoiIds.filter((id) => !usedPoiIds.has(id));
          if (availablePoiIds.length > 0) {
            selectedPoiId = availablePoiIds[0];
          }
        }
      } else if (timeOfDay === 'Evening') {
        // Evening: prefer food/restaurant POIs if food interest
        if (input.candidatePoiIds.some((id) => foodPoiIds.includes(id))) {
          const availableFoodPoiIds = foodPoiIds.filter((id) => !usedPoiIds.has(id));
          if (availableFoodPoiIds.length > 0) {
            selectedPoiId = availableFoodPoiIds[0];
          }
        }
        // If no food POI, leave as null (rest/free time)
      }

      // Mark POI as used
      if (selectedPoiId) {
        usedPoiIds.add(selectedPoiId);
        selectedPoi = input.poiCatalog[selectedPoiId];
      }

      // Compute travel time from previous POI using OSRM if applicable
      let travelFromPrev: any = {
        mode: 'mixed' as const,
        minutes: timeOfDay === 'Morning' ? 15 : 25,
        method: 'distance_bucket' as const,
      };

      // Try OSRM only if we have a selected POI and a previous POI from this day
      if (selectedPoi && prevBlockPoi) {
        const osrmResult = await osrmRouteMcp({
          startLat: prevBlockPoi.location.lat,
          startLon: prevBlockPoi.location.lon,
          endLat: selectedPoi.location.lat,
          endLon: selectedPoi.location.lon,
        });

        if (osrmResult) {
          travelFromPrev = {
            mode: 'mixed' as const,
            minutes: osrmResult.durationMinutes,
            method: 'osrm' as const,
          };
        }
      }

      blocks.push({
        timeOfDay,
        poiId: selectedPoiId,
        title: selectedPoi?.name || (timeOfDay === 'Evening' ? 'Free time / Rest' : `${timeOfDay} activity`),
        durationHours: selectedPoi
          ? selectedPoi.typicalDurationHours
          : timeOfDay === 'Evening'
            ? 2.0
            : 1.5,
        travelFromPrev,
        notes: selectedPoi
          ? [
              `${selectedPoi.name} - ${selectedPoi.type}`,
              selectedPoi.tags?.name ? `Category: ${selectedPoi.tags.name}` : '',
            ].filter(Boolean)
          : ['Rest and relaxation'],
      });

      // Track this block's POI for next iteration's OSRM calculation
      if (selectedPoi) {
        prevBlockPoi = selectedPoi;
      }
    }

    days.push({
      name: `Day ${dayNum}`,
      blocks,
      totalPlannedHours: blocks.reduce((sum, b) => sum + b.durationHours, 0) + 1.5,
    });
  }

  // Calculate unselected POIs
  const unselectedPoiIds = input.candidatePoiIds.filter((id) => !usedPoiIds.has(id));

  return {
    itinerary: {
      city: input.city,
      days,
      meta: {
        assumptions: [
          'Travel times use distance bucket heuristics',
          `POIs selected based on interests: ${input.pace} pace`,
          `${input.days} day(s) with max ${input.dailyTimeLimitHours} hours per day`,
        ],
        unselectedPoiIds,
      },
    },
    meta: {
      unselectedPoiIds,
      assumptions: [
        'Travel times use distance bucket heuristics',
        `POIs selected based on interests: ${input.pace} pace`,
        `${input.days} day(s) with max ${input.dailyTimeLimitHours} hours per day`,
      ],
    },
  };
}
