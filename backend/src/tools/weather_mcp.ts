import https from 'https';
import { Tip } from '@shared/types';

export async function weatherMcp(input: { city: string; numDays: number }): Promise<Tip[]> {
  try {
    const startTime = Date.now();
    const timeoutMs = 5000;

    // Step 1: Geocode city to get coordinates
    const geoData = await fetchWithTimeout(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(input.city)}&count=1&language=en&format=json`,
      timeoutMs - (Date.now() - startTime)
    );

    if (!geoData) {
      return [];
    }

    const parsed = JSON.parse(geoData);
    if (!parsed.results || parsed.results.length === 0) {
      console.warn(`Weather: No geocoding results for ${input.city}`);
      return [];
    }

    const result = parsed.results[0];
    const lat = result.latitude;
    const lon = result.longitude;
    const timezone = result.timezone;

    if (lat === undefined || lon === undefined) {
      console.warn('Weather: Missing latitude or longitude in geocoding response');
      return [];
    }

    // Step 2: Fetch forecast
    const forecastData = await fetchWithTimeout(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&timezone=${timezone}&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&forecast_days=${input.numDays}`,
      timeoutMs - (Date.now() - startTime)
    );

    if (!forecastData) {
      return [];
    }

    const forecastParsed = JSON.parse(forecastData);
    if (!forecastParsed.daily) {
      console.warn('Weather: Missing daily data in forecast response');
      return [];
    }

    const daily = forecastParsed.daily;
    const tempMaxArray = daily.temperature_2m_max as number[];
    const precipArray = daily.precipitation_probability_max as number[];

    if (!tempMaxArray || tempMaxArray.length === 0) {
      console.warn('Weather: Missing temperature data');
      return [];
    }

    // Step 3: Compute averages
    const avgTemp = Math.round(tempMaxArray.reduce((a, b) => a + b, 0) / tempMaxArray.length);
    const avgPrecip = precipArray && precipArray.length > 0
      ? Math.round(precipArray.reduce((a, b) => a + b, 0) / precipArray.length)
      : 0;

    // Step 4: Generate weather tip deterministically
    let tempClaim = '';
    if (avgTemp < 15) {
      tempClaim = `Expect cold weather with temperatures around ${avgTemp}°C; bring layers and warm clothing.`;
    } else if (avgTemp < 25) {
      tempClaim = `Moderate temperatures around ${avgTemp}°C; comfortable for outdoor activities.`;
    } else {
      tempClaim = `Hot weather with temperatures reaching ${avgTemp}°C; stay hydrated and use sun protection.`;
    }

    let precipClaim = '';
    if (avgPrecip > 50) {
      precipClaim = `High chance of rain (${avgPrecip}%); carry an umbrella or waterproof jacket.`;
    } else if (avgPrecip > 20) {
      precipClaim = `Some rain possible (${avgPrecip}%); consider packing a light rain cover.`;
    }

    // Combine claims into single sentence
    const fullClaim = precipClaim ? `${tempClaim} ${precipClaim}` : tempClaim;

    return [
      {
        id: 'tip_weather_1',
        claim: fullClaim,
        citations: [
          {
            source: 'Open-Meteo' as any,
            page: 'Forecast',
          },
        ],
        confidence: 'medium',
        isGeneralAdvice: false,
      },
    ];
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`weatherMcp error: ${errorMsg}`);
    return [];
  }
}

function fetchWithTimeout(url: string, timeoutMs: number): Promise<string | null> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      console.warn('Weather API request timeout');
      resolve(null);
    }, timeoutMs);

    https
      .get(url, (response) => {
        let data = '';

        response.on('data', (chunk) => {
          data += chunk;
        });

        response.on('end', () => {
          clearTimeout(timeout);
          resolve(data);
        });
      })
      .on('error', (err) => {
        clearTimeout(timeout);
        console.error(`Weather API network error: ${err.message}`);
        resolve(null);
      });
  });
}
