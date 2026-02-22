# Constraint Loop Debugging Quick Reference

## What's New

Enhanced Dev Console observability with 5 new structured log types specifically designed to debug the constraint loop.

## The 5 Structured Logs

### 1️⃣ STATE_TRANSITION { from, to }
```
[STATE] STATE_TRANSITION LISTENING -> PROCESSING
```
**Shows**: Every conversation state change  
**Use**: Track if state machine is progressing normally

---

### 2️⃣ CONSTRAINT_STATE { extracted, draft, merged, missing }
```
[CONSTRAINT] CONSTRAINT_STATE snapshot
{
  "extractedFromTranscript": { "numDays": 2, "vibe": "relaxed" },
  "draftConstraints": { "answer": "temples" },
  "mergedConstraints": { "numDays": 2, "vibe": "relaxed" },
  "missingFields": ["pace"]
}
```
**Shows**: Full constraint collection state at key moments  
**Use**: See what's been extracted vs. what's still missing

---

### 3️⃣ REPROCESS_REASON { reason, transcript, hash, count }
```
[CONSTRAINT] REPROCESS_REASON: DUPLICATE_TRANSCRIPT_DETECTED (occurrence #2)
{
  "transcriptHash": "a1b2c3d4",
  "transcript": "Plan a 2-day trip",
  "reprocessCount": 2
}
```
**Shows**: When same transcript is processed multiple times (loop indicator!)  
**Use**: Detect constraint loops instantly

---

### 4️⃣ TRANSCRIPT_HASH (embedded in processing logs)
```
[INTENT] Processing transcript: "Plan a 2-day trip" { transcriptHash: "a1b2c3d4" }
```
**Shows**: Hash of current transcript (for deduplication)  
**Use**: Compare hashes across time to spot reprocessing

---

### 5️⃣ PLAN_API_CALL_START / SUCCESS / ERROR
```
[API] PLAN_API_CALL_START
{
  "requestId": "uuid-abc123",
  "transcript": "Plan a 2-day trip",
  "transcriptHash": "a1b2c3d4"
}

[API] PLAN_API_CALL_SUCCESS
{
  "requestId": "uuid-abc123",
  "sessionId": "session-xyz",
  "latency": 2350
}

[API] PLAN_API_CALL_ERROR
{
  "requestId": "uuid-abc123",
  "error": "Missing constraint: pace",
  "latency": 450
}
```
**Shows**: Exact point of API communication  
**Use**: Verify API is being called with correct data and constraints

---

## How to Debug

### Scenario: "I say something and keep getting asked the same question"

1. **Open Dev Console** → Filter by `CONSTRAINT`
2. **Look for TRANSCRIPT_HASH** → Same hash appearing twice = 🚨 LOOP
3. **Check CONSTRAINT_STATE** → Are missingFields the same each time?
4. **Check STATE_TRANSITION** → Is it bouncing between CONFIRMING_CONSTRAINTS?

### Scenario: "I answer questions but API never gets called"

1. **Filter by `API`** → Look for `PLAN_API_CALL_START`
2. **If missing**: Check `CONSTRAINT_STATE` → missingFields empty?
3. **If present**: Check for errors in PLAN_API_CALL_ERROR

### Scenario: "API returns error about missing constraints"

1. **Check PLAN_API_CALL_START** → What transcript/constraints were sent?
2. **Check CONSTRAINT_STATE** → Was that constraint extracted/answered?
3. **Compare MERGED_CONSTRAINTS** → Does it have what API needs?

---

## Key Emission Points

| When | What Gets Logged |
|------|-----------------|
| **After STT captures text** | `STATE_TRANSITION`, `STT_FINAL`, `CONSTRAINT_STATE` (initial) |
| **After user answers question** | `CONSTRAINT_STATE` (with answer), then either next question or `PLAN_API_CALL_START` |
| **Before calling backend API** | `PLAN_API_CALL_START` with transcript + hash |
| **After API responds** | `PLAN_API_CALL_SUCCESS` or `PLAN_API_CALL_ERROR` with latency |
| **Detecting duplicate processing** | `REPROCESS_REASON: DUPLICATE_TRANSCRIPT_DETECTED` |

