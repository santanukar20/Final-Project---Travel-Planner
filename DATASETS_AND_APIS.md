# Datasets & External APIs Reference

Complete reference of all external data sources used by the Travel Planner.

---

## Summary Table

| Service | Purpose | Free Tier | API Key | Rate Limit | Status |
|---------|---------|-----------|---------|-----------|--------|
| **Groq** | LLM for itinerary generation | ✅ Free tier | ✅ Required | 30 req/min | ✅ Active |
| **OpenStreetMap Nominatim** | City geocoding | ✅ Free | ❌ No | 1 req/sec | ✅ Active |
| **OpenStreetMap Overpass** | POI data fetching | ✅ Free | ❌ No | 20 req/min | ✅ Active |
| **OSRM** | Route calculation (travel time) | ✅ Free | ❌ No | Unlimited | ✅ Active |
| **Open-Meteo** | Weather forecasts | ✅ Free | ❌ No | 100 req/sec | ✅ Active |
| **MediaWiki/WikiVoyage** | Travel tips & guides | ✅ Free | ❌ No | Unlimited | ✅ Active |
| **PDFShift** | PDF generation (email) | ✅ 100/month | ✅ Required (optional) | 100 conversions/month | ✅ Optional |
| **Gmail API** | Email sending (via n8n) | ✅ Free | ✅ OAuth2 | Unlimited | ✅ Optional |

---

## 1. Groq API

**Purpose**: Language model for itinerary generation, editing, and explanation.

**Endpoint**: `https://api.groq.com/openai/v1/chat/completions`

### Configuration

```typescript
// backend/.env
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxx
GROQ_MODEL=llama-3.1-8b-instant  // Can also use: mixtral-8x7b, llama-2-70b-chat
```

### Pricing

| Tier | Cost | Details |
|------|------|---------|
| **Free** | Free | 30 requests/minute (development) |
| **Pro** | $5/month | 100 requests/minute |
| **Pro+** | $15/month | 500 requests/minute |

### Usage Examples

```bash
# Generates ~500 tokens per itinerary request
# 1M tokens ≈ $0.0001-0.0003 depending on model

# Free tier: ~30 itineraries/minute
# Pro tier: ~100 itineraries/minute
```

### Rate Limiting

```
Free: 30 requests/minute
Pro:  100 requests/minute
Pro+: 500 requests/minute
```

**Implementation**: Implemented with retry logic (3 attempts, exponential backoff)

---

## 2. OpenStreetMap Nominatim

**Purpose**: Geocoding service to convert city names to coordinates.

**Endpoint**: `https://nominatim.openstreetmap.org/search`

### Example Request

```bash
curl "https://nominatim.openstreetmap.org/search?city=Jaipur&format=json&countrycodes=in" \
  -H "User-Agent: Travel-Planner-App (Mozilla/5.0)"
```

### Response Format

```json
[
  {
    "place_id": 123456,
    "name": "Jaipur, Rajasthan, India",
    "lat": "26.9124",
    "lon": "75.7873",
    "class": "place",
    "type": "city"
  }
]
```

### Rate Limiting

- **Limit**: 1 request/second per IP
- **Timeout**: 10 seconds
- **User-Agent**: Required (request fails without it)

### Constraints

- Country code filtering: `&countrycodes=in` (India only for this project)
- Caching: Implemented (in-memory, 24-hour TTL)

---

## 3. OpenStreetMap Overpass API

**Purpose**: Fetch Points of Interest (POIs) like hotels, restaurants, museums, attractions.

**Endpoint**: `https://overpass-api.de/api/interpreter`

### Example Query

```
[bbox:26.8,75.7,27.0,75.9];
(
  node["tourism"="attraction"](26.8,75.7,27.0,75.9);
  node["amenity"="restaurant"](26.8,75.7,27.0,75.9);
  node["amenity"="hotel"](26.8,75.7,27.0,75.9);
);
out center;
```

### Response Format

```json
{
  "elements": [
    {
      "type": "node",
      "id": 298884325,
      "lat": 26.9245,
      "lon": 75.8277,
      "tags": {
        "name": "Hawa Mahal",
        "tourism": "attraction",
        "historic": "building"
      }
    }
  ]
}
```

