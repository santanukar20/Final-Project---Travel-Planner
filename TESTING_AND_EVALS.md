# Testing & Evaluation Guide

Complete guide for testing the Travel Planner including test scenarios, sample transcripts, and evaluation metrics.

---

## Quick Test Suite

### 1. Run All Tests (10 minutes)

```bash
# Terminal 1: Start backend
cd backend
npm run dev

# Terminal 2: Run test suite
cd backend
npm test

# Or manually run individual tests:
node test-api.js
node test-city-extract.js
node test-edit-extract.js
node test-nominatim.js
node test-email-endpoint.js
```

---

## Sample Test Transcripts

### Category 1: Plan (Create Itinerary)

These should trigger the `/plan` endpoint and create a new itinerary.

#### Test 1.1: Basic Plan - Jaipur 3 Days

**Input**: "Plan a trip to Jaipur for 3 days"

**Expected Output**:
```json
{
  "ok": true,
  "sessionId": "sess_xxx",
  "state": {
    "itinerary": {
      "days": [
        { "dayNum": 1, "blocks": [...] },
        { "dayNum": 2, "blocks": [...] },
        { "dayNum": 3, "blocks": [...] }
      ]
    },
    "constraints": {
      "city": "Jaipur",
      "resolvedCity": "Jaipur",
      "numDays": 3,
      "pace": "moderate",
      "interests": []
    },
    "evaluations": {
      "feasibility": 0.8-0.95,
      "grounding": 0.85-1.0,
      "editCorrectness": null
    }
  }
}
```

**Test**: 
- ✅ City correctly extracted: "Jaipur"
- ✅ Duration correctly extracted: 3 days
- ✅ Session ID generated
- ✅ Itinerary has 3 days with 3 blocks each (morning/afternoon/evening)
- ✅ All POI names are human-readable (no OSM IDs)
- ✅ Travel times have format: "🚗 ~15 min drive"

---

#### Test 1.2: Plan with Interests

**Input**: "Plan a trip to Mumbai for 2 days, focus on beaches and street food"

**Expected Output**:
```json
{
  "constraints": {
    "city": "Mumbai",
    "numDays": 2,
    "interests": ["beaches", "street food"]
  },
  "itinerary": {
    "days": [
      {
        "dayNum": 1,
        "blocks": [
          {
            "period": "morning",
            "poi": { "name": "Gateway of India", ... },
            "notes": "Historic monument with beach views"
          },
          {
            "period": "afternoon",
            "poi": { "name": "Beach area", ... },
            "notes": "Relax at Marine Drive beach"
          }
        ]
      }
    ]
  }
}
```

**Test**:
- ✅ Interests captured: "beaches", "street food"
- ✅ POIs match interests (beaches, food stalls)
- ✅ Notes mention relevant activities

---

#### Test 1.3: Plan with Pace Variation

**Input**: "Plan a leisurely trip to Goa for 4 days"

**Expected Output**:
- Should include "slow" pace
- Fewer activities per day (focus on relaxation)
- Longer durations for beach/relaxation activities

---

#### Test 1.4: Plan Minimal Input

**Input**: "Trip to Agra"

**Expected Output**:
- Should infer duration (default: 2-3 days)
- Should create valid itinerary anyway
- Should not error on minimal input

---

### Category 2: Edit (Modify Itinerary)

These should trigger the `/edit` endpoint and modify an existing itinerary.

#### Test 2.1: Edit Simple Block

**Setup**: First create itinerary with "Plan a trip to Jaipur"

**Input**: "Change Day 1 morning to Jantar Mantar"

**Expected Output**:
```json
{
  "ok": true,
  "state": {
    "itinerary": {
      "days": [
        {
          "dayNum": 1,
          "blocks": [
            {
              "period": "morning",
              "poi": { "name": "Jantar Mantar", ... },
              "notes": "..."
            }
          ]
        }
      ]
    },
    "evaluations": {
      "editCorrectness": 0.9-1.0
    }
  }
}
```

**Test**:
- ✅ Correct day modified (Day 1, not Day 2/3)
- ✅ Correct period modified (morning, not afternoon/evening)
- ✅ POI name updated to "Jantar Mantar"
- ✅ Edit highlight shows in response
- ✅ editCorrectness score ≥ 0.8

---

#### Test 2.2: Edit Different Days

**Setup**: Jaipur itinerary

**Sequence**:
1. "Change Day 2 afternoon to shopping at Bapu Bazaar"
2. "Change Day 3 evening to dinner at local restaurant"

**Expected**:
- Day 2 afternoon changes to shopping
- Day 3 evening changes to restaurant
- No cross-contamination between edits

