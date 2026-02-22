// src/hooks/useVoiceAssistant.ts
// REFACTORED: Single transcript orchestration - process each transcript ONLY ONCE

import { useReducer, useCallback, useRef, useEffect } from 'react';
import {
  ConversationState,
  VoiceStatus,
  IntentResult,
  PartialConstraints,
  TranscriptData,
  VoiceError,
  LogEntry,
  LogCategory,
  ExplainResponseData,
  EditResponseData,
} from '../types/voice';
import { classifyIntent, getCityLockMessage } from '../services/intentRouter';
import {
  extractConstraintsFromTranscript,
  computeConstraintState,
  getNextQuestion,
  processConstraintAnswer,
  LOCKED_CITY,
} from '../services/constraintGate';
import { computeItineraryDiff } from '../services/itineraryDiff';
import { api } from '../services/api';
import { SessionState } from '@shared/types';
import { initializeTTS, stopSpeaking, speakAssistantMessage } from '../services/textToSpeech';
import {
  hashTranscript,
  logStateTransition,
  logConstraintState,
  logPlanApiStart,
  logPlanApiSuccess,
  logPlanApiError,
} from '../services/debugLogging';

const generateId = () => crypto.randomUUID?.() || Math.random().toString(36).slice(2) + Date.now().toString(36);

interface VoiceState {
  conversationState: ConversationState;
  voiceStatus: VoiceStatus;
  transcript: TranscriptData | null;
  partialTranscript: string;
  intent: IntentResult | null;

  // ===== ORCHESTRATION STATE =====
  lastTranscriptHash: string | null; // Prevent reprocessing same transcript
  extractedConstraints: PartialConstraints; // From STT_FINAL only
  draftConstraints: PartialConstraints; // From user answers only
  mergedConstraints: PartialConstraints; // extracted + draft
  currentQuestion: ReturnType<typeof getNextQuestion> | null;
  // ================================

  // ===== RESPONSE STATE =====
  explainResponse: ExplainResponseData | null;
  editResponse: EditResponseData | null;
  assistantMessage: string | null; // For OUT_OF_SCOPE and other messages
  // ==========================

  processingMessage: string;
  error: VoiceError | null;
  sessionId: string | null;
  session: SessionState | null;
  logs: LogEntry[];
  performanceMetrics: {
    sttLatency: number;
    intentLatency: number;
    constraintLatency: number;
    apiLatency: number;
    totalLatency: number;
  };
  diff: ReturnType<typeof computeItineraryDiff> | null;
}

type VoiceAction =
  | { type: 'START_LISTENING' }
  | { type: 'STOP_LISTENING' }
  | { type: 'SET_PARTIAL_TRANSCRIPT'; payload: string }
  | { type: 'SET_TRANSCRIPT'; payload: { text: string; isFinal: boolean } }
  | { type: 'SET_INTENT'; payload: IntentResult }
  | { type: 'ADVANCE_ON_STT_FINAL'; payload: { transcript: string; transcriptHash: string; extracted: PartialConstraints; intent: IntentResult } }
  | { type: 'ADVANCE_ON_CONSTRAINT_ANSWER'; payload: { fieldValue: PartialConstraints; nextQuestion: ReturnType<typeof getNextQuestion> | null } }
  | { type: 'ADVANCE_ON_CONFIRM_CONSTRAINTS' }
  | { type: 'API_START'; payload: { endpoint: string } }
  | { type: 'API_SUCCESS'; payload: { session: SessionState } }
  | { type: 'API_ERROR'; payload: VoiceError }
  | { type: 'SET_DIFF'; payload: ReturnType<typeof computeItineraryDiff> }
  | { type: 'SET_EXPLAIN_RESPONSE'; payload: ExplainResponseData }
  | { type: 'SET_EDIT_RESPONSE'; payload: EditResponseData }
  | { type: 'SET_ASSISTANT_MESSAGE'; payload: string }
  | { type: 'CLEAR_ASSISTANT_MESSAGE' }
  | { type: 'ADD_LOG'; payload: LogEntry }
  | { type: 'CLEAR_LOGS' }
  | { type: 'RESET' }
  | { type: 'CLEAR_SESSION' }
  | { type: 'SET_STATE'; payload: ConversationState }
  | { type: 'SET_ERROR'; payload: VoiceError }
  | { type: 'UPDATE_PERFORMANCE'; payload: Partial<VoiceState['performanceMetrics']> };

