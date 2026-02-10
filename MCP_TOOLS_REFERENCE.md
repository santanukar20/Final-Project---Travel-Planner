# MCP Tools Reference

This document describes all Model Context Protocol (MCP) tools used by the Travel Planner backend for itinerary generation and validation.

---

## Overview

The backend uses 5 MCP tools that are called sequentially during itinerary generation:

```
[Plan Request] 
    ↓
[POI Search MCP] → Fetch attractions, restaurants, landmarks
    ↓
[OSRM Route MCP] → Calculate travel times between POIs
    ↓
[WikiVoyage MCP] → Get travel tips (Get around, Eat, See, Do)
    ↓
[Weather MCP] → Fetch current & forecast weather
    ↓
[Itinerary Builder MCP] → Assemble day-by-day schedule
    ↓
[LLM] → Polish and validate with Groq
    ↓
[Evaluation Tools] → Score feasibility, grounding, edit correctness
```

---

## 1. POI Search MCP

**File**: `backend/src/tools/poi_search_mcp.ts`

**Purpose**: Search for Points of Interest (POIs) in a specified city/area using OpenStreetMap (Overpass API).

### Input Parameters

```typescript
{
  city: string;           // City name (e.g., "Jaipur")
  lat: number;           // Center latitude
  lon: number;           // Center longitude
  radius: number;        // Search radius in meters (default: 5000)
  poiTypes?: string[];   // Filter by types (e.g., ["historic", "restaurant"])
}
```

### Output Format

```typescript
{
  pois: POI[];
}

// POI structure:
{
  id: string;                    // OSM node ID (e.g., "osm:node:123456")
  name: string;                  // POI name
  type: string;                  // Category (historic, restaurant, museum, etc.)
  tags: Record<string, string>;  // OpenStreetMap tags
  location: {
    lat: number;
    lon: number;
  };
  typicalDurationHours: number;  // Estimated visit duration (0.5-3 hours)
  confidence: number;            // Quality score (0-1)
  source: string;                // "Overpass" or "Mock"
}
```

### Example

**Input:**
```json
{
  "city": "Jaipur",
  "lat": 26.9124,
  "lon": 75.7873,
  "radius": 5000,
  "poiTypes": ["historic", "museum"]
}
```

**Output:**
```json
{
  "pois": [
    {
      "id": "osm:node:298884325",
      "name": "Hawa Mahal (Palace of Winds)",
      "type": "historic",
      "tags": {
        "tourism": "attraction",
        "historic": "building",
        "name": "Hawa Mahal"
      },
      "location": { "lat": 26.9245, "lon": 75.8277 },
      "typicalDurationHours": 0.75,
      "confidence": 0.95,
      "source": "Overpass"
    },
    {
      "id": "osm:node:298884326",
      "name": "City Palace",
      "type": "historic",
      "tags": {
        "tourism": "attraction",
        "historic": "palace"
      },
      "location": { "lat": 26.9245, "lon": 75.8231 },
      "typicalDurationHours": 1.5,
      "confidence": 0.92,
      "source": "Overpass"
    }
  ]
}
```

### Data Filtering

The tool applies quality filters:
- **Excludes**: Unnamed POIs, fast food chains, generic shops
- **Prioritizes**: Museums, historic sites, restaurants, landmarks
- **Limits**: Max 20 POIs per query (Overpass API limit)

### Fallback Behavior

If Overpass API fails (timeout, rate limit, network error):
- Returns mock POI data for the city
- Logs warning: "Overpass API failed, using mock data"
- Mock data includes Hawa Mahal, City Palace, Jantar Mantar, etc. for Jaipur

---

## 2. OSRM Route MCP

**File**: `backend/src/tools/osrm_route_mcp.ts`

**Purpose**: Calculate travel time and distance between two coordinates using Open Source Routing Machine (OSRM).

### Input Parameters

```typescript
{
  startLat: number;  // Starting latitude
  startLon: number;  // Starting longitude
  endLat: number;    // Ending latitude
  endLon: number;    // Ending longitude
}
```

### Output Format

```typescript
{
  durationMinutes: number;  // Travel time in minutes (rounded)
  distanceKm: number;       // Distance in kilometers (2 decimals)
}

// Or null if route not found
```

### Example

**Input:**
```json
{
  "startLat": 26.9245,
  "startLon": 75.8277,
  "endLat": 26.9389,
  "endLon": 75.6513
}
```

**Output:**
```json
{
  "durationMinutes": 22,
  "distanceKm": 15.47
}
```

### Behavior

- Uses car/driving mode (default OSRM profile)
- Timeout: 5 seconds
- Returns `null` if:
  - Route not found (invalid coordinates)
  - Network error
  - Response parsing fails
  - API timeout

