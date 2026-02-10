# Voice-First AI Travel Planner

**Graduation Capstone Project** | Jan–Feb 2026

A voice-based AI travel planning assistant that generates grounded, editable itineraries using MCP tools, RAG, and evaluation metrics. This MVP companion UI enables natural voice commands to create, edit, and explore travel itineraries with real-time feedback.

---

## 🎯 Features

- **Voice-First Interface**: Natural speech input with intent detection (Plan/Edit/Explain)
- **AI-Powered Itineraries**: LLM-generated day-by-day plans using Groq (llama-3.1-8b-instant)
- **MCP Tools Integration**: OpenStreetMap POI data, route calculations (OSRM), WikiVoyage content
- **Editable Itineraries**: Edit blocks with natural language ("Change Day 2 morning to beaches")
- **RAG & Grounding**: POI validation, travel time calculations, weather integration (Open-Meteo)
- **Evaluation Metrics**: Feasibility, grounding score, edit correctness scoring
- **Email PDF Export**: Generate and email itinerary PDFs via n8n + Gmail + PDFShift
- **Debug Inspection**: Real-time log viewer, API response inspection, error tracking

---

## 📁 Project Structure

```
travel-planner/
├── backend/                    # Express.js + MCP tools + LLM
│   ├── src/
│   │   ├── routes/            # API endpoints (/plan, /edit, /explain, /email-itinerary)
│   │   ├── services/          # Business logic (LLM, geocoding, city extraction)
│   │   ├── tools/             # MCP tool implementations
│   │   ├── evals/             # Evaluation functions
│   │   ├── state/             # Session storage
│   │   └── server.ts          # Express app
│   ├── n8n/                   # n8n workflow for PDF email
│   ├── .env                   # GROQ_API_KEY, GROQ_MODEL, N8N_WEBHOOK_URL
│   └── package.json
│
├── frontend/                   # React + Vite + Tailwind
│   ├── src/
│   │   ├── components/        # React components (VoiceBar, ItineraryView, etc.)
│   │   ├── services/          # API client (axios)
│   │   ├── debug/             # Debug console, logging
│   │   └── App.tsx            # Main app
│   ├── .env                   # VITE_API_BASE_URL
│   └── package.json
│
├── shared/                     # Shared TypeScript types
│   └── types.ts               # Data contracts (Itinerary, SessionState, etc.)
│
└── Documentation
    ├── README.md              # This file
    ├── SETUP_INSTRUCTIONS.md  # Complete setup guide
    ├── QUICK_START_EMAIL_PDF.md
    ├── EMAIL_PDF_FEATURE_STATUS.md
    └── backend/n8n/README.md  # n8n setup guide
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- npm
- Groq API key (free at https://console.groq.com/keys)
- (Optional) n8n for email feature, PDFShift API key for PDF generation

### 1. Clone & Install

```bash
git clone <repo-url>
cd travel-planner

# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### 2. Configure Environment

**Backend** (`backend/.env`):
```
GROQ_API_KEY=your_groq_api_key
GROQ_MODEL=llama-3.1-8b-instant
N8N_WEBHOOK_URL=http://localhost:5678/webhook/send-itinerary
```

**Frontend** (`frontend/.env`):
```
VITE_API_BASE_URL=http://localhost:3001
```

### 3. Run Services

```bash
# Terminal 1: Backend (port 3001)
cd backend
npm run dev

# Terminal 2: Frontend (port 5174)
cd frontend
npm run dev

# Terminal 3: Optional - n8n (port 5678) for email feature
npm install -g n8n
n8n
```

### 4. Open in Browser

- Frontend: http://localhost:5174
- Backend API: http://localhost:3001
- n8n: http://localhost:5678 (if running)

---

## 🎤 Usage

### Creating an Itinerary

1. Click microphone or type in voice bar
2. Say: "Plan a trip to Jaipur for 3 days"
3. Backend creates itinerary with AI-generated blocks
4. View Day 1/2/3 tabs with Morning/Afternoon/Evening schedules

### Editing an Itinerary

1. Say: "Change Day 2 afternoon to beaches"
2. Backend identifies Day 2, afternoon block, applies edit
3. Day tab highlights yellow to show modification

### Asking Questions

1. Say: "What's the weather in Jaipur?"
2. Backend provides relevant info from itinerary context

### Email PDF

1. After creating itinerary, enter email address
2. Click "Email PDF"
3. n8n generates PDF and sends via Gmail
4. Check inbox for attachment

---

## 🔧 Architecture

### Backend Flow

1. **Voice Input** → Frontend sends transcript to `/plan`, `/edit`, or `/explain`
2. **Intent Routing** → Determines action (create/modify/question)
3. **City Extraction** → Regex patterns + LLM fallback to identify city
4. **Geocoding** → Validates city via Nominatim API
5. **Constraint Building** → Extracts duration, pace, interests
6. **MCP Tools** → Fetch POIs (OSM), routes (OSRM), weather (Open-Meteo), content (WikiVoyage)
7. **LLM Prompt** → Calls Groq with itinerary schema
8. **Evaluation** → Scores feasibility, grounding, edit correctness
9. **Response** → Returns SessionState with itinerary, sources, evals

### Frontend State

- **SessionID** → localStorage (persists across reloads)
- **ItineraryView** → Day tabs (Morning/Afternoon/Evening blocks)
- **SourcesSection** → POI citations, WikiVoyage recommendations
- **DebugConsole** → Real-time API logs, errors, transcript capture
- **ConfirmModal** → Intent disambiguation if uncertain

