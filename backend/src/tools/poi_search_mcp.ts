import { POISearchInput, POISearchResult, POI } from '@shared/types';
import https from 'https';
import http from 'http';

// Fallback mock POIs (used when Overpass fails)
const MOCK_POIS: POI[] = [
  {
    id: 'osm:node:1',
    name: 'Amber Fort',
    type: 'historic',
    tags: { tourism: 'attraction', historic: 'fort' },
    location: { lat: 26.9389, lon: 75.6513 },
    typicalDurationHours: 2.5,
    confidence: 0.95,
    source: 'Mock',
  },
  {
    id: 'osm:node:2',
    name: 'City Palace',
    type: 'historic',
    tags: { tourism: 'attraction', historic: 'palace' },
    location: { lat: 26.9245, lon: 75.8231 },
    typicalDurationHours: 1.5,
    confidence: 0.92,
    source: 'Mock',
  },
  {
    id: 'osm:node:3',
    name: 'Jantar Mantar',
    type: 'historic',
    tags: { tourism: 'attraction', historic: 'monument' },
    location: { lat: 26.9245, lon: 75.8261 },
    typicalDurationHours: 1.0,
    confidence: 0.88,
    source: 'Mock',
  },
  {
    id: 'osm:node:4',
    name: 'Hawa Mahal',
    type: 'historic',
    tags: { tourism: 'attraction', historic: 'building' },
    location: { lat: 26.9245, lon: 75.8277 },
    typicalDurationHours: 0.75,
    confidence: 0.90,
    source: 'Mock',
  },
  {
    id: 'osm:node:5',
    name: 'Sardar Market',
    type: 'market',
    tags: { tourism: 'attraction', shop: 'market' },
    location: { lat: 26.9245, lon: 75.8267 },
    typicalDurationHours: 1.5,
    confidence: 0.85,
    source: 'Mock',
  },
  {
    id: 'osm:node:6',
    name: 'Chokhi Dhani',
    type: 'restaurant',
    tags: { tourism: 'restaurant', cuisine: 'indian' },
    location: { lat: 26.8667, lon: 75.7833 },
    typicalDurationHours: 2.0,
    confidence: 0.87,
    source: 'Mock',
  },
  {
    id: 'osm:node:7',
    name: 'Niros Restaurant',
    type: 'restaurant',
    tags: { tourism: 'restaurant', cuisine: 'indian;continental' },
    location: { lat: 26.9245, lon: 75.8231 },
    typicalDurationHours: 1.5,
    confidence: 0.84,
    source: 'Mock',
  },
  {
    id: 'osm:node:8',
    name: 'Albert Hall Museum',
    type: 'museum',
    tags: { tourism: 'museum' },
    location: { lat: 26.9234, lon: 75.8254 },
    typicalDurationHours: 1.5,
    confidence: 0.83,
    source: 'Mock',
  },
  {
    id: 'osm:node:9',
    name: 'Govind Dev Ji Temple',
    type: 'temple',
    tags: { tourism: 'attraction', religion: 'hindu' },
    location: { lat: 26.9234, lon: 75.8254 },
    typicalDurationHours: 1.0,
    confidence: 0.81,
    source: 'Mock',
  },
  {
    id: 'osm:node:10',
    name: 'Jal Mahal',
    type: 'historic',
    tags: { tourism: 'attraction', historic: 'palace' },
    location: { lat: 26.9667, lon: 75.8000 },
    typicalDurationHours: 0.75,
    confidence: 0.79,
    source: 'Mock',
  },
];

interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