---

#### Test 2.3: Complex Edit

**Input**: "Instead of museums on day 1, let's do outdoor adventures"

**Expected**:
- LLM infers "Day 1"
- Understands "museums" → "outdoor adventures"
- Updates multiple blocks in Day 1 if needed
- Maintains feasibility

---

#### Test 2.4: Edge Case - Invalid Day

**Input**: "Change Day 5 to something else" (when itinerary is only 3 days)

**Expected**:
- Error: "Day 5 not found (itinerary has 3 days)"
- Status: 400
- Does not modify any blocks

---

### Category 3: Explain (Answer Questions)

These should trigger the `/explain` endpoint.

#### Test 3.1: Weather Question

**Setup**: Jaipur itinerary

**Input**: "What's the weather like in Jaipur?"

**Expected Output**:
```json
{
  "ok": true,
  "answer": "Jaipur weather: Sunny, 28°C, humidity 45%. Good for outdoor exploration. Pack light clothes and sunscreen.",
  "sources": ["weather:open-meteo", "itinerary:context"]
}
```

**Test**:
- ✅ Answer includes temperature
- ✅ Answer includes condition (Sunny/Rainy/etc.)
- ✅ Answer is conversational
- ✅ Sources listed

---

#### Test 3.2: Itinerary Question

**Setup**: Jaipur itinerary

**Input**: "How much time do I spend on Day 2?"

**Expected Output**:
```json
{
  "answer": "On Day 2, you have 4.5 hours of planned activities: 45 min at Hawa Mahal, 90 min at City Palace, and 1.5 hours of free time.",
  "sources": ["itinerary:day-2"]
}
```

---

#### Test 3.3: Activity Question

**Input**: "What's the best time to visit Amber Fort?"

**Expected Output**:
- Should provide early morning recommendation
- Should mention crowds
- Should reference WikiVoyage data

---

#### Test 3.4: Edge Case - No Answer Found

**Input**: "What's the capital of France?" (unrelated to itinerary)

**Expected**:
- Should politely decline or provide general answer
- Should stay focused on itinerary context
- Should not error out

---

## Evaluation Metrics

### 1. Feasibility Score (0-1)

**What it measures**: Can the user actually complete the itinerary in the given days?

**Calculation**:
- Check total activity time + travel time per day
- Divide by daylight hours (8am-6pm = 10 hours)
- Score = 1 - (ratio > 1 ? ratio - 1 : 0)

**Scoring**:
- 0.95-1.0: Relaxed schedule (≤7 hours/day)
- 0.85-0.95: Normal schedule (7-9 hours/day)
- 0.70-0.85: Tight schedule (9-10 hours/day)
- <0.70: Too tight (>10 hours/day) ❌

**Test Case**:
```bash
# Create Jaipur itinerary
# Check feasibility score
curl -X POST http://localhost:3001/plan \
  -H "Content-Type: application/json" \
  -d '{"utterance":"Plan a trip to Jaipur"}' \
  | jq '.state.evaluations.feasibility'

# Expected: 0.8-0.95
```

---

### 2. Grounding Score (0-1)

**What it measures**: Are POIs real and sourced from OpenStreetMap?

**Calculation**:
- For each POI: 1.0 if from Overpass, 0.7 if from mock data
- Average across all POIs

**Scoring**:
- 0.95-1.0: All POIs from real Overpass data ✅
- 0.80-0.95: Mostly real data, some mock ⚠️
- <0.80: Mostly mock data ❌

**Test Case**:
```bash
# Check grounding score
curl -X POST http://localhost:3001/plan \
  -d '{"utterance":"Plan a trip to Jaipur"}' \
  | jq '.state.evaluations.grounding'

# Expected: 0.9-1.0 (if Overpass API working)
```

---

### 3. Edit Correctness Score (0-1)

**What it measures**: Did the edit apply to the right day/period/POI?

**Calculation**:
- Day correct: +0.4 points
- Period (morning/afternoon/evening) correct: +0.3 points
- Activity/POI correct: +0.3 points

**Scoring**:
- 0.95-1.0: Perfect edit ✅
- 0.70-0.95: Minor issue (wrong period) ⚠️
- <0.70: Wrong day or major mistake ❌

**Test Case**:
```bash
# Create itinerary
SESSION=$(curl -s -X POST http://localhost:3001/plan \
  -d '{"utterance":"Plan a trip to Jaipur"}' \
  | jq -r '.sessionId')

# Edit Day 2
curl -X POST http://localhost:3001/edit \
  -H "Content-Type: application/json" \
  -d "{\"sessionId\":\"$SESSION\",\"utterance\":\"Change Day 2 afternoon to Amber Fort\"}" \
  | jq '.state.evaluations.editCorrectness'

# Expected: 0.85-1.0
```

