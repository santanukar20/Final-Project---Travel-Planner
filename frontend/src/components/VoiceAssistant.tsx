// src/components/VoiceAssistant.tsx
// VOICE-ONLY component - Compact horizontal layout with no nested scroll

import { useState, useEffect } from 'react';
import { ConversationState, ConstraintQuestion, IntentResult } from '../types/voice';
import { LOCKED_CITY } from '../services/constraintGate';
import { isCurrentlySpeaking } from '../services/textToSpeech';

interface VoiceAssistantProps {
  conversationState: ConversationState;
  transcript: string;
  partialTranscript: string;
  intent: IntentResult | null;
  currentQuestion: ConstraintQuestion | null;
  processingMessage: string;
  error: { message: string; recoverable: boolean; retryAction?: string } | null;
  onStartListening: () => void;
  onStopListening: () => void;
  onAnswerConstraint: (answer: string) => void;
  onSkipConstraint: () => void;
  onConfirmConstraints: () => void;
  onRetry: () => void;
  onReset: () => void;
}

const STATE_STYLES = {
  IDLE: { bg: 'bg-slate-100', text: 'text-slate-600', label: 'Ready' },
  LISTENING: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Listening...' },
  TRANSCRIBING: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Processing speech...' },
  PROCESSING: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Thinking...' },
  CONFIRMING_CONSTRAINTS: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Gathering details...' },
  ERROR: { bg: 'bg-red-100', text: 'text-red-700', label: 'Error' },
};

