# Dev Console Enhanced Logging Guide

## Overview
Enhanced structured logging has been added to the Voice-First Travel Planner to provide comprehensive observability for debugging the constraint loop.

## New Log Categories and Structures

### 1. STATE_TRANSITION
**Location**: Logged whenever `conversationState` changes  
**Category**: `STATE`  
**Level**: `info`  
**Structure**:
```json
{
  "from": "IDLE",
  "to": "LISTENING"
}
```
**Example**: `STATE_TRANSITION IDLE -> LISTENING`

---

### 2. CONSTRAINT_STATE
**Location**: 
- After transcript confirmed (initial extraction)
- After constraint answer (new state after user response)
- After constraint skip
- After constraints confirmed

**Category**: `CONSTRAINT`  
**Level**: `info`  
**Structure**:
```json
{
  "extractedFromTranscript": {
    "numDays": 2,
    "vibe": "relaxed"
  },
  "draftConstraints": {
    "answer": "temples"
  },
  "mergedConstraints": {
    "numDays": 2,
    "vibe": "relaxed"
  },
  "missingFields": ["pacePreference"]
}
```
**What it shows**:
- `extractedFromTranscript`: Constraints automatically detected from speech
- `draftConstraints`: User answers to specific questions
- `mergedConstraints`: Final collected constraints (extracted + answered)
- `missingFields`: Constraints still needed before plan API call

---

### 3. REPROCESS_REASON (from ReprocessDetector)
**Location**: Detected in `processTranscript()` when same transcript hash appears twice
**Category**: `CONSTRAINT`  
**Level**: `warning`  
**Structure**:
```json
{
  "reason": "DUPLICATE_TRANSCRIPT_DETECTED (occurrence #2)",
  "transcriptHash": "a1b2c3d4",
  "transcript": "Plan a 2-day relaxed trip",
  "reprocessCount": 2
}
```
**Why it matters**: If you see this log, it means the same user input is being processed multiple times, which could indicate:
- Constraint question loop that never progresses
- State not being reset properly after API call
- User re-submitting same transcript

---

### 4. TRANSCRIPT_HASH
**Location**: Logged with processing transcript
**Category**: `INTENT`  
**Level**: `info`  
**Structure**:
```json
{
  "Processing transcript: \"Plan a 2-day relaxed trip\"",
  "data": {
    "transcriptHash": "a1b2c3d4"
  }
}
```
**Use**: Compare hashes across logs to identify duplicate submissions

---

### 5. PLAN_API_CALL_START
**Location**: Before `api.plan()` call
**Category**: `API`  
**Level**: `info`  
**Structure**:
```json
{
  "requestId": "uuid-xyz",
  "transcript": "Plan a 2-day relaxed trip",
  "transcriptHash": "a1b2c3d4"
}
```

---

### 6. PLAN_API_CALL_SUCCESS
**Location**: After successful `api.plan()` response
**Category**: `API`  
**Level**: `info`  
**Structure**:
```json
{
  "requestId": "uuid-xyz",
  "sessionId": "session-abc",
  "latency": 2350
}
```

---

### 7. PLAN_API_CALL_ERROR
**Location**: If `api.plan()` throws error
**Category**: `API`  
**Level**: `error`  
**Structure**:
```json
{
  "requestId": "uuid-xyz",
  "error": "Missing constraint: pacePreference",
  "latency": 450
}
```

---

## How to Debug Constraint Loop

### Scenario: "User says something, gets asked a question, but keeps looping"

**Step 1**: Filter console to `CONSTRAINT` category
- Look for `CONSTRAINT_STATE` snapshots
- Check `missingFields` - are there always missing fields?

**Step 2**: Look for duplicate TRANSCRIPT_HASH
```
INTENT: Processing transcript: "..." { transcriptHash: "a1b2c3d4" }
...later...
INTENT: Processing transcript: "..." { transcriptHash: "a1b2c3d4" }  ← SAME HASH = LOOP!
```

**Step 3**: Track state transitions
```
STATE_TRANSITION IDLE -> LISTENING
STATE_TRANSITION LISTENING -> TRANSCRIBING
STATE_TRANSITION TRANSCRIBING -> PROCESSING
STATE: Answering constraint: "temples"
STATE_TRANSITION CONFIRMING_CONSTRAINTS -> PROCESSING
STATE: Processing transcript: "..." { transcriptHash: "..." }  ← Why re-processing same?
```

**Step 4**: Check PLAN_API_CALL logs
- Did `PLAN_API_CALL_START` happen?
- If not, constraints never made it to API
- Check what was missing in `CONSTRAINT_STATE`

---

## Key Emission Points

### ✅ After Transcript Confirmed
**Emits**: `STATE_TRANSITION`, `STT_FINAL`, `CONSTRAINT_STATE` (initial extraction)

**Raw Flow**:
```
STT_FINAL { text: "Plan a 2-day relaxed trip", sttLatency: 1200 }
INTENT: Processing transcript: "..." { transcriptHash: "a1b2c3d4" }
STATE_TRANSITION TRANSCRIBING -> PROCESSING
CONSTRAINT_STATE: extractedFromTranscript: { numDays: 2 }, missingFields: [...]
```

---

### ✅ After Constraint Answer
**Emits**: `CONSTRAINT_STATE` (with answer), then either:
- `CONSTRAINT_STATE` (next question) or
- `PLAN_API_CALL_START` (all constraints satisfied)

**Raw Flow**:
```
CONSTRAINT: Answering constraint: "temples"
CONSTRAINT_STATE: { draftConstraints: { answer: "temples" }, missingFields: [...] }
PLAN_API_CALL_START { requestId: "...", transcript: "...", transcriptHash: "..." }
```