### Rate Limiting

- **Limit**: ~20 requests/minute
- **Timeout**: 30 seconds
- **Adaptive**: Slows down if overloaded

### Filtering (in code)

```typescript
// Included types
const INCLUDE_TYPES = ['historic', 'museum', 'restaurant', 'hotel', 'viewpoint', 'tourist'];

// Excluded
const EXCLUDE_TAGS = {
  amenity: ['fast_food', 'pharmacy', 'bank'],
  shop: ['*'],  // All shops
};
```

### Max Results

- 20 POIs per query (backend configured limit)
- Falls back to mock data if API fails

---

## 4. OSRM (Open Source Routing Machine)

**Purpose**: Calculate travel time and distance between POI coordinates.

**Endpoint**: `https://router.project-osrm.org/route/v1/car/{lon1},{lat1};{lon2},{lat2}`

### Example Request

```bash
# Note: OSRM uses lon,lat order (opposite of usual lat,lon)
curl "https://router.project-osrm.org/route/v1/car/75.8277,26.9245;75.8231,26.9245?overview=false"
```

### Response Format

```json
{
  "code": "Ok",
  "routes": [
    {
      "distance": 1500.2,    // meters
      "duration": 180.5      // seconds
    }
  ]
}
```

### Rate Limiting

- **Limit**: Unlimited (fair use)
- **Timeout**: 5 seconds (configured)
- **No API key required**

### Profiles

Only car routing used (default profile).
Can be extended to: walking, cycling, truck profiles.

---

## 5. Open-Meteo Weather API

**Purpose**: Fetch current weather and 7-day forecast.

**Endpoint**: `https://api.open-meteo.com/v1/forecast`

### Example Request

```bash
curl "https://api.open-meteo.com/v1/forecast?latitude=26.9124&longitude=75.7873&current=temperature_2m,weather_code,humidity_2m,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,weather_code&timezone=Asia/Kolkata"
```

### Response Format

```json
{
  "current": {
    "temperature_2m": 28.5,
    "weather_code": 0,
    "humidity_2m": 45,
    "wind_speed_10m": 12
  },
  "daily": {
    "time": ["2026-02-10", "2026-02-11"],
    "temperature_2m_max": [32, 30],
    "temperature_2m_min": [18, 17],
    "weather_code": [0, 1]
  }
}
```

### Rate Limiting

- **Limit**: 100 requests/second
- **Timeout**: 10 seconds
- **No API key required**

### Weather Code Mapping

```
0 = Clear sky
1-3 = Partly cloudy
45, 48 = Foggy
51-67 = Drizzle/Rain
71-77 = Snow
80-82 = Heavy rain
85-86 = Heavy snow
95+ = Thunderstorm
```

---

## 6. MediaWiki / WikiVoyage

**Purpose**: Fetch travel guides, tips, local recommendations.

**Endpoint**: `https://en.wikivoyage.org/w/api.php`

### Example Request

```bash
curl "https://en.wikivoyage.org/w/api.php?action=query&titles=Jaipur&prop=extracts&explaintext=true&format=json"
```

### Response Format

```json
{
  "query": {
    "pages": {
      "-1": {
        "ns": 0,
        "title": "Jaipur",
        "extract": "Jaipur is the capital of Rajasthan state in India..."
      }
    }
  }
}
```

### Rate Limiting

- **Limit**: Unlimited (reasonable use)
- **Timeout**: 10 seconds
- **No API key required**

### Sections Extracted

- Get around (transportation tips)
- Eat (restaurant recommendations)
- See (attractions)
- Do (activities)

---

## 7. PDFShift API (Optional - Email Feature)

**Purpose**: Convert HTML to PDF for email attachments.

**Endpoint**: `https://api.pdfshift.io/v3/convert/html`

### Configuration

```typescript
// backend/.env (optional)
// Only needed if using email feature
```

### Pricing

| Tier | Cost | Conversions/month |
|------|------|------------------|
| **Free** | Free | 100 |
| **Starter** | $19/month | 1,000 |
| **Pro** | $99/month | 10,000 |

