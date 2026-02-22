// src/App.tsx
// Main application component - Two-column debug-optimized layout (65% user / 35% dev console)

import { useState } from 'react';
import { ItineraryView } from './components/ItineraryView';
import { VoiceAssistant } from './components/VoiceAssistant';
import { AIResponsePanel } from './components/AIResponsePanel';
import { InspectorPanel } from './components/InspectorPanel';
import { useVoiceAssistant } from './hooks/useVoiceAssistant';
import { isCurrentlySpeaking } from './services/textToSpeech';
import { api } from './services/api';

function App() {
  const { state, actions } = useVoiceAssistant();
  
  // Email PDF state
  const [emailInput, setEmailInput] = useState('');
  const [emailStatus, setEmailStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [emailMessage, setEmailMessage] = useState('');

  const hasItinerary = (state.session?.itinerary?.days?.length ?? 0) > 0;
  const isSpeaking = isCurrentlySpeaking();

  // Compute highlighted blocks from diff
  const highlightedBlocks = new Set<string>();
  const highlightedDays = new Set<number>();
  
  if (state.diff) {
    state.diff.days.forEach(day => {
      day.blocks.forEach(block => {
        if (block.diffType !== 'unchanged') {
          // Format: "dayIndex-blockIndex"
          highlightedBlocks.add(`${day.dayIndex}-${block.blockIndex}`);
          highlightedDays.add(day.dayIndex);
        }
      });
    });
  }

  // Handle email PDF send
  const handleSendEmail = async () => {
    if (!emailInput || !state.sessionId) return;
    
    // Basic email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput)) {
      setEmailStatus('error');
      setEmailMessage('Please enter a valid email address');
      return;
    }
    
    setEmailStatus('sending');
    setEmailMessage('Generating PDF and sending...');
    
    try {
      const result = await api.emailItinerary(state.sessionId, emailInput);
      
      if (result.ok) {
        setEmailStatus('success');
        setEmailMessage(`Sent! (${result.requestId || ''})`);
        setEmailInput('');
        // Clear success message after 5 seconds
        setTimeout(() => {
          setEmailStatus('idle');
          setEmailMessage('');
        }, 5000);
      } else {
        setEmailStatus('error');
        setEmailMessage(result.error || 'Failed to send email');
      }
    } catch (err: any) {
      setEmailStatus('error');
      setEmailMessage(err.message || 'Request failed');
    }
  };

  // Get status chip style
  const statusChip = {
    IDLE: 'bg-green-100 text-green-800',
    LISTENING: 'bg-blue-100 text-blue-800',
    TRANSCRIBING: 'bg-yellow-100 text-yellow-800',
    PROCESSING: 'bg-purple-100 text-purple-800',
    CONFIRMING_CONSTRAINTS: 'bg-amber-100 text-amber-800',
    ERROR: 'bg-red-100 text-red-800',
  };

  const statusText = {
    IDLE: 'Ready',
    LISTENING: 'Listening...',
    TRANSCRIBING: 'Processing speech...',
    PROCESSING: 'Thinking...',
    CONFIRMING_CONSTRAINTS: 'Gathering details...',
    ERROR: 'Error',
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-white">
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <div className="text-lg font-semibold text-slate-900">
              {state.session?.itinerary?.days?.length
                ? `${state.session.constraints?.numDays || 1}-Day Jaipur Itinerary`
                : 'Jaipur Voice Trip Planner'}
            </div>
            <div className="text-xs text-slate-500">
              Voice-first • Jaipur-only • grounded sources
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Session badge */}
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
              Session: <span className="font-medium">{state.sessionId ? `${state.sessionId.slice(0, 8)}…` : '—'}</span>
            </span>

            {/* State indicator */}
            <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusChip[state.conversationState]}`}>
              {statusText[state.conversationState]}
            </span>

            {/* Clear session */}
            {state.sessionId && (
              <button
                onClick={actions.clearSession}
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600 hover:bg-slate-50"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main content - Two column: 65% left (user-facing) / 35% right (debug console) */}
      <main className="flex flex-1 gap-4 overflow-hidden px-4 py-4">
        {/* LEFT (65%): Voice Assistant + AI Response + Itinerary */}
        <div className="flex flex-col gap-3" style={{ width: '65%', minWidth: 0 }}>
          {/* Voice Assistant Panel - Dynamic height based on content */}
          <div className="rounded-2xl border bg-white shadow-sm">
            <VoiceAssistant
              conversationState={state.conversationState}
              transcript={state.transcript?.cleaned || ''}
              partialTranscript={state.partialTranscript}
              intent={state.intent}
              currentQuestion={state.currentQuestion}
              processingMessage={state.processingMessage}
              error={state.error}
              onStartListening={actions.startListening}
              onStopListening={actions.stopListening}
              onAnswerConstraint={actions.answerConstraint}
              onSkipConstraint={actions.skipConstraint}
              onConfirmConstraints={actions.confirmConstraints}
              onRetry={actions.retry}
              onReset={actions.reset}
            />
          </div>

          {/* AI Response Panel - shows latest assistant message with citations */}
          <div className="rounded-2xl border bg-white shadow-sm p-3">
            <AIResponsePanel
              conversationState={state.conversationState}
              lastMessage={state.processingMessage}
              isSpeaking={isSpeaking}
              explainResponse={state.explainResponse}
              assistantMessage={state.assistantMessage}
            />
          </div>

          {/* Itinerary Canvas - ONLY scrollable section */}
          <div className="flex-1 flex flex-col rounded-2xl border bg-white shadow-sm overflow-hidden min-h-0">
            <div className="border-b px-4 py-2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-slate-900">Itinerary</div>
                  <div className="text-xs text-slate-500">
                    {hasItinerary 
                      ? `${state.session?.itinerary?.days?.length} days planned`
                      : 'Your travel plan will appear here'}
                  </div>
                </div>
                
                {/* Email PDF - only show when itinerary exists */}
                {hasItinerary && (
                  <div className="flex items-center gap-2">
                    <input
                      type="email"
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      placeholder="email@example.com"
                      className="rounded border border-slate-200 px-2 py-1 text-xs w-40 focus:outline-none focus:ring-1 focus:ring-blue-400"
                      disabled={emailStatus === 'sending'}
                    />
                    <button
                      onClick={handleSendEmail}
                      disabled={emailStatus === 'sending' || !emailInput}
                      className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                        emailStatus === 'sending' || !emailInput
                          ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                          : 'bg-blue-500 text-white hover:bg-blue-600'
                      }`}
                    >
                      {emailStatus === 'sending' ? 'Sending...' : 'Email PDF'}
                    </button>
                    {/* Status message */}
                    {emailMessage && (
                      <span className={`text-xs ${
                        emailStatus === 'success' ? 'text-green-600' :
                        emailStatus === 'error' ? 'text-red-600' :
                        'text-slate-500'
                      }`}>
                        {emailMessage}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-auto p-4">
              {hasItinerary ? (
                <ItineraryView
                  itinerary={state.session?.itinerary || null}
                  editedDayNum={undefined}
                  lastChanges={state.diff ? state.diff.days.flatMap(d => d.blocks.filter(b => b.diffType !== 'unchanged').map(b => b.timeOfDay)) : []}
                  highlightedBlocks={highlightedBlocks}
                  highlightedDays={highlightedDays}
                />
              ) : (
                <div className="rounded-xl border border-dashed bg-slate-50 p-8 text-center">
                  <div className="text-sm font-medium text-slate-900">
                    Ready to plan your Jaipur trip!
                  </div>
                  <div className="mt-2 text-sm text-slate-600">
                    Speak to get started. Try:
                  </div>
                  <div className="mt-3 space-y-1">
                    <div className="text-xs text-slate-500">
                      • "Plan a 2-day relaxed trip"
                    </div>
                    <div className="text-xs text-slate-500">
                      • "Make Day 2 more relaxed"
                    </div>
                    <div className="text-xs text-slate-500">
                      • "Why did you pick this place?"
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT (35%): Developer Console - Always Visible */}
        <aside style={{ width: '35%', minWidth: '35%' }} className="flex flex-col rounded-2xl border bg-white shadow-sm overflow-hidden">
          <InspectorPanel
            logs={state.logs}
            onClearLogs={actions.clearLogs}
          />
        </aside>
      </main>
    </div>
  );
}

export default App;