### Data Source

- **Provider**: Project OSRM (Open Source Routing Machine)
- **URL**: `https://router.project-osrm.org`
- **Free tier**: No API key required
- **Rate limits**: Fair use (should be fine for testing)

---

## 3. Weather MCP

**File**: `backend/src/tools/weather_mcp.ts`

**Purpose**: Fetch current and forecast weather for a location using Open-Meteo API.

### Input Parameters

```typescript
{
  lat: number;       // Latitude
  lon: number;       // Longitude
  days?: number;     // Forecast days (1-7, default: 3)
}
```

### Output Format

```typescript
{
  current: {
    temperature: number;        // Celsius
    condition: string;          // "Sunny", "Rainy", "Cloudy", etc.
    humidity: number;           // 0-100 percent
    windSpeed: number;          // km/h
  };
  forecast: {
    date: string;              // "2026-02-10"
    high: number;              // Max temp (C)
    low: number;               // Min temp (C)
    condition: string;         // Weather condition
  }[];
}
```

### Example

**Input:**
```json
{
  "lat": 26.9124,
  "lon": 75.7873,
  "days": 3
}
```

**Output:**
```json
{
  "current": {
    "temperature": 28,
    "condition": "Sunny",
    "humidity": 45,
    "windSpeed": 12
  },
  "forecast": [
    {
      "date": "2026-02-10",
      "high": 32,
      "low": 18,
      "condition": "Sunny"
    },
    {
      "date": "2026-02-11",
      "high": 30,
      "low": 17,
      "condition": "Partly Cloudy"
    }
  ]
}
```

### Data Source

