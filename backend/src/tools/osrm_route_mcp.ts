import https from 'https';

export async function osrmRouteMcp(input: {
  startLat: number;
  startLon: number;
  endLat: number;
  endLon: number;
}): Promise<{ durationMinutes: number; distanceKm: number } | null> {
  try {
    // Build OSRM API URL (note: OSRM uses lon,lat order, not lat,lon)
    const url = `https://router.project-osrm.org/route/v1/car/${input.startLon},${input.startLat};${input.endLon},${input.endLat}?overview=false`;

    const result = await fetchOsrmRoute(url);
    return result;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`osrmRouteMcp error: ${errorMsg}`);
    return null;
  }
}

function fetchOsrmRoute(url: string): Promise<{ durationMinutes: number; distanceKm: number } | null> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      console.warn('OSRM request timeout (5s)');
      resolve(null);
    }, 5000);

    https
      .get(url, (response) => {
        let data = '';

        response.on('data', (chunk) => {
          data += chunk;
        });

        response.on('end', () => {
          clearTimeout(timeout);
          try {
            const parsed = JSON.parse(data);

            // Check if route was found
            if (!parsed.routes || parsed.routes.length === 0) {
              console.warn('OSRM: No routes found');
              resolve(null);
              return;
            }

            const route = parsed.routes[0];
            const durationSeconds = route.duration;
            const distanceMeters = route.distance;

            if (durationSeconds === undefined || distanceMeters === undefined) {
              console.warn('OSRM: Missing duration or distance in response');
              resolve(null);
              return;
            }

            const durationMinutes = Math.round(durationSeconds / 60);
            const distanceKm = parseFloat((distanceMeters / 1000).toFixed(2));

            resolve({ durationMinutes, distanceKm });
          } catch (e) {
            console.error('OSRM: Failed to parse response');
            resolve(null);
          }
        });
      })
      .on('error', (err) => {
        clearTimeout(timeout);
        console.error(`OSRM: Network error: ${err.message}`);
        resolve(null);
      });
  });
}