export function VoiceAssistant({
  conversationState,
  transcript,
  partialTranscript,
  intent,
  currentQuestion,
  processingMessage,
  error,
  onStartListening,
  onStopListening,
  onAnswerConstraint,
  onSkipConstraint,
  onConfirmConstraints,
  onRetry,
  onReset,
}: VoiceAssistantProps) {
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  
  useEffect(() => {
    const checkSpeaking = setInterval(() => {
      setIsSpeaking(isCurrentlySpeaking());
    }, 100);
    return () => clearInterval(checkSpeaking);
  }, []);
  
  const state = STATE_STYLES[conversationState] || STATE_STYLES.IDLE;
  const isListening = conversationState === 'LISTENING';

  return (
    <div className="flex flex-col">
      {/* Header with status and TTS toggle */}
      <div className="flex items-center justify-between border-b px-4 py-2 bg-white">
        <div className="flex items-center gap-3">
          <div className="text-sm font-semibold text-slate-900">Voice Control</div>
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${state.bg} ${state.text}`}>
            {state.label}
          </span>
        </div>
        <button
          onClick={() => setTtsEnabled(!ttsEnabled)}
          title={ttsEnabled ? 'Disable voice replies' : 'Enable voice replies'}
          className={`rounded-full px-2 py-1 text-xs font-medium transition ${
            ttsEnabled
              ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          {ttsEnabled ? '🔊 On' : '🔇 Off'}
        </button>
      </div>

      {/* Compact horizontal bar: Mic button + Content panel (dynamic height) */}
      <div className="flex gap-3 p-3 bg-white min-h-[100px]">
        {/* Mic button - left side */}
        <div className="flex flex-col items-center justify-start pt-1">
          <button
            onClick={isListening ? onStopListening : onStartListening}
            disabled={isSpeaking}
            type="button"
            className={`flex h-16 w-16 items-center justify-center rounded-full transition flex-shrink-0 ${
              isSpeaking
                ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                : isListening
                ? 'bg-red-500 text-white animate-pulse shadow-lg hover:bg-red-600'
                : 'bg-blue-600 text-white hover:bg-blue-700 shadow'
            }`}
            title={
              isSpeaking
                ? 'Listening disabled (speaking now)'
                : isListening
                ? 'Stop listening'
                : 'Start listening'
            }
          >
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          </button>
          <div className="mt-1 text-xs text-slate-500 text-center">
            {isListening ? 'Stop' : 'Tap'}
          </div>
        </div>

        {/* Content panel - right side (dynamic height, wraps naturally) */}
        <div className="flex-1 flex flex-col gap-2 min-w-0">
          {/* Error state */}
          {conversationState === 'ERROR' && error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-2">
              <div className="text-xs font-medium text-red-800">Error</div>
              <div className="mt-0.5 text-xs text-red-600">{error.message}</div>
              {error.recoverable && (
                <div className="mt-1 flex gap-1">
                  {error.retryAction === 'retry' && (
                    <button
                      onClick={onRetry}
                      className="rounded bg-red-600 px-2 py-0.5 text-xs text-white hover:bg-red-700"
                    >
                      Retry
                    </button>
                  )}
                  <button
                    onClick={onReset}
                    className="rounded border border-red-300 px-2 py-0.5 text-xs text-red-700 hover:bg-red-100"
                  >
                    Reset
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Processing message */}
          {(conversationState === 'PROCESSING' || conversationState === 'TRANSCRIBING') && (
            <div className="rounded-lg border border-purple-200 bg-purple-50 p-2">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 animate-spin rounded-full border border-purple-600 border-t-transparent" />
                <span className="text-xs text-purple-700">{processingMessage || 'Processing...'}</span>
              </div>
            </div>
          )}

          {/* TTS Speaking indicator */}
          {isSpeaking && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-2">
              <div className="flex items-center gap-2">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse"></span>
                <span className="text-xs text-blue-700">Speaking...</span>
              </div>
            </div>
          )}

          {/* Constraint question - ALWAYS VISIBLE */}
          {conversationState === 'CONFIRMING_CONSTRAINTS' && currentQuestion && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-2">
              <div className="mb-2 text-xs font-medium text-amber-800">{currentQuestion.question}</div>
              
              {currentQuestion.options ? (
                <div className="flex flex-wrap gap-1">
                  {currentQuestion.options.map((option, idx) => (
                    <button
                      key={idx}
                      onClick={() => onAnswerConstraint(option)}
                      className="rounded border border-amber-300 bg-white px-2 py-1 text-xs text-amber-800 hover:bg-amber-100"
                    >
                      {option}
                    </button>
                  ))}
                </div>
              ) : null}

              {currentQuestion.skipable && (
                <button
                  onClick={onSkipConstraint}
                  className="mt-1 text-xs text-amber-600 hover:underline"
                >
                  Skip
                </button>
              )}
            </div>
          )}

          {/* Transcript display - ALWAYS VISIBLE */}
          {(transcript || partialTranscript) && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
              <div className="mb-1 text-xs font-medium text-slate-500">
                {partialTranscript && !transcript ? 'Hearing...' : 'I heard:'}
              </div>
              <div className="text-xs text-slate-900">
                {transcript || partialTranscript}
                {partialTranscript && !transcript && <span className="animate-pulse">|</span>}
              </div>
              {transcript && (
                <div className="mt-1 flex gap-1">
                  <button
                    onClick={onConfirmConstraints}
                    className="rounded bg-blue-500 px-2 py-1 text-xs text-white hover:bg-blue-600"
                  >
                    Confirm
                  </button>
                  <button
                    onClick={onReset}
                    className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
                  >
                    Speak again
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Intent display - compact */}
          {intent && conversationState !== 'IDLE' && conversationState !== 'CONFIRMING_CONSTRAINTS' && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                  intent.intent === 'PLAN_TRIP' ? 'bg-green-100 text-green-800' :
                  intent.intent === 'EDIT_ITINERARY' ? 'bg-blue-100 text-blue-800' :
                  intent.intent === 'EXPLAIN_ITINERARY' ? 'bg-purple-100 text-purple-800' :
                  intent.intent === 'OUT_OF_CITY' ? 'bg-orange-100 text-orange-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {intent.intent.replace('_', ' ')}
                </span>
                <span className="text-xs text-slate-500">
                  {Math.round(intent.confidence * 100)}%
                </span>
              </div>
            </div>
          )}

          {/* Out-of-city message */}
          {intent?.intent === 'OUT_OF_CITY' && (
            <div className="rounded-lg border border-orange-200 bg-orange-50 p-2">
              <div className="text-xs font-medium text-orange-800">
                Locked to {LOCKED_CITY}. Try: "Plan a 2-day trip"
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default VoiceAssistant;
