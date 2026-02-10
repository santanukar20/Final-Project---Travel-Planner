// shared/types.ts
// Frozen data contracts for the Voice-First AI Travel Planner.
// Do NOT casually change once backend/frontend are wired.

export type Pace = "relaxed" | "normal" | "packed";
export type TimeOfDay = "Morning" | "Afternoon" | "Evening";

export interface Constraints {
  city: string;                 // e.g., "Jaipur"
  numDays: number;              // 2–4 (capstone scope)
  datesText?: string;           // e.g., "next weekend" (optional)
  pace: Pace;
  interests: string[];          // e.g., ["food","culture"]
  maxDailyHours: number;        // e.g., 6
  indoorPreference?: boolean;   // e.g., true if user asks indoor options
  notes?: string[];             // any extra constraints or preferences
}

/** ===== POI (OpenStreetMap via Overpass) ===== */
export type POISource = "OpenStreetMap" | "Mock";

export interface POI {
  id: string; // must map back to dataset record, e.g. "osm:node:123", "osm:way:456"
  name: string;
  type: string; // e.g., "historic" | "museum" | "market" | "restaurant" | ...
  tags: Record<string, string>;
  location: { lat: number; lon: number };
  typicalDurationHours: number;
  confidence: number; // 0..1 (heuristic ranking confidence)
  source: POISource;
}

export interface POISearchInput {
  city: string;
  interests: string[];
  pace: Pace;
  maxCandidates: number;
  avoidTypes?: string[];
  mustIncludeTypes?: string[];
}

export interface POISearchResult {
  city: string;
  pois: POI[];
  fallbackUsed: boolean;
  fallbackReason?: string;
}

/** ===== Itinerary ===== */
export interface TravelEstimate {
  mode: "walk" | "car" | "mixed";
  minutes: number;
  method: "distance_bucket" | "api" | "unknown";
}

export interface ItineraryBlock {
  timeOfDay: TimeOfDay;
  poiId: string | null; // null allowed for "rest/free time"
  title: string;        // display title
  durationHours: number;
  travelFromPrev: TravelEstimate;
  notes: string[];      // short bullets (practical)
}

export interface ItineraryDay {
  name: string;              // "Day 1", "Day 2"...
  blocks: ItineraryBlock[];  // usually 3 blocks (M/A/E)
  totalPlannedHours: number; // duration + travel summed
}

export interface Itinerary {
  city: string;
  days: ItineraryDay[];
  meta: {
    assumptions: string[];       // e.g., "travel time uses distance buckets"
    unselectedPoiIds: string[];  // POIs not chosen
  };
}

export interface ItineraryBuilderInput {
  city: string;
  days: number;
  dailyTimeLimitHours: number;
  pace: Pace;
  candidatePoiIds: string[];
  poiCatalog: Record<string, POI>;
  maxPoisPerDay: number;
  startEndLocation?: "city_center" | "hotel" | "unknown";
}

export interface ItineraryBuilderResult {
  itinerary: Itinerary;
  meta: {
    unselectedPoiIds: string[];
    assumptions: string[];
  };
}

/** ===== RAG tips + citations ===== */
export type RAGSource = "Wikivoyage" | "Wikipedia";

export interface Citation {
  source: RAGSource;
  page: string;      // e.g., "Jaipur"
  anchor?: string;   // e.g., "Get around"
  snippet?: string;  // short snippet (optional, keep small)
}

export interface Tip {
  id: string;
  claim: string;
  citations: Citation[];     // must be non-empty for factual tips
  confidence: "low" | "medium" | "high";
  isGeneralAdvice: boolean;  // true only if citations are not available
}

export interface RAGQueryInput {
  city: string;
  query: string;             // e.g., "get around", "safety", "best areas"
  maxSnippets: number;
}

export interface RAGQueryResult {
  city: string;
  snippets: Citation[];      // citations with optional snippets
  fallbackUsed: boolean;
  fallbackReason?: string;
}

/** ===== Voice parsing outputs ===== */
export interface ParseConstraintsResult {
  constraints: Constraints;
  needsClarification: boolean;
  clarifyingQuestions: string[];
}

export type EditIntent =
  | "relax_day"
  | "swap_block"
  | "make_indoor"
  | "reduce_travel"
  | "add_food_place"
  | "remove_stop"
  | "unknown";

export interface EditTarget {
  dayName: string;           // "Day 1"
  timeOfDay?: TimeOfDay;     // optional if whole day
}

export interface ParseEditResult {
  editIntent: EditIntent;
  target: EditTarget;
  requestText: string;
  constraintsDelta?: Partial<Constraints>;
  blockingQuestion?: string | null;
}

/** ===== Evaluations ===== */
export interface EvalFailure {
  check: string;
  message: string;
}

export interface EvalResult {
  name: "feasibility" | "edit_correctness" | "grounding";
  passed: boolean;
  failures: EvalFailure[];
}

export interface EvalBundle {
  feasibility: EvalResult;
  editCorrectness: EvalResult | null; // null for initial plan
  grounding: EvalResult;
}

/** ===== Tool trace (for demo + grading) ===== */
export type ToolName =
  | "poi_search_mcp"
  | "itinerary_builder_mcp"
  | "rag_retrieval"
  | "weather_mcp"
  | "travel_time_mcp";

export interface ToolCallTrace {
  toolName: ToolName;
  inputSummary: string;   // keep short
  outputSummary: string;  // keep short
  timestampISO: string;
}

export interface ToolTraceBundle {
  calls: ToolCallTrace[];
}

/** ===== Session state (needed for edit correctness) ===== */
export interface SessionState {
  sessionId: string;
  constraints: Constraints;

  poiResult: POISearchResult;
  poiCatalog: Record<string, POI>;

  itinerary: Itinerary;

  // Hash per day so edits can prove only intended parts changed
  dayHashes: Record<string, string>;

  tips: Tip[];
  evals: EvalBundle;
  toolTrace: ToolTraceBundle;

  clarificationCount: number;
  createdAtISO: string;
  updatedAtISO: string;
}

/** ===== API request/response shapes ===== */
export interface PlanRequest {
  sessionId?: string;      // optional if continuing a session
  utterance: string;       // transcript from voice or typed text
  defaults?: Partial<Constraints>; // optional defaults
}

export interface PlanResponse {
  session: SessionState;
}

export interface EditRequest {
  sessionId: string;
  utterance: string;       // voice command transcript
}

export interface EditResponse {
  session: SessionState;
}

export interface ExplainRequest {
  sessionId: string;
  question: string;        // e.g., "Why did you pick Amber Fort?"
  dayName?: string;
  timeOfDay?: TimeOfDay;
  poiId?: string;
}

export interface ExplainResponse {
  answer: string;
  citations: Citation[];
  relatedEvals?: EvalResult[]; // optionally include feasibility grounding info
}

/** ===== Export for n8n (stable + minimal) ===== */
export interface ExportBlock {
  timeOfDay: TimeOfDay;
  title: string;
  summary: string; // short line: duration + travel + why
}

export interface ExportDay {
  name: string;
  blocks: ExportBlock[];
}

export interface ExportItinerary {
  tripTitle: string;  // "3-Day Jaipur: Food & Culture (Relaxed)"
  city: string;
  days: ExportDay[];
  notes: string[];    // key tips + assumptions (with citations in UI separately)
}

export interface ExportRequest {
  sessionId: string;
  emailTo: string;    // where to send PDF
}

export interface ExportResponse {
  status: "queued" | "sent" | "failed";
  message?: string;
}
