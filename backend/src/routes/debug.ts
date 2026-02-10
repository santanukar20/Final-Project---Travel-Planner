import { Router, Request, Response } from 'express';
import https from 'https';
import http from 'http';

const router = Router();

interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

interface SampleResult {
  type: string;
  id: number;
  name?: string;
  lat: number;
  lon: number;
  tags?: Record<string, string>;
}

router.get('/overpass', async (req: Request, res: Response) => {
  try {
    const overpassUrl = process.env.OVERPASS_URL || 'https://overpass-api.de/api/interpreter';

    // Build Overpass QL query for Jaipur (bbox: south,west,north,east = 26.80,75.72,27.05,76.00)
    const bbox = '26.80,75.72,27.05,76.00';
    const query = `[out:json];(node["tourism"~"attraction|museum|viewpoint"](${bbox});way["tourism"~"attraction|museum|viewpoint"](${bbox});relation["tourism"~"attraction|museum|viewpoint"](${bbox}););out tags center 20;`;

    const data = `data=${encodeURIComponent(query)}`;

    const overpassProtocol = overpassUrl.startsWith('https') ? https : http;

    const requestOptions = {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
        'content-length': Buffer.byteLength(data),
      },
      timeout: 30000,
    };

    const result = await new Promise<string>((resolve, reject) => {
      const request = overpassProtocol.request(overpassUrl, requestOptions, (response) => {
        let body = '';
        response.on('data', (chunk) => {
          body += chunk;
        });
        response.on('end', () => {
          if (response.statusCode && response.statusCode >= 200 && response.statusCode < 300) {
            resolve(body);
          } else {
            reject(new Error(`HTTP ${response.statusCode}: ${body}`));
          }
        });
      });

      request.on('error', reject);
      request.on('timeout', () => {
        request.destroy();
        reject(new Error('Request timeout'));
      });

      request.write(data);
      request.end();
    });

    const overpassData = JSON.parse(result);
    const elements: OverpassElement[] = overpassData.elements || [];

    const sample: SampleResult[] = elements
      .slice(0, 20)
      .map((el: OverpassElement) => ({
        type: el.type,
        id: el.id,
        name: el.tags?.name || el.tags?.['name:en'] || 'Unnamed',
        lat: el.lat !== undefined ? el.lat : el.center?.lat || 0,
        lon: el.lon !== undefined ? el.lon : el.center?.lon || 0,
        tags: el.tags,
      }));

    res.json({
      ok: true,
      sampleCount: sample.length,
      sample,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({
      ok: false,
      error: errorMessage,
    });
  }
});

export default router;
