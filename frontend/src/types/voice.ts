// src/types/voice.ts
// Voice assistant state types and interfaces

import { Constraints, Citation } from '@shared/types';

// ====================
// Conversation States
// ====================

export type ConversationState = 
  | 'IDLE'
  | 'LISTENING'
  | 'TRANSCRIBING'
  | 'PROCESSING'
  | 'CONFIRMING_CONSTRAINTS'
  | 'ERROR';

export type VoiceStatus = 
  | 'idle'
  | 'listening'
  | 'transcribing'
  | 'processing'
  | 'error';

// ====================
// Intent Types
// ====================

export type IntentType = 
  | 'PLAN_TRIP'
  | 'EDIT_ITINERARY'
  | 'EXPLAIN_ITINERARY'
  | 'OUT_OF_SCOPE'
  | 'OUT_OF_CITY';

export interface IntentResult {
  intent: IntentType;
  confidence: number;
  reasoning: string;
  editVerbs?: string[];
  explainVerbs?: string[];
  detectedCity?: string;
}

// ====================
// Explain Response Types
// ====================

export interface ExplainResponseData {
  answer: string;
  citations: Citation[];
  question: string;
  timestamp: number;
}

// ====================
// Edit Response Types
// ====================

export interface EditResponseData {
  changedDays: number[];
  changedBlocks: string[];
  command: {
    action: string;
    scope?: { dayIndex?: number; block?: string };
  };
}

// ====================
// Constraint Types
// ====================

export interface PartialConstraints {
  // city is hard-locked to Varanasi
  numDays?: number;
  pace?: 'relaxed' | 'normal' | 'packed';
  maxDailyHours?: number;
  interests?: string[];
}

export interface ConstraintQuestion {
  field: keyof Constraints;
  question: string;
  options?: string[];
  skipable: boolean;
}

export interface ConstraintStatus {
  collected: PartialConstraints;
  missing: (keyof Constraints)[];
  questions: ConstraintQuestion[];
  isComplete: boolean;
}

// ====================
// Transcript Types
// ====================

export interface TranscriptData {
  raw: string;
  cleaned: string;
  isFinal: boolean;
  timestamp: number;
}

// ====================
// Processing Types
// ====================

export type ProcessingPhase = 
  | 'intent_detection'
  | 'constraint_extraction'
  | 'api_call'
  | 'response_parsing'
  | 'complete';

export interface ProcessingStatus {
  phase: ProcessingPhase;
  message: string;
  progress: number; // 0-100
}

// ====================
// Error Types
// ====================

export interface VoiceError {
  code: string;
  message: string;
  recoverable: boolean;
  retryAction?: string;
}

// ====================
// Log Types (Developer Console)
// ====================

export type LogCategory = 
  | 'API'
  | 'STATE'
  | 'INTENT'
  | 'CONSTRAINT'
  | 'DIFF'
  | 'ERROR'
  | 'STT'
  | 'SYSTEM'
  | 'CITY_LOCK';

export type LogLevel = 'info' | 'warning' | 'error';

export interface LogEntry {
  id: string;
  timestamp: number;
  category: LogCategory;
  level: LogLevel;
  message: string;
  data?: Record<string, unknown>;
  requestId?: string;
  latency?: number;
  duration?: number;
}

// ====================
// Itinerary Diff Types
// ====================

export type DiffType = 
  | 'added'
  | 'removed'
  | 'modified'
  | 'unchanged';

export interface BlockDiff {
  dayIndex: number;
  blockIndex: number;
  timeOfDay: string;
  diffType: DiffType;
  oldValue?: string;
  newValue?: string;
}

export interface DayDiff {
  dayIndex: number;
  dayName: string;
  blocks: BlockDiff[];
  totalChanges: number;
}

export interface ItineraryDiff {
  days: DayDiff[];
  totalChanges: number;
  summary: string;
}

// ====================
// API Request Types
// ====================

export interface ApiCallMetrics {
  endpoint: string;
  method: string;
  requestId: string;
  startTime: number;
  endTime?: number;
  status?: number;
  latency?: number;
  error?: string;
}

// ====================
// Performance Metrics
// ====================

export interface PerformanceMetrics {
  sttLatency: number;
  intentLatency: number;
  constraintLatency: number;
  apiLatency: number;
  totalLatency: number;
}

// ====================
// Component State Interfaces
// ====================

export interface VoiceAssistantState {
  conversationState: ConversationState;
  voiceStatus: VoiceStatus;
  transcript: TranscriptData | null;
  partialTranscript: string;
  intent: IntentResult | null;
  constraints: PartialConstraints;
  constraintStatus: ConstraintStatus | null;
  processingStatus: ProcessingStatus | null;
  error: VoiceError | null;
  hasItinerary: boolean;
  sessionId: string | null;
}

export interface VoiceAssistantActions {
  startListening: () => void;
  stopListening: () => void;
  setTranscript: (transcript: string, isFinal: boolean) => void;
  processTranscript: () => Promise<void>;
  confirmConstraints: () => Promise<void>;
  answerConstraint: (answer: string) => void;
  skipConstraint: () => void;
  retry: () => void;
  reset: () => void;
  clearSession: () => void;
}

// ====================
// API Response Enhancement
// ====================

export interface EnhancedApiResponse<T> {
  data: T;
  requestId: string;
  latency: number;
  timestamp: number;
}