---

## Test Execution Flow

### Manual E2E Test (30 minutes)

```bash
# 1. Start backend
cd backend && npm run dev

# 2. Create itinerary
curl -X POST http://localhost:3001/plan \
  -H "Content-Type: application/json" \
  -d '{"utterance":"Plan a trip to Jaipur for 3 days"}' \
  | jq '.' > jaipur_plan.json

# Extract sessionId
SESSION=$(cat jaipur_plan.json | jq -r '.sessionId')

# 3. Verify structure
cat jaipur_plan.json | jq '.state.itinerary.days | length'
# Expected: 3

# 4. Check POI names (should be human-readable)
cat jaipur_plan.json | jq '.state.itinerary.days[0].blocks[0].poi.name'
# Expected: "Hawa Mahal" (not "osm:node:298884325")

# 5. Edit an activity
curl -X POST http://localhost:3001/edit \
  -H "Content-Type: application/json" \
  -d "{\"sessionId\":\"$SESSION\",\"utterance\":\"Change Day 1 morning to Amber Fort\"}" \
  | jq '.' > jaipur_edit.json

# 6. Verify edit applied to correct day
cat jaipur_edit.json | jq '.state.itinerary.days[0].blocks[0].poi.name'
# Expected: "Amber Fort"

# 7. Verify edit correctness score
cat jaipur_edit.json | jq '.state.evaluations.editCorrectness'
# Expected: 0.85-1.0

# 8. Ask a question
curl -X POST http://localhost:3001/explain \
  -H "Content-Type: application/json" \
  -d "{\"sessionId\":\"$SESSION\",\"utterance\":\"What's the weather?\"}" \
  | jq '.answer'

# 9. Test email (if n8n running)
curl -X POST http://localhost:3001/email-itinerary \
  -H "Content-Type: application/json" \
  -d "{\"sessionId\":\"$SESSION\",\"toEmail\":\"test@example.com\"}" \
  | jq '.'
# Expected: { "ok": true, "sentTo": "test@example.com", ... }
```

---

## Automated Test Scripts

### test-api.js

Full integration test of all endpoints.

```bash
node backend/test-api.js
```

**Tests**:
- ✅ Plan endpoint (basic)
- ✅ Plan endpoint (with interests)
- ✅ Edit endpoint
- ✅ Explain endpoint
- ✅ Session persistence
- ✅ Error handling (missing city)

**Output**:
```
✓ Plan endpoint: PASS (123ms)
✓ Edit endpoint: PASS (456ms)
✓ Explain endpoint: PASS (789ms)
✓ Session ID persisted: PASS
✓ Error handling: PASS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total: 5/5 PASS
```

---

### test-city-extract.js

Tests city extraction (regex patterns + LLM fallback).

```bash
node backend/test-city-extract.js
```

**Test Cases**:
```
"Plan a trip to Jaipur"           → Jaipur ✓
"I want to go to Mumbai"          → Mumbai ✓
"Trip to Agra for 2 days"         → Agra ✓
"Visit Goa next week"             → Goa ✓
"Explore Udaipur with friends"    → Udaipur ✓
"No city mentioned"               → MISSING_CITY ✓
```

---

### test-edit-extract.js

Tests edit command extraction.

```bash
node backend/test-edit-extract.js
```

**Test Cases**:
```
"Change Day 1 morning to beaches"
  → day: 1, period: "morning", action: "change"

"Update Day 2 afternoon activity"
  → day: 2, period: "afternoon", action: "update"

"Add a restaurant to Day 3 evening"
  → day: 3, period: "evening", action: "add"

"Remove the museum from Day 1"
  → day: 1, action: "remove"
```

---

### test-nominatim.js

Tests city geocoding via Nominatim API.

```bash
node backend/test-nominatim.js
```

**Test Cases**:
```
Jaipur   → lat: 26.9124, lon: 75.7873 ✓
Mumbai   → lat: 19.0760, lon: 72.8777 ✓
Delhi    → lat: 28.7041, lon: 77.1025 ✓
InvalidCity → Error: INVALID_CITY ✓
```

---

### test-email-endpoint.js

Tests email PDF sending via n8n.

```bash
# Update TEST_SESSION_ID and TEST_EMAIL in file
node backend/test-email-endpoint.js
```

---

## Performance Testing

### Response Times