- **Provider**: Open-Meteo (https://open-meteo.com)
- **Free tier**: Unlimited requests (100/sec limit)
- **No API key required**
- **Cache**: Cached for 1 hour per location

---

## 4. WikiVoyage MCP

**File**: `backend/src/tools/wikivoyage_mcp.ts`

**Purpose**: Fetch travel tips, recommendations, and local knowledge from WikiVoyage (MediaWiki).

### Input Parameters

```typescript
{
  city: string;      // City name (e.g., "Jaipur")
  sections?: string[]; // Specific sections (default: ["Get around", "Eat", "See", "Do"])
}
```

### Output Format

```typescript
{
  content: {
    "Get around": string;  // Transportation tips
    "Eat": string;        // Restaurant & food recommendations
    "See": string;        // Attractions to see
    "Do": string;         // Activities & experiences
  };
  lastUpdated: string;    // ISO date (e.g., "2026-02-01")
  source: string;         // "WikiVoyage"
}
```

### Example

**Input:**
```json
{
  "city": "Jaipur",
  "sections": ["Get around", "Eat"]
}
```

**Output:**
```json
{
  "content": {
    "Get around": "Jaipur is well-connected by bus, taxi, and auto-rickshaw. The Pink City is compact and walkable. Taxis are affordable and readily available.",
    "Eat": "Jaipur is famous for Ghewar (sweet), Bajra Roti (millet bread), and Rajasthani cuisine. Try local restaurants in the old city.",
    "See": "Hawa Mahal is iconic. City Palace is partially open to tourists. Jantar Mantar has astronomical instruments.",
    "Do": "Explore bazaars, visit forts, take heritage walks, enjoy local markets."
  },
  "lastUpdated": "2026-02-01",
  "source": "WikiVoyage"
}
```

### Data Source

- **Provider**: MediaWiki API (Wikipedia's WikiVoyage)
- **Free tier**: Unlimited requests
- **No API key required**
- **Language**: English

---

## 5. Itinerary Builder MCP

**File**: `backend/src/tools/itinerary_builder_mcp.ts`

**Purpose**: Assemble collected POI data into a day-by-day schedule with Morning/Afternoon/Evening blocks.

### Input Parameters

```typescript
{
  city: string;
  numDays: number;         // 2-5 days
  pois: POI[];            // Collected POIs
  pace: "fast" | "moderate" | "slow";  // Trip pace
  interests: string[];     // User interests
  constraints: any;        // Additional constraints
}
```

### Output Format

```typescript
{
  days: {
    dayNum: number;        // 1-based (1, 2, 3...)
    blocks: {
      period: "morning" | "afternoon" | "evening";
      poi?: {
        id: string;       // OSM node ID
        name: string;
      };
      duration: number;    // Minutes
      travelTime?: {
        method: "walk" | "car" | "transit";
        minutes: number;
      };
      notes: string;      // Activity description
      sources: string[];  // Source IDs (e.g., ["osm:node:123"])
    }[];
  }[];
}
```

### Example

**Input:**
```json
{
  "city": "Jaipur",
  "numDays": 2,
  "pace": "moderate",
  "interests": ["historic", "culture"],
  "pois": [
    {
      "id": "osm:node:298884325",
      "name": "Hawa Mahal",
      "location": { "lat": 26.9245, "lon": 75.8277 }
    }
  ]
}
```

**Output:**
```json
{
  "days": [
    {
      "dayNum": 1,
      "blocks": [
        {
          "period": "morning",
          "poi": {
            "id": "osm:node:298884325",
            "name": "Hawa Mahal"
          },
          "duration": 45,
          "travelTime": {
            "method": "walk",
            "minutes": 15
          },
          "notes": "Visit the iconic 5-story pink palace with 953 small windows",
          "sources": ["osm:node:298884325"]
        },
        {
          "period": "afternoon",
          "poi": {
            "id": "osm:node:298884326",
            "name": "City Palace"
          },
          "duration": 90,
          "travelTime": {
            "method": "car",
            "minutes": 10
          },
          "notes": "Explore the live royal palace, partially open to tourists",
          "sources": ["osm:node:298884326"]
        },
        {
          "period": "evening",
          "poi": null,
          "duration": 120,
          "notes": "Free time / Rest at hotel or explore local markets",
          "sources": []
        }
      ]
    }
  ]
}
```

### Behavior

- **Fills insufficient POIs**: If fewer than 3 POIs available, adds "Free time / Rest" blocks
- **Logs warning**: "Insufficient POIs for day X, adding free time block"
- **Respects pace**: Fast pace → longer activities, slow pace → shorter activities
- **Distributes POIs**: Spreads attractions across morning/afternoon/evening

---

## 6. Evaluation Tools

Evaluation tools score the generated itinerary quality:

### Feasibility Evaluator (`backend/src/evals/feasibility.ts`)

**Purpose**: Check if itinerary is physically feasible (can complete all activities in given time).

**Scoring**:
- ✅ Pass: If travel time + activity duration ≤ daylight hours
- ❌ Fail: If tightly packed (> 8 hours of travel/activities)

### Grounding Evaluator (`backend/src/evals/grounding.ts`)

**Purpose**: Verify POI data is grounded in real OpenStreetMap data.

**Scoring**:
- ✅ High score: If POIs from real Overpass data
- ⚠️ Lower score: If using mock POI data (API failed)

### Edit Correctness Evaluator (`backend/src/evals/edit_correctness.ts`)

**Purpose**: After edit, verify the change was applied correctly.

**Scoring**:
- ✅ High score: If day/block/text correctly identified and modified
- ❌ Low score: If wrong day was edited

---

## Tool Integration Flow

### During /plan endpoint:

```
1. Extract city from user utterance
2. Geocode city (get lat/lon)
3. Call POI Search MCP → Get POIs
4. For each POI pair, call OSRM Route MCP → Get travel times
5. Call Weather MCP → Get forecast
6. Call WikiVoyage MCP → Get travel tips
7. Call Itinerary Builder MCP → Create day-by-day schedule
8. Call Groq LLM with schedule → Polish and validate
9. Call Evaluation tools → Score quality
10. Return complete SessionState
```

### During /edit endpoint:

```
1. Load existing session
2. Extract: day number, period, new activity
3. Call Groq LLM → Generate updated blocks for target day
4. Call Evaluation tools → Score edit correctness
5. Return updated SessionState
```

---

## Data Dependencies

| Tool | Requires | Optional |
|------|----------|----------|
| POI Search | city, lat/lon | poiTypes, radius |
| OSRM Route | startLat, startLon, endLat, endLon | - |
| Weather | lat, lon | days |
| WikiVoyage | city | sections |
| Itinerary Builder | city, numDays, pois | pace, interests |

---

## Error Handling

All MCP tools implement graceful fallbacks:

| Tool | Failure Mode | Fallback |
|------|------|----------|
| POI Search | Overpass API timeout | Mock POIs for city |
| OSRM Route | No route found | Null (skip travel time) |
| Weather | API error | Generic weather (Sunny, 28°C) |
| WikiVoyage | No content found | Generic travel tips |
| Itinerary Builder | Insufficient POIs | Fill with "Free time" blocks |

---

## Testing Tools

Test scripts for MCP tools:

```bash
# POI Search
node backend/test-poi-search.js

# OSRM Route
node backend/test-osrm-route.js

# Weather
node backend/test-weather.js

# Full integration
node backend/test-api.js
```

---

## Future Enhancements

- [ ] Add accommodation MCP (Hotels, hostels, homestays)
- [ ] Add transportation MCP (Flights, trains, buses)
- [ ] Add restaurant MCP (Reviews, ratings, reservations)
- [ ] Add event MCP (Local events, festivals)
- [ ] Caching layer for repeated queries

---

**Last Updated**: Feb 10, 2026
