# Travel Planner Backend

Express.js + Groq + MCP Tools backend for the Voice-First AI Travel Planner.

---

## 🎯 Overview

The backend handles:
- **LLM Integration**: Groq API calls for itinerary generation & editing
- **Intent Routing**: Plan / Edit / Explain commands
- **City Extraction**: Deterministic regex + LLM fallback
- **MCP Tools**: POI data (OSM), routes (OSRM), weather (Open-Meteo), content (WikiVoyage)
- **Session Management**: In-memory storage with JSON persistence
- **Email Feature**: n8n webhook integration for PDF generation & Gmail sending
- **Evaluation Scoring**: Feasibility, grounding, edit correctness metrics

---

## 📁 Directory Structure

```
backend/
├── src/
│   ├── routes/
│   │   ├── plan.ts          # POST /plan - Create itinerary
│   │   ├── edit.ts          # POST /edit - Modify itinerary
│   │   ├── edit-llm.ts      # LLM-based edit routing
│   │   ├── explain.ts       # POST /explain - Answer questions
│   │   ├── email-itinerary.ts # POST /email-itinerary - Email PDF
│   │   └── health.ts        # GET /health - Status check
│   │
│   ├── services/
│   │   ├── llm.ts           # Groq SDK calls, prompt engineering
│   │   ├── geocode.ts       # Nominatim API for city validation
│   │   ├── cityExtract.ts   # Deterministic city extraction (regex)
│   │   ├── osrm.ts          # OSRM API for route calculation
│   │   ├── pois.ts          # Overpass API for POI fetching
│   │   ├── weather.ts       # Open-Meteo weather API
│   │   ├── wikivoyage.ts    # MediaWiki API for travel tips
│   │   └── emailItinerary.ts # n8n webhook caller
│   │
│   ├── tools/
│   │   ├── osrm_route_mcp.ts
│   │   ├── weather_mcp.ts
│   │   ├── poi_search_mcp.ts
│   │   ├── validate_tools.ts
│   │   └── ...other MCP implementations
│   │
│   ├── evals/
│   │   ├── feasibility.ts   # Check if itinerary is feasible
│   │   ├── grounding.ts     # Score groundedness of content
│   │   └── editCorrectness.ts # Evaluate edit quality
│   │
│   ├── state/
│   │   └── sessionStore.ts  # In-memory session storage
│   │
│   └── server.ts            # Express app setup
│
├── n8n/
│   ├── send-itinerary-workflow.json  # n8n workflow definition
│   └── README.md            # n8n setup instructions
│
├── .env                     # Environment variables
├── .env.example             # Template
├── tsconfig.json            # TypeScript config
├── package.json             # Dependencies
├── dist/                    # Compiled JavaScript (generated)
└── test-*.js               # Test scripts
```

---

## 🚀 Quick Start

### Installation

```bash
cd backend
npm install
```

### Environment Setup

Create `.env` file (or copy from `.env.example`):
```
GROQ_API_KEY=your_groq_api_key
GROQ_MODEL=llama-3.1-8b-instant
N8N_WEBHOOK_URL=http://localhost:5678/webhook/send-itinerary
```

Get Groq API key: https://console.groq.com/keys

### Development

```bash
npm run dev
```

Server runs on **http://localhost:3001**

Features:
- Auto-reload on file changes (nodemon)
- TypeScript compilation
- Full error logging

### Build

```bash
npm run build
```

Compiles TypeScript to `dist/` directory.

### Start (Production)

```bash
npm run start
```

Runs compiled code from `dist/`.

---

## 🔌 API Endpoints

### POST /plan
Create a new itinerary from voice input.

**Request:**
```json
{
  "utterance": "Plan a trip to Jaipur for 3 days with budget focus"
}
```

**Response:**
```json
{
  "ok": true,
  "sessionId": "sess_abc123xyz",
  "state": {
    "itinerary": {
      "days": [
        {
          "dayNum": 1,
          "blocks": [
            {
              "period": "morning",
              "poi": "Hawa Mahal",
              "duration": 120,
              "travelTime": { "method": "walk", "minutes": 15 },
              "notes": "Pink palace, UNESCO site",
              "sources": ["osm:node:123", "wikivoyage"]
            }
          ]
        }
      ]
    },
    "constraints": {
      "city": "Jaipur",
      "resolvedCity": "Jaipur",
      "numDays": 3,
      "pace": "moderate",
      "interests": ["architecture", "budget"]
    },
    "sources": {
      "osm:node:123": { "name": "Hawa Mahal", "source": "OpenStreetMap", ... }
    },
    "weather": { ... },
    "evaluations": {
      "feasibility": 0.85,
      "grounding": 0.92,
      "editCorrectness": null
    }
  }
}
```

