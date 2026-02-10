import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

// ---- Routes (mocked for now) ----
app.post("/plan", (req, res) => {
  res.json({
    session: {
      sessionId: "mock-session-1",
      constraints: {
        city: "Jaipur",
        numDays: 3,
        pace: "relaxed",
        interests: ["food", "culture"],
        maxDailyHours: 6
      },
      poiResult: {
        city: "Jaipur",
        pois: [],
        fallbackUsed: true,
        fallbackReason: "Mock data"
      },
      poiCatalog: {},
      itinerary: {
        city: "Jaipur",
        days: [],
        meta: { assumptions: [], unselectedPoiIds: [] }
      },
      dayHashes: {},
      tips: [],
      evals: {
        feasibility: { name: "feasibility", passed: true, failures: [] },
        editCorrectness: null,
        grounding: { name: "grounding", passed: true, failures: [] }
      },
      toolTrace: { calls: [] },
      clarificationCount: 0,
      createdAtISO: new Date().toISOString(),
      updatedAtISO: new Date().toISOString()
    }
  });
});

app.post("/edit", (req, res) => res.json({ ok: true }));
app.post("/explain", (req, res) => res.json({ answer: "Mock explanation", citations: [] }));
app.post("/export", (req, res) => res.json({ status: "queued" }));

// ---- Start server ----
const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