### Email Feature (n8n)

1. Frontend calls `/email-itinerary` with sessionId + email
2. Backend validates & calls n8n webhook
3. n8n receives data:
   - Renders HTML with itinerary + sources
   - Converts HTML → PDF via PDFShift API
   - Sends PDF attachment via Gmail OAuth2
4. Returns `{ ok: true, messageId, sentTo }` to UI

---

## 📦 Tech Stack

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js
- **Language**: TypeScript
- **LLM**: Groq SDK (llama-3.1-8b-instant)
- **APIs**: 
  - OpenStreetMap Nominatim (geocoding)
  - Overpass API (POI data)
  - OSRM (route calculation)
  - Open-Meteo (weather)
  - MediaWiki API (WikiVoyage content)

### Frontend
- **Framework**: React 18 + Vite
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Voice**: Web Speech API
- **HTTP**: Axios

### DevOps
- **LLM Workflow**: n8n (PDF + email automation)
- **PDF Generation**: PDFShift API
- **Email**: Gmail OAuth2

---

## 🧪 Testing

### Local Testing

**Test Backend Endpoints**:
```bash
# Plan endpoint
curl -X POST http://localhost:3001/plan \
  -H "Content-Type: application/json" \
  -d '{"utterance": "Plan a trip to Jaipur for 3 days"}'

# Edit endpoint
curl -X POST http://localhost:3001/edit \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "...", "utterance": "Change Day 2 afternoon to beaches"}'

# Email endpoint (requires n8n running)
node backend/test-email-endpoint.js
```

**Test Frontend**:
- Browser: http://localhost:5174
- DevTools: Inspect API calls, check localStorage sessionId
- Debug Console: View real-time logs (tab in bottom-left)

---

## 🚢 Deployment

### Backend (Render.com Example)

1. Create Render account, new Web Service
2. Connect GitHub repo
3. Set environment variables:
   ```
   GROQ_API_KEY=...
   GROQ_MODEL=llama-3.1-8b-instant
   N8N_WEBHOOK_URL=<n8n-cloud-endpoint>
   ```
4. Deploy: `npm run build && npm run start`

### Frontend (Vercel Example)

1. Import GitHub repo to Vercel
2. Set environment variable:
   ```
   VITE_API_BASE_URL=https://your-backend.onrender.com
   ```
3. Deploy: `npm run build`

### n8n (n8n Cloud Example)

1. Deploy workflow to https://n8n.cloud
2. Configure Gmail OAuth2 credentials
3. Configure PDFShift API key
4. Update backend `N8N_WEBHOOK_URL` to point to cloud endpoint

---

## 📝 API Reference

### POST /plan
Create a new itinerary from voice input.

**Request:**
```json
{
  "utterance": "Plan a trip to Jaipur for 3 days"
}
```

**Response:**
```json
{
  "ok": true,
  "sessionId": "abc123",
  "state": {
    "itinerary": { "days": [...] },
    "constraints": { "city": "Jaipur", "numDays": 3 },
    "sources": { ... },
    "evaluations": { ... }
  }
}
```

### POST /edit
Modify an existing itinerary.

**Request:**
```json
{
  "sessionId": "abc123",
  "utterance": "Change Day 2 afternoon to beaches"
}
```

### POST /explain
Answer questions about the itinerary.

**Request:**
```json
{
  "sessionId": "abc123",
  "utterance": "What's the weather?"
}
```

### POST /email-itinerary
Email PDF of itinerary via n8n.

**Request:**
```json
{
  "sessionId": "abc123",
  "toEmail": "user@example.com"
}
```

**Response:**
```json
{
  "ok": true,
  "messageId": "...",
  "sentTo": "user@example.com"
}
```

---

## 🐛 Troubleshooting

| Problem | Solution |
|---------|----------|
| Backend won't start | Check GROQ_API_KEY in .env |
| City not recognized | Ensure Nominatim API responding (check User-Agent header) |
| Frontend build fails | Run `npm install` in frontend, check TypeScript errors |
| Email not sending | Verify n8n running, Gmail OAuth configured, PDFShift API key valid |
| Empty itinerary blocks | Check backend logs for LLM errors |

---

## 📚 Documentation

- **[SETUP_INSTRUCTIONS.md](./SETUP_INSTRUCTIONS.md)** - Complete setup guide with n8n configuration
- **[QUICK_START_EMAIL_PDF.md](./QUICK_START_EMAIL_PDF.md)** - Email feature quick reference
- **[backend/n8n/README.md](./backend/n8n/README.md)** - n8n workflow details

---

## 👨‍💼 Development

### Code Standards

- **TypeScript**: All code must be fully typed
- **Comments**: Document complex logic, especially LLM prompts
- **Error Handling**: Use standardized error responses (400/500 status codes)
- **Logging**: Use console for development, debug panel for UI

### Build

```bash
# Backend
cd backend
npm run build      # compile TypeScript → dist/
npm run dev        # dev server with auto-reload

# Frontend
cd frontend
npm run build      # vite build → dist/
npm run dev        # dev server with HMR
```

### Git Workflow

```bash
git add .
git commit -m "Feature: Add email PDF export"
git push origin main
```

---

## 📄 License

Graduation Capstone Project - NextLeap Program, Feb 2026

---

## 🤝 Contributing

This is a capstone project. For issues or questions, contact the project team.

---

**Last Updated**: Feb 10, 2026
**Status**: MVP Complete - Email feature in beta