const initialState: VoiceState = {
  conversationState: 'IDLE',
  voiceStatus: 'idle',
  transcript: null,
  partialTranscript: '',
  intent: null,
  lastTranscriptHash: null,
  extractedConstraints: {},
  draftConstraints: {},
  mergedConstraints: {},
  currentQuestion: null,
  explainResponse: null,
  editResponse: null,
  assistantMessage: null,
  processingMessage: '',
  error: null,
  sessionId: null,
  session: null,
  logs: [],
  performanceMetrics: {
    sttLatency: 0,
    intentLatency: 0,
    constraintLatency: 0,
    apiLatency: 0,
    totalLatency: 0,
  },
  diff: null,
};

function voiceReducer(state: VoiceState, action: VoiceAction): VoiceState {
  switch (action.type) {
    case 'START_LISTENING':
      return {
        ...state,
        conversationState: 'LISTENING',
        voiceStatus: 'listening',
        partialTranscript: '',
        transcript: null,
        intent: null,
        error: null,
      };

    case 'STOP_LISTENING':
      return {
        ...state,
        conversationState: 'TRANSCRIBING',
        voiceStatus: 'transcribing',
      };

    case 'SET_PARTIAL_TRANSCRIPT':
      return {
        ...state,
        partialTranscript: action.payload,
      };

    case 'SET_TRANSCRIPT': {
      const timestamp = Date.now();
      return {
        ...state,
        transcript: {
          raw: action.payload.text,
          cleaned: action.payload.text.trim(),
          isFinal: action.payload.isFinal,
          timestamp,
        },
        partialTranscript: '',
        conversationState: action.payload.isFinal ? 'PROCESSING' : state.conversationState,
        voiceStatus: action.payload.isFinal ? 'processing' : state.voiceStatus,
      };
    }

    case 'SET_INTENT':
      return {
        ...state,
        intent: action.payload,
      };

    case 'ADVANCE_ON_STT_FINAL': {
      const constraintState = computeConstraintState(action.payload.extracted, {});
      const nextQuestion = getNextQuestion(constraintState);

      return {
        ...state,
        lastTranscriptHash: action.payload.transcriptHash,
        extractedConstraints: action.payload.extracted,
        draftConstraints: {},
        mergedConstraints: constraintState.collected,
        currentQuestion: nextQuestion,
        intent: action.payload.intent,
        conversationState: nextQuestion ? 'CONFIRMING_CONSTRAINTS' : 'PROCESSING',
        processingMessage: nextQuestion ? `Asking: ${nextQuestion.question}` : 'All constraints ready',
      };
    }

    case 'ADVANCE_ON_CONSTRAINT_ANSWER': {
      const constraintState = computeConstraintState(state.extractedConstraints, action.payload.fieldValue);
      return {
        ...state,
        draftConstraints: action.payload.fieldValue,
        mergedConstraints: constraintState.collected,
        currentQuestion: action.payload.nextQuestion,
        conversationState: action.payload.nextQuestion ? 'CONFIRMING_CONSTRAINTS' : 'PROCESSING',
        processingMessage: action.payload.nextQuestion ? `Asking: ${action.payload.nextQuestion.question}` : 'All constraints ready',
      };
    }

    case 'ADVANCE_ON_CONFIRM_CONSTRAINTS':
      return {
        ...state,
        conversationState: 'PROCESSING',
        currentQuestion: null,
        processingMessage: 'Creating your itinerary...',
      };

    case 'API_START':
      return {
        ...state,
        processingMessage: `Calling ${action.payload.endpoint}...`,
      };

    case 'API_SUCCESS':
      return {
        ...state,
        conversationState: 'IDLE',
        voiceStatus: 'idle',
        session: action.payload.session,
        sessionId: action.payload.session.sessionId,
        processingMessage: '',
        error: null,
      };

    case 'API_ERROR':
      return {
        ...state,
        conversationState: 'ERROR',
        voiceStatus: 'error',
        error: action.payload,
        processingMessage: '',
      };

    case 'SET_DIFF':
      return {
        ...state,
        diff: action.payload,
      };

    case 'SET_EXPLAIN_RESPONSE':
      return {
        ...state,
        explainResponse: action.payload,
        assistantMessage: action.payload.answer,
        conversationState: 'IDLE',
        voiceStatus: 'idle',
      };

    case 'SET_EDIT_RESPONSE':
      return {
        ...state,
        editResponse: action.payload,
        assistantMessage: `Edit applied: ${action.payload.changedBlocks.join(', ')}`,
      };

    case 'SET_ASSISTANT_MESSAGE':
      return {
        ...state,
        assistantMessage: action.payload,
        conversationState: 'IDLE',
        voiceStatus: 'idle',
      };

    case 'CLEAR_ASSISTANT_MESSAGE':
      return {
        ...state,
        assistantMessage: null,
      };

    case 'ADD_LOG':
      return {
        ...state,
        logs: [...state.logs.slice(-499), action.payload],
      };

    case 'CLEAR_LOGS':
      return {
        ...state,
        logs: [],
      };

    case 'RESET':
      return {
        ...initialState,
        sessionId: state.sessionId,
        session: state.session,
        logs: state.logs,
      };

    case 'CLEAR_SESSION':
      return {
        ...initialState,
        logs: [],
      };

    case 'SET_STATE':
      return {
        ...state,
        conversationState: action.payload,
        voiceStatus: action.payload === 'ERROR' ? 'error' : action.payload === 'IDLE' ? 'idle' : state.voiceStatus,
      };

    case 'SET_ERROR':
      return {
        ...state,
        conversationState: 'ERROR',
        voiceStatus: 'error',
        error: action.payload,
      };

    case 'UPDATE_PERFORMANCE':
      return {
        ...state,
        performanceMetrics: { ...state.performanceMetrics, ...action.payload },
      };

    default:
      return state;
  }
}

