import https from 'https';
import http from 'http';

interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
  boundingbox: string[];
}

interface GeocodeResult {
  resolvedCity: string;
  lat: number;
  lon: number;
  boundingbox: number[];
}

// In-memory cache for city geocoding results
const geoCacheMap = new Map<string, GeocodeResult | null>();

async function fetchJson(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    protocol
      .get(url, { headers: { 'User-Agent': 'Travel-Planner-App (Mozilla/5.0)' } }, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (err) {
            reject(err);
          }
        });
      })
      .on('error', reject);
  });
}

/**
 * Validate if a city exists in India using Nominatim geocoding API.
 * Returns { resolvedCity, lat, lon, boundingbox } or null if not found/not in India.
 */
export async function validateCityInIndia(
  cityName: string
): Promise<GeocodeResult | null> {
  if (!cityName || typeof cityName !== 'string') {
    return null;
  }

  const cacheKey = cityName.toLowerCase();
  if (geoCacheMap.has(cacheKey)) {
    return geoCacheMap.get(cacheKey) || null;
  }

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
      cityName
    )}&countrycodes=in&limit=1`;

    console.log(`[geocode] Searching for city: ${cityName}`);
    const results = await fetchJson(url);

    if (!results || results.length === 0) {
      console.warn(`[geocode] City not found in India: ${cityName}`);
      geoCacheMap.set(cacheKey, null);
      return null;
    }

    const result = results[0] as NominatimResult;
    const geodeResult: GeocodeResult = {
      resolvedCity: result.display_name.split(',')[0].trim(),
      lat: parseFloat(result.lat),
      lon: parseFloat(result.lon),
      boundingbox: result.boundingbox.map((v) => parseFloat(v)),
    };

    console.log(`[geocode] City validated: ${geodeResult.resolvedCity} (${geodeResult.lat}, ${geodeResult.lon})`);
    geoCacheMap.set(cacheKey, geodeResult);
    return geodeResult;
  } catch (err) {
    console.error(`[geocode] Error validating city ${cityName}:`, err);
    geoCacheMap.set(cacheKey, null);
    return null;
  }
}

/**
 * Clear the geocode cache (useful for testing).
 */
export function clearGeocodeCache(): void {
  geoCacheMap.clear();
}