### Example Request

```bash
curl -X POST https://api.pdfshift.io/v3/convert/html \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "source": "<html><body>...</body></html>",
    "landscape": false,
    "margin": "10mm"
  }'
```

### Response

```json
{
  "success": true,
  "status": 200,
  "data": "base64-encoded-pdf",
  "duration": 1.234
}
```

---

## 8. Gmail API (Optional - Email Feature)

**Purpose**: Send emails with PDF attachments via Gmail account.

**Endpoint**: `https://gmail.googleapis.com/gmail/v1/users/me/messages/send`

### Configuration

Configured via n8n workflow (not directly in backend).

### OAuth2 Flow

1. User signs in with Google account
2. Approves Gmail API access
3. Receives OAuth2 token (saved in n8n)
4. Backend calls n8n webhook → n8n uses token to send email

### Rate Limiting

- **Limit**: Unlimited (Gmail rate limits)
- **Quota**: 10,000 emails/day (Google workspace limit)

---

## Fallback Behavior

### All APIs

| Failure | Fallback |
|---------|----------|
| **Overpass API fails** | Use mock POIs (Hawa Mahal, City Palace, etc.) |
| **OSRM times out** | Skip travel time calculation |
| **Weather API fails** | Use generic weather (Sunny, 28°C) |
| **WikiVoyage unavailable** | Use generic travel tips |
| **Nominatim timeout** | Skip city validation |

All fallbacks log warnings but don't crash the API.

---

## Data Caching

### Implemented Caching

```typescript
// Service                Cache Duration    Scope
Nominatim geocoding      24 hours          Per city
Weather                  1 hour            Per location
POI data                 None (fetched fresh)
WikiVoyage              24 hours          Per city
```

### Cache Miss Strategy

- For fresh data requirements, clear cache
- For performance, use existing cache
- All caches cleared on server restart

---

## GDPR & Privacy

- **No user data stored**: All requests stateless
- **No IP tracking**: Nominatim doesn't log IPs
- **No cookies**: Stateless API design
- **Data anonymized**: Session IDs are random UUIDs

---

## Cost Estimation (Monthly)

| Service | Free Tier | Production (1,000 requests) |
|---------|-----------|---------------------------|
| Groq | Free | ~$0.10 (approx) |
| Nominatim | Free | Free (rate limited) |
| Overpass | Free | Free (rate limited) |
| OSRM | Free | Free (fair use) |
| Open-Meteo | Free | Free (rate limited) |
| WikiVoyage | Free | Free |
| PDFShift | 100 PDF/month | $19 (1K PDFs) |
| **Total** | **Free** | **~$19.10** |

---

## Testing with Sample Data

### Pre-cached Cities

```json
{
  "Jaipur": { "lat": 26.9124, "lon": 75.7873 },
  "Mumbai": { "lat": 19.0760, "lon": 72.8777 },
  "Delhi": { "lat": 28.7041, "lon": 77.1025 },
  "Goa": { "lat": 15.2993, "lon": 73.8243 },
  "Agra": { "lat": 27.1767, "lon": 78.0081 }
}
```

### Mock POIs (Jaipur)

```json
[
  "Amber Fort",
  "Hawa Mahal",
  "City Palace",
  "Jantar Mantar",
  "Sardar Market",
  "Albert Hall Museum",
  "Govind Dev Ji Temple"
]
```

---

## Environment Variables

```bash
# Required
GROQ_API_KEY=gsk_xxxxx

# Optional (email feature)
N8N_WEBHOOK_URL=http://localhost:5678/webhook/send-itinerary

# Optional (production)
NODE_ENV=production
```

---

## Monitoring & Logging

All API calls logged with:
- Request timestamp
- Service name
- Status code
- Response time
- Error message (if failed)

Example log:
```
[14:32:15] Nominatim: GET /search?city=Jaipur → 200 OK (45ms)
[14:32:16] Overpass: POST /api/interpreter → 200 OK (1200ms, 15 POIs)
[14:32:17] OSRM: GET /route/v1/car/... → 200 OK (120ms)
```

---

**Last Updated**: Feb 10, 2026