export function useVoiceAssistant() {
  const [state, dispatch] = useReducer(voiceReducer, initialState);
  const recognitionRef = useRef<any>(null);
  const startTimeRef = useRef<number>(0);

  const addLog = useCallback((
    category: LogCategory,
    level: 'info' | 'warning' | 'error',
    message: string,
    data?: Record<string, unknown>
  ) => {
    const entry: LogEntry = {
      id: generateId(),
      timestamp: Date.now(),
      category,
      level,
      message,
      data,
    };
    dispatch({ type: 'ADD_LOG', payload: entry });
  }, []);

  // Initialize TTS service on mount
  useEffect(() => {
    initializeTTS((category: string, level: string, message: string, data?: Record<string, any>) => {
      addLog(category as LogCategory, level as 'info' | 'warning' | 'error', message, data);
    });
  }, [addLog]);

  // Initialize city lock logging on mount
  useEffect(() => {
    addLog('CITY_LOCK', 'info', 'CITY_LOCK_APPLIED', { city: LOCKED_CITY });
  }, [addLog]);

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      addLog('STT', 'error', 'Speech Recognition not supported');
      return;
    }

    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.continuous = false;
    recognitionRef.current.interimResults = true;
    recognitionRef.current.lang = 'en-US';

    recognitionRef.current.onstart = () => {
      addLog('STT', 'info', 'STT_STARTED', {});
      dispatch({ type: 'START_LISTENING' });
    };

    recognitionRef.current.onresult = (event: any) => {
      let interimTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcriptSegment = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          const text = transcriptSegment.trim();
          if (text) {
            const sttLatency = Date.now() - startTimeRef.current;
            addLog('STT', 'info', 'STT_FINAL', { text, sttLatency });
            dispatch({ type: 'SET_TRANSCRIPT', payload: { text, isFinal: true } });
            dispatch({ type: 'UPDATE_PERFORMANCE', payload: { sttLatency } });
            if (recognitionRef.current) {
              recognitionRef.current.stop();
            }
          }
        } else {
          interimTranscript += transcriptSegment;
          dispatch({ type: 'SET_PARTIAL_TRANSCRIPT', payload: interimTranscript });
        }
      }
    };

    recognitionRef.current.onerror = (event: any) => {
      addLog('STT', 'error', `Speech recognition error: ${event.error}`);
      dispatch({ type: 'SET_ERROR', payload: { code: event.error, message: event.error, recoverable: true, retryAction: 'retry' } });
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };

    recognitionRef.current.onend = () => {
      addLog('STT', 'info', 'STT_STOPPED', {});
    };

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, [addLog]);

  // Stop mic when processing starts
  useEffect(() => {
    if (state.conversationState === 'PROCESSING' && recognitionRef.current) {
      stopSpeaking();
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      addLog('STT', 'info', 'Mic disabled for processing', {});
    }
  }, [state.conversationState, addLog]);

  // Log state transitions
  const lastStateRef = useRef<ConversationState>('IDLE');
  useEffect(() => {
    if (state.conversationState !== lastStateRef.current) {
      const fromState = lastStateRef.current;
      const toState = state.conversationState;
      logStateTransition((cat, level, msg, data) => addLog(cat as LogCategory, level as any, msg, data), fromState, toState);
      lastStateRef.current = toState;
    }
  }, [state.conversationState, addLog]);

  // ORCHESTRATION: On STT_FINAL with PROCESSING state, call advanceConversation
  useEffect(() => {
    if (state.transcript?.isFinal && state.conversationState === 'PROCESSING') {
      advanceConversationOnTranscript();
    }
  }, [state.transcript?.isFinal, state.conversationState]);

  const advanceConversationOnTranscript = async () => {
    const text = state.transcript!.cleaned;
    const transcriptHash = hashTranscript(text);

    // GUARD: Never reprocess the same transcript
    if (state.lastTranscriptHash === transcriptHash) {
      addLog('INTENT', 'warning', 'Duplicate transcript hash detected, skipping reprocess', { transcriptHash });
      return;
    }

    const constraintStart = Date.now();
    addLog('INTENT', 'info', `Processing transcript: "${text}"`, { transcriptHash });

    const hasItinerary = (state.session?.itinerary?.days?.length ?? 0) > 0;
    const intentStart = Date.now();
    const intent = classifyIntent(text, hasItinerary);
    const intentLatency = Date.now() - intentStart;

    addLog('INTENT', 'info', `Intent detected: ${intent.intent}`, { confidence: intent.confidence, reasoning: intent.reasoning });
    dispatch({ type: 'UPDATE_PERFORMANCE', payload: { intentLatency } });

    // Handle OUT_OF_SCOPE - respond with helpful message
    if (intent.intent === 'OUT_OF_SCOPE') {
      addLog('INTENT', 'warning', 'Out-of-scope request detected');
      const message = 'I can help only with Jaipur trip planning, edits, and explanations. Try saying "Plan a 3-day trip" or "Make Day 2 more relaxed".';
      dispatch({ type: 'SET_ASSISTANT_MESSAGE', payload: message });
      speakAssistantMessage(message);
      return;
    }

    // Handle OUT_OF_CITY - respond with city lock message
    if (intent.intent === 'OUT_OF_CITY') {
      addLog('CITY_LOCK', 'warning', 'OUT_OF_CITY_TRIGGERED', { detectedCity: intent.detectedCity });
      const message = getCityLockMessage(intent.detectedCity || 'that city');
      dispatch({ type: 'SET_ASSISTANT_MESSAGE', payload: message });
      speakAssistantMessage(message);
      return;
    }

    // Handle EXPLAIN_ITINERARY - call /explain endpoint
    if (intent.intent === 'EXPLAIN_ITINERARY') {
      addLog('INTENT', 'info', 'Processing EXPLAIN request');
      
      if (!state.sessionId || !hasItinerary) {
        const message = 'Please create an itinerary first, then I can explain it. Try "Plan a 3-day trip".';
        dispatch({ type: 'SET_ASSISTANT_MESSAGE', payload: message });
        speakAssistantMessage(message);
        return;
      }
      
      dispatch({ type: 'API_START', payload: { endpoint: 'EXPLAIN' } });
      
      try {
        const explainResponse = await api.explain(state.sessionId, text, state.session?.itinerary);
        addLog('API', 'info', 'EXPLAIN_API_CALL_SUCCESS', { answer: explainResponse.answer.slice(0, 100) });
        
        dispatch({
          type: 'SET_EXPLAIN_RESPONSE',
          payload: {
            answer: explainResponse.answer,
            citations: explainResponse.citations,
            question: text,
            timestamp: Date.now(),
          },
        });
        
        speakAssistantMessage(explainResponse.answer);
      } catch (error: any) {
        const errorMessage = error?.response?.data?.error?.message || error?.message || 'Failed to explain';
        addLog('API', 'error', `EXPLAIN_API_CALL_ERROR: ${errorMessage}`);
        dispatch({ type: 'SET_ASSISTANT_MESSAGE', payload: errorMessage });
      }
      return;
    }

    // Handle EDIT_ITINERARY - call /edit endpoint
    if (intent.intent === 'EDIT_ITINERARY') {
      addLog('INTENT', 'info', 'Processing EDIT request');
      
      if (!state.sessionId || !hasItinerary) {
        const message = 'Please create an itinerary first before editing. Try "Plan a 3-day trip".';
        dispatch({ type: 'SET_ASSISTANT_MESSAGE', payload: message });
        speakAssistantMessage(message);
        return;
      }
      
      dispatch({ type: 'API_START', payload: { endpoint: 'EDIT' } });
      
      try {
        const editResponse = await api.edit(state.sessionId, text);
        
        // Log full response for debugging
        addLog('API', 'info', 'EDIT_API_CALL_SUCCESS', { 
          hasSession: !!editResponse.session,
          hasEditApplied: !!editResponse.editApplied,
          changedBlocks: editResponse.editApplied?.changedBlocks || [],
          changedDays: editResponse.editApplied?.changedDays || [],
          command: editResponse.editApplied?.command?.action || 'none',
        });
        
        // Update session with edited itinerary
        dispatch({ type: 'API_SUCCESS', payload: { session: editResponse.session } });
        
        // Compute diff for highlighting
        const diff = computeItineraryDiff(state.session?.itinerary || null, editResponse.session.itinerary);
        dispatch({ type: 'SET_DIFF', payload: diff });
        
        // Set edit response for UI
        const editApplied = editResponse.editApplied;
        if (editApplied && editApplied.changedBlocks.length > 0) {
          dispatch({
            type: 'SET_EDIT_RESPONSE',
            payload: {
              changedDays: editApplied.changedDays,
              changedBlocks: editApplied.changedBlocks,
              command: editApplied.command,
            },
          });
          
          const successMessage = `Done! I've updated ${editApplied.changedBlocks.join(' and ')}.`;
          speakAssistantMessage(successMessage);
        } else {
          // Edit applied but no blocks changed - notify user
          addLog('API', 'warning', 'Edit completed but no blocks changed', { editApplied });
          const message = 'Edit processed, but no changes were needed.';
          dispatch({ type: 'SET_ASSISTANT_MESSAGE', payload: message });
          speakAssistantMessage(message);
        }
      } catch (error: any) {
        const errorMessage = error?.response?.data?.error?.message || error?.message || 'Failed to apply edit';
        addLog('API', 'error', `EDIT_API_CALL_ERROR: ${errorMessage}`);
        dispatch({ type: 'API_ERROR', payload: { code: 'EDIT_ERROR', message: errorMessage, recoverable: true, retryAction: 'retry' } });
      }
      return;
    }

    // PLAN_TRIP flow - extract constraints and proceed
    // Extract constraints from transcript ONCE
    const extracted = extractConstraintsFromTranscript(text);

    logConstraintState(
      (cat, level, msg, data) => addLog(cat as LogCategory, level as any, msg, data),
      extracted,
      {},
      extracted,
      []
    );

    addLog('CONSTRAINT', 'info', 'Constraint extraction complete', { extracted });
    dispatch({ type: 'UPDATE_PERFORMANCE', payload: { constraintLatency: Date.now() - constraintStart } });

    // ORCHESTRATE: Emit STT_FINAL event with extracted constraints
    dispatch({
      type: 'ADVANCE_ON_STT_FINAL',
      payload: {
        transcript: text,
        transcriptHash,
        extracted,
        intent,
      }
    });
  };

  // ====================
  // USER ACTIONS (ONLY for advancing conversation, not reprocessing)
  // ====================

  const startListening = useCallback(() => {
    startTimeRef.current = Date.now();
    if (recognitionRef.current) {
      recognitionRef.current.start();
    }
  }, []);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  }, []);

  const answerConstraint = useCallback((answer: string) => {
    addLog('CONSTRAINT', 'info', `User answering constraint: ${answer}`);

    if (!state.currentQuestion) {
      return;
    }

    // Update draft constraints with user's answer
    const newDraft = processConstraintAnswer(
      state.extractedConstraints,
      state.draftConstraints,
      state.currentQuestion,
      answer
    );

    // Compute merged + next question
    const constraintState = computeConstraintState(state.extractedConstraints, newDraft);
    const nextQuestion = getNextQuestion(constraintState);

    logConstraintState(
      (cat, level, msg, data) => addLog(cat as LogCategory, level as any, msg, data),
      state.extractedConstraints,
      newDraft,
      constraintState.collected,
      constraintState.missing
    );

    // ORCHESTRATE: Emit CONSTRAINT_ANSWER event (NO transcript reprocessing)
    dispatch({
      type: 'ADVANCE_ON_CONSTRAINT_ANSWER',
      payload: {
        fieldValue: newDraft,
        nextQuestion,
      }
    });
  }, [state.extractedConstraints, state.draftConstraints, state.currentQuestion, addLog]);

  const skipConstraint = useCallback(() => {
    addLog('CONSTRAINT', 'info', 'User skipping constraint question');

    if (!state.currentQuestion) {
      return;
    }

    // Skip just marks as answered (similar to answer, but no value)
    const constraintState = computeConstraintState(state.extractedConstraints, state.draftConstraints);
    const nextQuestion = getNextQuestion(constraintState);

    logConstraintState(
      (cat, level, msg, data) => addLog(cat as LogCategory, level as any, msg, data),
      state.extractedConstraints,
      state.draftConstraints,
      constraintState.collected,
      constraintState.missing
    );

    dispatch({
      type: 'ADVANCE_ON_CONSTRAINT_ANSWER',
      payload: {
        fieldValue: state.draftConstraints,
        nextQuestion,
      }
    });
  }, [state.extractedConstraints, state.draftConstraints, state.currentQuestion, addLog]);

  const confirmConstraints = useCallback(async () => {
    addLog('CONSTRAINT', 'info', 'User confirming constraints');

    if (!state.intent) {
      addLog('CONSTRAINT', 'error', 'No intent found, cannot confirm');
      return;
    }

    dispatch({ type: 'ADVANCE_ON_CONFIRM_CONSTRAINTS' });

    // ORCHESTRATE: Call API with merged constraints (NO reprocessing of transcript)
    await callApiWithConstraints(state.intent.intent);
  }, [state.intent, addLog]);

  const callApiWithConstraints = async (intentType: string) => {
    const apiStart = Date.now();
    const requestId = generateId();

    if (intentType === 'PLAN_TRIP') {
      logPlanApiStart(
        (cat, level, msg, data) => addLog(cat as LogCategory, level as any, msg, data),
        requestId,
        state.transcript?.cleaned || '',
        state.lastTranscriptHash || '',
        {
          city: LOCKED_CITY,
          numDays: state.mergedConstraints.numDays,
          pace: state.mergedConstraints.pace,
          interests: state.mergedConstraints.interests,
        }
      );
    }

    addLog('API', 'info', `Starting API call: ${intentType}`, { requestId });
    dispatch({ type: 'API_START', payload: { endpoint: intentType } });

    try {
      let response;

      if (intentType === 'PLAN_TRIP') {
        response = await api.plan(state.sessionId, state.transcript?.cleaned || '');
        const apiLatency = Date.now() - apiStart;
        logPlanApiSuccess(
          (cat, level, msg, data) => addLog(cat as LogCategory, level as any, msg, data),
          requestId,
          response.session.sessionId,
          apiLatency
        );
        addLog('API', 'info', 'Plan API call successful', { requestId, sessionId: response.session.sessionId, latency: apiLatency });
      } else if (intentType === 'EDIT_ITINERARY') {
        if (!state.sessionId) {
          throw new Error('No active session. Please create a plan first.');
        }
        response = await api.edit(state.sessionId, state.transcript?.cleaned || '');
        addLog('API', 'info', 'Edit API call successful', { requestId });
      } else if (intentType === 'EXPLAIN_ITINERARY') {
        if (!state.sessionId) {
          throw new Error('No active session.');
        }
        const explainResponse = await api.explain(state.sessionId, state.transcript?.cleaned || '', state.session?.itinerary);
        addLog('API', 'info', 'Explain API call successful', { requestId, answer: explainResponse.answer });
        dispatch({ type: 'SET_STATE', payload: 'IDLE' });
        return;
      } else {
        throw new Error(`Unknown intent type: ${intentType}`);
      }

      const apiLatency = Date.now() - apiStart;
      const totalLatency = Date.now() - startTimeRef.current;

      const diff = computeItineraryDiff(state.session?.itinerary || null, response.session.itinerary);
      addLog('DIFF', 'info', diff.summary, { diff });

      dispatch({ type: 'API_SUCCESS', payload: { session: response.session } });
      dispatch({ type: 'SET_DIFF', payload: diff });
      dispatch({ type: 'UPDATE_PERFORMANCE', payload: { apiLatency, totalLatency } });

      if (response.session.sessionId) {
        localStorage.setItem('sessionId', response.session.sessionId);
      }
    } catch (error: any) {
      const errorMessage = error?.response?.data?.error?.message || error?.message || 'Unknown error';
      const apiLatency = Date.now() - apiStart;
      if (intentType === 'PLAN_TRIP') {
        logPlanApiError(
          (cat, level, msg, data) => addLog(cat as LogCategory, level as any, msg, data),
          requestId,
          errorMessage,
          apiLatency
        );
      }
      addLog('API', 'error', `API call failed: ${errorMessage}`, { requestId });
      dispatch({ type: 'API_ERROR', payload: { code: error.code || 'API_ERROR', message: errorMessage, recoverable: true, retryAction: 'retry' } });
    }
  };

  const retry = useCallback(() => {
    addLog('STATE', 'info', 'Retrying after error');
    dispatch({ type: 'RESET' });
  }, [addLog]);

  const reset = useCallback(() => {
    addLog('STATE', 'info', 'Resetting voice assistant');
    dispatch({ type: 'RESET' });
  }, [addLog]);

  const clearSession = useCallback(() => {
    addLog('STATE', 'info', 'Clearing session');
    localStorage.removeItem('sessionId');
    dispatch({ type: 'CLEAR_SESSION' });
  }, [addLog]);

  const clearLogs = useCallback(() => {
    dispatch({ type: 'CLEAR_LOGS' });
  }, []);

  const submitText = useCallback((text: string) => {
    if (text.trim()) {
      dispatch({ type: 'SET_TRANSCRIPT', payload: { text: text.trim(), isFinal: true } });
    }
  }, []);

  return {
    state,
    actions: {
      startListening,
      stopListening,
      answerConstraint,
      skipConstraint,
      confirmConstraints,
      retry,
      reset,
      clearSession,
      clearLogs,
      submitText,
    },
  };
}

export default useVoiceAssistant;