---

## Example: Full Debugging Session

**User says**: "Plan a 2-day relaxed trip visiting temples"

```
[STT] STT_FINAL { text: "Plan a 2-day relaxed trip visiting temples" }
[INTENT] Processing transcript: "Plan a 2-day..." { transcriptHash: "hash1" }
[CONSTRAINT] CONSTRAINT_STATE {
  extracted: { numDays: 2, vibe: "relaxed", interests: ["temples"] },
  missing: ["pace"]
}
[CONSTRAINT] Asking constraint question: "What pace preference?"

[STT] STT_FINAL { text: "relaxed" }
[CONSTRAINT] Answering constraint: "relaxed"
[CONSTRAINT] CONSTRAINT_STATE {
  merged: { numDays: 2, vibe: "relaxed", pace: "relaxed", interests: ["temples"] },
  missing: []
}
[STATE] STATE_TRANSITION CONFIRMING_CONSTRAINTS -> PROCESSING
[API] PLAN_API_CALL_START { requestId: "req1", transcript: "Plan a...", transcriptHash: "hash1" }
[API] PLAN_API_CALL_SUCCESS { requestId: "req1", sessionId: "sess1", latency: 2350 }
[STATE] STATE_TRANSITION PROCESSING -> IDLE
✅ SUCCESS!
```

**vs. Problem Case** (keep getting same question):

```
[STT] STT_FINAL { text: "Plan a 2-day..." }
[INTENT] Processing transcript: "Plan a 2-day..." { transcriptHash: "hash1" }
[CONSTRAINT] CONSTRAINT_STATE { extracted: { numDays: 2 }, missing: ["vibe"] }
[CONSTRAINT] Asking constraint question: "What vibe?"

[STT] STT_FINAL { text: "relaxed" }
[CONSTRAINT] Answering constraint: "relaxed"
[CONSTRAINT] CONSTRAINT_STATE { merged: { numDays: 2, vibe: "relaxed" }, missing: ["vibe"] }  ← ⚠️ STILL MISSING vibe?!
[CONSTRAINT] Asking constraint question: "What vibe?"  ← ⚠️ SAME QUESTION AGAIN

[STT] STT_FINAL { text: "relaxed" }
[CONSTRAINT] REPROCESS_REASON: DUPLICATE_TRANSCRIPT_DETECTED (occurrence #2)  ← 🚨 LOOP DETECTED!
```

---

## Dev Console Tips

- **Filter by category** to focus on constraint issues
- **Click the ▶ Data button** to expand and inspect extracted/merged constraints
- **Use Export** to save logs for detailed analysis
- **Watch for TRANSCRIPT_HASH** — identical hashes = reprocessing

---

## Files Changed

- ✅ `frontend/src/services/debugLogging.ts` (NEW)
  - Logging utilities and `ReprocessDetector` class
  
- ✅ `frontend/src/hooks/useVoiceAssistant.ts` (UPDATED)
  - Integrated all 5 new structured logs at key points
  - Added `ReprocessDetector` instance for duplicate detection
  - State transition tracking

- ✅ `frontend/src/components/DeveloperConsole.tsx` (UNCHANGED)
  - Already supports displaying structured data

---

## Build Status

✅ **Build successful** - 90 modules transformed, 0 errors

```
vite v7.3.1 building for production...
✓ 90 modules transformed.
✓ built in 2.11s
```

---

## Next: Run and Test

1. Start dev server: `npm run dev`
2. Open Dev Console (right side panel)
3. Try a voice interaction
4. Watch the structured logs appear
5. Filter by CONSTRAINT to debug any loops

When submitting the same input twice, you should see `REPROCESS_REASON: DUPLICATE_TRANSCRIPT_DETECTED` in the logs!