**Error Response (400):**
```json
{
  "ok": false,
  "error": "MISSING_CITY",
  "details": "Could not extract city from: 'Plan a trip'"
}
```

---

### POST /edit
Modify an existing itinerary.

**Request:**
```json
{
  "sessionId": "sess_abc123xyz",
  "utterance": "Change Day 2 afternoon to beaches instead"
}
```

**Response:**
```json
{
  "ok": true,
  "state": { ... }
}
```

**Process:**
1. Load session from store
2. Extract: day number, time period, intent (change/add/remove)
3. Find matching block (Day 2, afternoon)
4. Call LLM with modification schema
5. Update itinerary & evaluate edit quality
6. Return updated state

---

### POST /explain
Answer questions about the itinerary.

**Request:**
```json
{
  "sessionId": "sess_abc123xyz",
  "utterance": "What's the weather in Jaipur?"
}
```

**Response:**
```json
{
  "ok": true,
  "answer": "Jaipur weather: Sunny, 28°C, low humidity. Good for outdoor exploration.",
  "sources": ["weather:open-meteo", "itinerary:local-knowledge"]
}
```

---

### POST /email-itinerary
Email itinerary PDF via n8n.

**Request:**
```json
{
  "sessionId": "sess_abc123xyz",
  "toEmail": "user@example.com"
}
```

**Response:**
```json
{
  "ok": true,
  "messageId": "msg_12345",
  "sentTo": "user@example.com"
}
```

**Errors:**
```json
{
  "ok": false,
  "error": "INVALID_EMAIL"
}
```

---

### GET /health
Simple health check.

**Response:**
```json
{
  "status": "healthy",
  "uptime": 3600
}
```

---

## 🛠️ Key Services

### LLM Service (`services/llm.ts`)

Handles Groq API calls with structured prompts.

**Example Usage:**
```typescript
const response = await callGroqAPI({
  systemPrompt: "You are a travel assistant...",
  userPrompt: "Create a 3-day itinerary for Jaipur",
  schema: ITINERARY_SCHEMA,
  temperature: 0.7
});
```

**Features:**
- Retry logic with exponential backoff
- JSON validation & fallback
- Token counting
- Error logging

---

### City Extraction (`services/cityExtract.ts`)

Deterministic city extraction with 3 regex patterns:

1. **Pattern 1**: `to|in|at + city name`
   - Matches: "to Jaipur", "in Mumbai", "at Delhi"

2. **Pattern 2**: `trip + optional(to) + city`
   - Matches: "trip to Pune", "trip Kochi"

3. **Pattern 3**: `to + 2-40 character word`
   - Matches: "to Agra", "to Udaipur"

**Fallback**: LLM extraction if no regex match.

---

### Geocoding (`services/geocode.ts`)

Validates city existence via Nominatim API (OpenStreetMap).

**Features:**
- User-Agent header (required by Nominatim)
- India-only validation (`countrycodes=in`)
- Caching (in-memory)
- Error handling for network failures

---

### OSRM Route Service (`services/osrm.ts`)

Calculates travel time between two coordinates.

**Example:**
```typescript
const time = await getRouteTime(
  { lat: 26.9124, lng: 75.7873 },  // Jaipur
  { lat: 26.8389, lng: 75.8000 },  // Next POI
  'car'
);
// Returns: ~15 minutes
```

---

### POI Search (`services/pois.ts`)

Fetches Points of Interest from Overpass API.

**Example:**
```typescript
const pois = await fetchPOIs(
  { lat: 26.9124, lng: 75.7873 },
  'tourist',
  radius: 2000
);
```

---

### Weather (`services/weather.ts`)

Gets weather from Open-Meteo (free, no API key required).

**Example:**
```typescript
const weather = await getWeather('Jaipur', '2026-02-10');
// Returns: { temp: 28, condition: 'Sunny', humidity: 45 }
```

---

### WikiVoyage (`services/wikivoyage.ts`)

Fetches travel tips from MediaWiki API.

---

### Email Itinerary (`services/emailItinerary.ts`)

Calls n8n webhook to generate PDF and send via Gmail.

**Flow:**
1. Validate `sessionId` & `toEmail`
2. Build payload with itinerary data
3. POST to `N8N_WEBHOOK_URL`
4. Wait 20 seconds for response
5. Return `{ ok, messageId, sentTo, error }`

---

## 📊 Session State

Session data stored in memory (with JSON file backup).

**Structure:**
```typescript
{
  sessionId: string;
  itinerary: {
    days: ItineraryDay[];
  };
  constraints: {
    city: string;
    resolvedCity: string;
    numDays: number;
    pace: 'fast' | 'moderate' | 'slow';
    interests: string[];
  };
  sources: Record<string, RAGSource>;
  weather: Record<string, WeatherData>;
  evaluations: {
    feasibility: number;
    grounding: number;
    editCorrectness: number | null;
  };
  createdAt: Date;
  lastModified: Date;
}
```