---

### ✅ Before Re-Processing Transcript
**Emits**: `ReprocessDetector.checkAndLog()` (if duplicate)

**Raw Flow**:
```
CONSTRAINT: REPROCESS_REASON: DUPLICATE_TRANSCRIPT_DETECTED (occurrence #2)
  { transcriptHash: "a1b2c3d4", reprocessCount: 2 }
INTENT: Processing transcript: "..." { transcriptHash: "a1b2c3d4" }
```

---

### ✅ Before Planning Call
**Emits**: `PLAN_API_CALL_START`

**Raw Flow**:
```
API: PLAN_API_CALL_START
  { requestId: "uuid-...", transcript: "...", transcriptHash: "..." }
```

---

### ✅ After Planning Call
**Emits**: `PLAN_API_CALL_SUCCESS` or `PLAN_API_CALL_ERROR`

**Success Flow**:
```
API: PLAN_API_CALL_SUCCESS
  { requestId: "uuid-...", sessionId: "session-...", latency: 2350 }
API: Plan API call successful
  { requestId: "uuid-...", sessionId: "...", latency: 2350 }
```

**Error Flow**:
```
API: PLAN_API_CALL_ERROR
  { requestId: "uuid-...", error: "Missing constraint: pace", latency: 450 }
API: API call failed: Missing constraint: pace
  { requestId: "uuid-..." }
```

---

## Using the Dev Console UI

### Filter by Category
Use the dropdown to isolate logs:
- **CONSTRAINT** → Debug constraint extraction and answers
- **API** → Debug plan/edit/explain calls
- **STATE** → Track conversation state machine
- **STT** → Debug speech recognition flow
- **INTENT** → Debug intent classification

### Expand Data
Click the ▶ button next to "Data" to see structured JSON:
```json
{
  "extractedFromTranscript": {...},
  "draftConstraints": {...},
  "mergedConstraints": {...},
  "missingFields": [...]
}
```

### Export Logs
Use the "Export" button to download JSON for external analysis

---

## Performance Metrics in Logs

Each major phase includes latency:
- `sttLatency`: Speech recognition time
- `intentLatency`: Intent classification time
- `constraintLatency`: Constraint extraction time
- `apiLatency`: API call time
- `totalLatency`: Total time from transcript to API response

Example:
```
API: PLAN_API_CALL_SUCCESS { latency: 2350 }
```

---

## Common Issues and Logs to Check

| Issue | Log to Check |
|-------|------------|
| User can't start listening | `STT: STT_STARTED` - missing? |
| No response to transcript | `CONSTRAINT_STATE: missingFields` - empty? |
| Stuck asking same question | `REPROCESS_REASON: DUPLICATE_TRANSCRIPT_DETECTED` |
| API never called | `PLAN_API_CALL_START` - missing? |
| API call fails | `PLAN_API_CALL_ERROR` - check error message |
| State stuck in CONFIRMING | `STATE_TRANSITION` - check if it returns to PROCESSING |

---

## Example: Full Constraint Loop Walkthrough

```
[STT] STT_STARTED {}
[STT] STT_FINAL { text: "Plan a 2-day relaxed trip", sttLatency: 1200 }
[STATE] STATE_TRANSITION LISTENING -> PROCESSING
[INTENT] Processing transcript: "Plan a 2-day relaxed trip" { transcriptHash: "abc123" }
[INTENT] Intent detected: PLAN_TRIP { confidence: 0.95 }
[CONSTRAINT] CONSTRAINT_STATE { extracted: { numDays: 2 }, missing: ["vibe", "pace"] }
[CONSTRAINT] Asking constraint question: "What's your preferred travel pace?"
[STATE] STATE_TRANSITION PROCESSING -> CONFIRMING_CONSTRAINTS

[STT] STT_STARTED {}
[STT] STT_FINAL { text: "relaxed", sttLatency: 1100 }
[CONSTRAINT] Answering constraint: "relaxed"
[CONSTRAINT] CONSTRAINT_STATE { answer: "relaxed", merged: { numDays: 2, vibe: "relaxed" }, missing: ["pace"] }
[CONSTRAINT] Asking constraint question: "Any specific pace preference?"
[STATE] STATE_TRANSITION CONFIRMING_CONSTRAINTS (remains)

[STT] STT_STARTED {}
[STT] FINAL { text: "no preferences", sttLatency: 900 }
[CONSTRAINT] Answering constraint: "skip"
[CONSTRAINT] CONSTRAINT_STATE { skipped: true, merged: { numDays: 2, vibe: "relaxed" }, missing: [] }
[STATE] STATE_TRANSITION CONFIRMING_CONSTRAINTS -> PROCESSING
[API] PLAN_API_CALL_START { requestId: "req-789", transcript: "Plan a 2-day...", transcriptHash: "abc123" }
[API] PLAN_API_CALL_SUCCESS { requestId: "req-789", sessionId: "sess-456", latency: 2350 }
[STATE] STATE_TRANSITION PROCESSING -> IDLE
```

---

## Debugging Tips

1. **Always check transcript hash** - Identical hashes = duplicate processing (likely a bug)
2. **Missing fields always empty?** - Constraint extraction may be failing
3. **Never reaches PLAN_API_CALL_START?** - Constraints not being satisfied
4. **PLAN_API_CALL_ERROR?** - Backend rejecting constraints (check error message)
5. **State transition never completes?** - Check if dispatch is actually happening

---

## Files Modified

- `frontend/src/services/debugLogging.ts` - New logging utilities
- `frontend/src/hooks/useVoiceAssistant.ts` - Enhanced with structured logs

---

**Last Updated**: When enhanced logging was added  
**Build Status**: ✅ All 90 modules built successfully