export async function poiSearchMcp(input: POISearchInput): Promise<POISearchResult> {
  try {
    const overpassUrl = process.env.OVERPASS_URL || 'https://overpass-api.de/api/interpreter';
    const bbox = '26.80,75.72,27.05,76.00'; // Jaipur bbox

    // Build Overpass query
    const query = buildOverpassQuery(bbox);
    const overpassData = await queryOverpass(overpassUrl, query);

    // Extract and map elements
    const elements: OverpassElement[] = overpassData.elements || [];

    if (!elements || elements.length === 0) {
      return {
        city: input.city,
        pois: MOCK_POIS.slice(0, input.maxCandidates),
        fallbackUsed: true,
        fallbackReason: 'Overpass returned no elements',
      };
    }

    // Transform Overpass elements to POI objects
    const pois = elements
      .filter((el: OverpassElement) => {
        const lat = el.lat !== undefined ? el.lat : el.center?.lat;
        const lon = el.lon !== undefined ? el.lon : el.center?.lon;
        return lat !== undefined && lon !== undefined;
      })
      .map((el: OverpassElement) => {
        const lat = el.lat !== undefined ? el.lat : el.center!.lat;
        const lon = el.lon !== undefined ? el.lon : el.center!.lon;
        const name = el.tags?.['name:en'] || el.tags?.name || 'Unnamed';
        const poiType = deriveType(el.tags || {});
        const typicalDurationHours = estimateDuration(el.tags || {});

        return {
          id: `osm:${el.type}:${el.id}`,
          name,
          type: poiType,
          tags: el.tags || {},
          location: { lat, lon },
          typicalDurationHours,
          confidence: 0.85,
          source: 'OpenStreetMap' as const,
        };
      })
      .filter((poi: POI) => {
        // Exclude unnamed POIs
        if (!poi.name || poi.name.trim().toLowerCase() === 'unnamed') {
          return false;
        }
        // Exclude unnamed fast food stalls
        if (poi.type === 'fast_food' && (!poi.name || poi.name.trim().length === 0)) {
          return false;
        }
        return true;
      })
      .slice(0, input.maxCandidates);

    // Sanity check: ensure we got real Overpass data
    if (pois.length > 0 && pois.every((p) => p.source !== 'OpenStreetMap')) {
      return {
        city: input.city,
        pois: MOCK_POIS.slice(0, input.maxCandidates),
        fallbackUsed: true,
        fallbackReason: 'Sanity check: no OpenStreetMap POIs found, reverting to fallback',
      };
    }

    return {
      city: input.city,
      pois,
      fallbackUsed: false,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      city: input.city,
      pois: MOCK_POIS.slice(0, input.maxCandidates),
      fallbackUsed: true,
      fallbackReason: `Overpass error: ${errorMessage}`,
    };
  }
}

function buildOverpassQuery(bbox: string): string {
  const lines: string[] = [];
  lines.push('[out:json];');
  lines.push('(');
  // Tourism attractions/museums/viewpoints
  lines.push(`  node["tourism"~"attraction|museum|viewpoint"](${bbox});`);
  lines.push(`  way["tourism"~"attraction|museum|viewpoint"](${bbox});`);
  lines.push(`  relation["tourism"~"attraction|museum|viewpoint"](${bbox});`);
  // Restaurants/cafes/fast food
  lines.push(`  node["amenity"~"restaurant|cafe|fast_food"](${bbox});`);
  lines.push(`  way["amenity"~"restaurant|cafe|fast_food"](${bbox});`);
  lines.push(`  relation["amenity"~"restaurant|cafe|fast_food"](${bbox});`);
  // Places of worship
  lines.push(`  node["amenity"="place_of_worship"](${bbox});`);
  lines.push(`  way["amenity"="place_of_worship"](${bbox});`);
  lines.push(`  relation["amenity"="place_of_worship"](${bbox});`);
  lines.push(');');
  lines.push('out tags center 500;');
  return lines.join('');
}

function queryOverpass(overpassUrl: string, query: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const data = `data=${encodeURIComponent(query)}`;
    const protocol = overpassUrl.startsWith('https') ? https : http;

    const requestOptions = {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
        'content-length': Buffer.byteLength(data),
      },
      timeout: 30000,
    };

    const request = protocol.request(overpassUrl, requestOptions, (response) => {
      let body = '';
      response.on('data', (chunk) => {
        body += chunk;
      });
      response.on('end', () => {
        if (response.statusCode && response.statusCode >= 200 && response.statusCode < 300) {
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            reject(new Error(`Failed to parse Overpass JSON: ${e instanceof Error ? e.message : String(e)}`));
          }
        } else {
          reject(new Error(`HTTP ${response.statusCode}`));
        }
      });
    });

    request.on('error', reject);
    request.on('timeout', () => {
      request.destroy();
      reject(new Error('Overpass request timeout'));
    });

    request.write(data);
    request.end();
  });
}

function deriveType(tags: Record<string, string>): string {
  if (tags.tourism) {
    if (tags.tourism.includes('museum')) return 'museum';
    if (tags.tourism.includes('viewpoint')) return 'viewpoint';
    return 'attraction';
  }
  if (tags.amenity) {
    if (tags.amenity.includes('restaurant')) return 'restaurant';
    if (tags.amenity.includes('cafe')) return 'cafe';
    if (tags.amenity.includes('fast_food')) return 'fast_food';
    if (tags.amenity === 'place_of_worship') return 'place_of_worship';
  }
  if (tags.historic) return 'historic';
  return 'poi';
}

function estimateDuration(tags: Record<string, string>): number {
  if (tags.tourism === 'museum') return 1.5;
  if (tags.tourism === 'viewpoint') return 0.75;
  if (tags.tourism === 'attraction') return 1.5;
  if (tags.amenity === 'restaurant') return 1.5;
  if (tags.amenity === 'cafe') return 1.0;
  if (tags.amenity === 'fast_food') return 0.75;
  if (tags.amenity === 'place_of_worship') return 1.0;
  if (tags.historic) return 1.5;
  return 1.0;
}
