# Travel Planner Frontend

MVP companion UI for the Voice-First AI Travel Planner backend.

## Quick Start

### Prerequisites
- Node.js 18+
- npm

### Setup

```bash
cd frontend
npm install
```

### Environment

Create `.env` file:
```
VITE_API_BASE_URL=http://localhost:3001
```

### Development

```bash
npm run dev
```

Frontend runs on: http://localhost:5174

### Build

```bash
npm run build
```

Outputs to: `dist/`

## Architecture

**Tech Stack:**
- React 18 + Vite
- TypeScript
- Tailwind CSS
- Web Speech API (voice input)
- Axios (HTTP client)

**Key Components:**

1. **VoiceBar** - Mic input, live transcript, status indicator
2. **ItineraryView** - Day tabs, Morning/Afternoon/Evening blocks, travel times
3. **SourcesSection** - POI sources (OSM), Wikivoyage citations, weather tips
4. **EvaluationsSection** - Feasibility, grounding, edit correctness scores
5. **ConfirmModal** - Intent routing (Plan/Edit/Explain)

**API Integration:**

```
POST /plan      - Create new itinerary
POST /edit      - Modify itinerary
POST /explain   - Answer questions about itinerary
```

**State Management:**

- Session ID persisted to localStorage
- Backend provides SessionState with all data
- Edit highlighting on day tabs (yellow background)

## Features

- ✅ Voice input with Web Speech API
- ✅ Intent detection (Plan/Edit/Explain)
- ✅ Day-based itinerary navigation
- ✅ Travel time display (method + minutes)
- ✅ POI source tracking
- ✅ Wikivoyage citations (Get around, Eat, See, Do)
- ✅ Weather integration (Open-Meteo)
- ✅ Evaluation metrics display
- ✅ Edit preview with highlights
- ✅ CORS-compatible

## Browser Support

- Chrome/Edge: Full support (Web Speech API)
- Safari: Full support (webkitSpeechRecognition)
- Firefox: Text input fallback

## Notes

- Vite hot reload enabled for development
- Tailwind CSS built-in
- Environment-based API endpoint configuration