**Persistence:**
- In-memory during session
- Saved to JSON on modification (optional)
- Cleared on server restart (can be changed)

---

## 🧪 Testing

### Test Scripts

```bash
# Test city extraction
node test-city-extract.js

# Test edit endpoint
node test-edit-extract.js

# Test Nominatim geocoding
node test-nominatim.js

# Test email endpoint
node test-email-endpoint.js

# Test full plan flow
node test-api.js
```

### Manual Testing (cURL)

```bash
# Plan endpoint
curl -X POST http://localhost:3001/plan \
  -H "Content-Type: application/json" \
  -d '{"utterance":"Plan a trip to Jaipur"}'

# Edit endpoint
curl -X POST http://localhost:3001/edit \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"abc123","utterance":"Change Day 2 to beaches"}'

# Health check
curl http://localhost:3001/health
```

---

## 🐛 Troubleshooting

### Backend won't start
- Check `GROQ_API_KEY` in `.env`
- Run `npm install`
- Check port 3001 not in use: `lsof -i :3001`

### City not extracted
- Check Nominatim API responding (may need User-Agent header)
- Review backend logs for city extraction regex matches
- Verify city name is recognized in India

### LLM errors (500)
- Check Groq API key validity
- Check Groq API quota not exceeded
- Look at error logs for prompt issues

### Email not sending
- Verify n8n running on port 5678
- Check `N8N_WEBHOOK_URL` in .env matches n8n endpoint
- Verify Gmail OAuth2 credentials in n8n
- Check PDFShift API key in n8n

---

## 🔧 Configuration

### Environment Variables

| Variable | Required | Default | Notes |
|----------|----------|---------|-------|
| `GROQ_API_KEY` | ✅ Yes | - | Get from https://console.groq.com/keys |
| `GROQ_MODEL` | ❌ No | `llama-3.1-8b-instant` | Can use other Groq models |
| `N8N_WEBHOOK_URL` | ❌ No | - | Required for email feature |
| `NODE_ENV` | ❌ No | `development` | Set to `production` for deployment |

### Ports

- **Backend**: 3001 (configurable in server.ts)
- **Frontend**: 5174 (Vite default)
- **n8n**: 5678 (if using local n8n)

---

## 📦 Dependencies

### Core
- `express` - Web server
- `typescript` - Type safety
- `groq-sdk` - Groq API client

### APIs & Tools
- `node-fetch` - HTTP requests
- `axios` - Alternative HTTP client (used in frontend)

### Development
- `ts-node` - Run TypeScript directly
- `nodemon` - Auto-reload
- `tsc` - TypeScript compiler

---

## 🚢 Deployment

### Render.com

1. Create Web Service
2. Connect GitHub repo
3. Environment variables:
   ```
   GROQ_API_KEY=...
   GROQ_MODEL=llama-3.1-8b-instant
   N8N_WEBHOOK_URL=https://n8n.cloud/.../webhook/send-itinerary
   ```
4. Build: `npm run build`
5. Start: `npm run start`

### Environment Variables for Production

```bash
GROQ_API_KEY=<production-key>
GROQ_MODEL=llama-3.1-8b-instant
N8N_WEBHOOK_URL=<n8n-cloud-url>
NODE_ENV=production
```

---

## 📝 Code Style

### TypeScript
- Fully typed functions (no `any` unless necessary)
- Interface definitions in shared/types.ts
- Error handling with try-catch

### Comments
- Document complex LLM prompts
- Explain regex patterns
- Note API limitations

### Error Handling
- Always return JSON responses
- Use standard HTTP status codes (200, 400, 500)
- Include error messages for debugging

---

## 🔐 Security Notes

- **API Keys**: Store in environment variables, never commit
- **CORS**: Configured for localhost:5174 (update for production)
- **Input Validation**: All user inputs validated before LLM
- **Rate Limiting**: Not implemented yet (add if needed)

---

## 📚 Related Documentation

- **[../README.md](../README.md)** - Main project README
- **[./n8n/README.md](./n8n/README.md)** - n8n workflow setup
- **[../SETUP_INSTRUCTIONS.md](../SETUP_INSTRUCTIONS.md)** - Full setup guide

---

## 🤝 Contributing

When adding new routes:
1. Create file in `src/routes/`
2. Add error handling (try-catch, return 400/500)
3. Update API documentation
4. Test with curl or Postman
5. Add test script if complex

When adding new services:
1. Create file in `src/services/`
2. Export main function with types
3. Add error logging
4. Write test script
5. Document API response format

---

**Last Updated**: Feb 10, 2026
**Status**: MVP Complete - Production ready