**Target Benchmarks**:
| Endpoint | Target | Acceptable |
|----------|--------|-----------|
| /plan | <3 seconds | <5 seconds |
| /edit | <2 seconds | <4 seconds |
| /explain | <2 seconds | <4 seconds |
| /email-itinerary | <10 seconds | <20 seconds |

**Test Script**:
```bash
time curl -X POST http://localhost:3001/plan \
  -d '{"utterance":"Plan a trip to Jaipur"}'
```

### Load Testing

With Apache Bench (if available):

```bash
# 100 concurrent requests
ab -n 100 -c 10 -p data.json -T application/json http://localhost:3001/plan
```

---

## Error Handling Tests

### Expected Error Responses

#### Missing City (400)
```bash
curl -X POST http://localhost:3001/plan \
  -d '{"utterance":"Plan a trip"}'

# Expected:
{
  "ok": false,
  "error": "MISSING_CITY",
  "details": "Could not extract city from: Plan a trip"
}
```

#### Invalid City (400)
```bash
curl -X POST http://localhost:3001/plan \
  -d '{"utterance":"Plan a trip to Atlantis"}'

# Expected:
{
  "ok": false,
  "error": "INVALID_CITY",
  "details": "City not found: Atlantis"
}
```

#### Invalid Email (400)
```bash
curl -X POST http://localhost:3001/email-itinerary \
  -d '{"sessionId":"abc","toEmail":"not-an-email"}'

# Expected:
{
  "ok": false,
  "error": "INVALID_EMAIL"
}
```

#### Session Not Found (400)
```bash
curl -X POST http://localhost:3001/edit \
  -d '{"sessionId":"nonexistent","utterance":"Change Day 1"}'

# Expected:
{
  "ok": false,
  "error": "SESSION_NOT_FOUND"
}
```

---

## Data Validation Tests

### POI Structure

Every POI should have:
```json
{
  "id": "osm:node:xxx",           // Must have osm: prefix
  "name": "String",                // Human-readable
  "location": {
    "lat": number,
    "lon": number
  },
  "duration": number,              // Minutes (30-180)
  "typicalDurationHours": number,  // 0.5-3
  "confidence": number             // 0-1
}
```

**Test**:
```bash
curl -X POST http://localhost:3001/plan \
  -d '{"utterance":"Plan a trip to Jaipur"}' \
  | jq '.state.itinerary.days[0].blocks[0].poi' \
  | jq 'has("id") and has("name") and has("location")'

# Expected: true
```

---

### Travel Time Format

Travel times must be human-readable:

```json
{
  "method": "walk|car|transit",
  "minutes": number
}
```

Displayed as: "🚗 ~15 min drive"

**Test**:
```bash
curl -X POST http://localhost:3001/plan \
  -d '{"utterance":"Plan a trip to Jaipur"}' \
  | jq '.state.itinerary.days[0].blocks[0].travelTime'

# Expected: { "method": "walk|car", "minutes": 15 }
# NOT: { "osrm_duration": 900, "osrm_distance": 15000 }
```

---

## Regression Testing

After any change, run:

```bash
# 1. Quick sanity check
npm run build

# 2. Test suite
node test-api.js
node test-city-extract.js
node test-edit-extract.js

# 3. Manual E2E
# Follow "Manual E2E Test" section above
```

---

## Browser/Frontend Testing

### Chrome DevTools

```
1. Open http://localhost:5174
2. Press F12 → DevTools
3. Network tab → filter by XHR
4. Speak: "Plan a trip to Jaipur"
5. Check Network requests:
   - POST /plan → 200
   - Response has sessionId
   - Response has itinerary.days[0]
6. Itinerary should render with:
   - Day 1, Day 2, Day 3 tabs
   - Morning/Afternoon/Evening blocks
   - POI names visible
   - Travel times visible ("🚗 ~15 min")
```

### Error Scenario Testing

```
1. Say: "Plan a trip"  (no city)
   → Should show error: "Missing city"

2. Say: "Plan a trip to Atlantis"  (invalid city)
   → Should show error: "City not found"

3. Check Debug Console (bottom-left)
   → Should show API logs
```

---

## Checklist for Release

- [ ] All tests pass: `npm test` ✓
- [ ] No TypeScript errors: `npm run build` ✓
- [ ] Manual E2E test successful ✓
- [ ] Response times acceptable (< 5s) ✓
- [ ] Error handling works (missing city, invalid city, etc.) ✓
- [ ] POI data is clean (no OSM IDs in UI) ✓
- [ ] Travel times human-readable ✓
- [ ] Evaluations calculated correctly ✓
- [ ] Edit correctness > 0.8 for valid edits ✓
- [ ] Email feature works (if enabled) ✓

---

**Last Updated**: Feb 10, 2026
