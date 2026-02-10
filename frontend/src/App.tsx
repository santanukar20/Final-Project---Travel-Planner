import { useMemo, useState, useRef, useEffect } from 'react';
import { ItineraryView } from './components/ItineraryView';
import { SourcesSection } from './components/SourcesSection';
import { EvaluationsSection } from './components/EvaluationsSection';
import LogsPanel from './components/LogsPanel';
import { ConfirmModal, IntentType } from './components/ConfirmModal';
import { api } from './services/api';
import { SessionState } from '@shared/types';

const PLAN_KEYWORDS = ['plan', 'create', 'build', 'show', 'day', 'itinerary', 'where', 'what'];
const EDIT_KEYWORDS = ['change', 'swap', 'add', 'remove', 'reduce', 'travel', 'morning', 'afternoon', 'evening'];
const EXPLAIN_KEYWORDS = ['why', 'doable', 'feasible', 'possible', 'rain', 'weather', 'how', 'explain'];

const detectIntent = (transcript: string): IntentType | 'uncertain' => {
  const lower = transcript.toLowerCase();
  let planScore = 0;
  let editScore = 0;
  let explainScore = 0;

  PLAN_KEYWORDS.forEach((kw) => {
    if (lower.includes(kw)) planScore++;
  });
  EDIT_KEYWORDS.forEach((kw) => {
    if (lower.includes(kw)) editScore++;
  });
  EXPLAIN_KEYWORDS.forEach((kw) => {
    if (lower.includes(kw)) explainScore++;
  });

  if (planScore === 0 || editScore > 0 || explainScore > 0) {
    return 'uncertain';
  }

  return 'plan';
};

type Tab = 'sources' | 'evals' | 'debug';
type StatusType = 'Ready' | 'Listening' | 'Thinking' | 'Error';

function App() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [session, setSession] = useState<SessionState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [pendingTranscript, setPendingTranscript] = useState('');
  const [editedDayNum, setEditedDayNum] = useState<number | undefined>();
  const [lastChanges, setLastChanges] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>('sources');
  const [transcript, setTranscript] = useState('');
  const [status, setStatus] = useState<StatusType>('Ready');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Load sessionId from localStorage on mount
  useState(() => {
    const saved = localStorage.getItem('sessionId');
    if (saved) {
      setSessionId(saved);
    }
  });

  // Persist sessionId to localStorage when it changes
  useState(() => {
    if (sessionId) {
      localStorage.setItem('sessionId', sessionId);
    }
  });

  // Initialize SpeechRecognition
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('Speech Recognition not supported');
      return;
    }

    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.continuous = true;
    recognitionRef.current.interimResults = true;
    recognitionRef.current.lang = 'en-US';

    recognitionRef.current.onstart = () => {
      setIsListening(true);
      setTranscript('');
    };

    recognitionRef.current.onresult = (event: any) => {
      let interimTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcriptSegment = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          setTranscript((prev) => (prev.trim() ? prev + ' ' + transcriptSegment : transcriptSegment));
        } else {
          interimTranscript += transcriptSegment;
        }
      }
    };

    recognitionRef.current.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
    };

    recognitionRef.current.onend = () => {
      setIsListening(false);
    };

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  const executeIntent = async (intent: IntentType, transcriptText: string) => {
    setStatus('Thinking');
    setIsLoading(true);
    setErrorMsg(null);
    try {
      if (intent === 'plan') {
        const response = await api.plan(sessionId, transcriptText);
        setSession(response.session);
        setSessionId(response.session.sessionId);
        setEditedDayNum(undefined);
        setLastChanges([]);
        setStatus('Ready');
      } else if (intent === 'edit') {
        if (!sessionId) {
          setErrorMsg('No active session. Please create a plan first.');
          setStatus('Ready');
          return;
        }
        const response = await api.edit(sessionId, transcriptText);
        setSession(response.session);
        setEditedDayNum(1);
        setLastChanges(['Morning', 'Afternoon', 'Evening']);
        setStatus('Ready');
      } else if (intent === 'explain') {
        if (!sessionId) {
          setErrorMsg('No active session. Please create a plan first.');
          setStatus('Ready');
          return;
        }
        const response = await api.explain(sessionId, transcriptText, session?.itinerary);
        console.log('Explanation:', response.answer);
        setStatus('Ready');
      }
    } catch (error: any) {
      console.error('API Error:', error);
      const backendMsg = error?.response?.data?.error?.message;
      setErrorMsg(backendMsg || error?.message || 'Unknown error occurred');
      setStatus('Error');
    } finally {
      setIsLoading(false);
      setTranscript('');
      setPendingTranscript('');
      setShowModal(false);
    }
  };

  const handleTranscriptSubmit = (transcriptText: string) => {
    setTranscript(transcriptText);
    setPendingTranscript(transcriptText);
    const intent = detectIntent(transcriptText);

    if (intent === 'uncertain') {
      setShowModal(true);
    } else {
      executeIntent(intent, transcriptText);
    }
  };

  const hasItinerary = session?.itinerary?.days?.length ?? 0 > 0;

  const statusChip = useMemo(() => {
    if (isListening) return 'bg-blue-100 text-blue-800';
    if (status === 'Thinking') return 'bg-yellow-100 text-yellow-800';
    if (status === 'Error') return 'bg-red-100 text-red-800';
    return 'bg-green-100 text-green-800';
  }, [isListening, status]);

  const statusText = useMemo(() => {
    if (status === 'Error') return 'Error';
    if (status === 'Thinking') return 'Thinking';
    if (isListening) return 'Listening';
    return 'Ready';
  }, [isListening, status]);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div>
            <div className="text-lg font-semibold text-slate-900">
              {session?.constraints?.city && session?.constraints?.numDays
                ? `${session.constraints.city} ${session.constraints.numDays}-Day Itinerary Planner`
                : 'Itinerary Planner'}
            </div>
            <div className="text-xs text-slate-500">
              Voice-first • grounded sources • editable by voice
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
              Session: <span className="font-medium">{sessionId ? `${sessionId.slice(0, 8)}…` : 'none'}</span>
            </span>
          </div>
        </div>
      </header>

      {/* Zone A: Voice Command Bar */}
      <section className="mx-auto max-w-7xl px-4 pt-4">
        <div className="rounded-2xl border bg-white shadow-sm">
          <div className="flex items-center gap-3 p-3">
            {/* Mic button */}
            <button
              className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-white shadow hover:bg-blue-700 active:scale-[0.98] transition"
              onClick={() => {
                if (isListening && recognitionRef.current) {
                  recognitionRef.current.stop();
                } else if (recognitionRef.current) {
                  recognitionRef.current.start();
                }
              }}
              title="Hold or click to speak"
            >
              🎙️
            </button>

            {/* Transcript / command input */}
            <div className="flex-1">
              <div className="text-xs text-slate-500">Say a command</div>
              <div className="line-clamp-2 text-sm text-slate-900">
                {transcript.trim()
                  ? transcript
                  : 'Try: "Plan a trip to any Indian city"'}
              </div>
            </div>

            {/* Status chip */}
            <div className={`rounded-full px-3 py-1 text-xs font-medium ${statusChip}`}>
              {statusText}
            </div>

            {/* Action buttons (secondary) */}
            <div className="hidden gap-2 sm:flex">
              <button
                className="rounded-xl border bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                onClick={() => {
                  if (transcript.trim()) {
                    if (recognitionRef.current && isListening) {
                      recognitionRef.current.stop();
                    }
                    handleTranscriptSubmit(transcript);
                  }
                }}
                disabled={isLoading}
              >
                Send
              </button>
              <button
                className="rounded-xl border bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                onClick={() => {
                  setTranscript('');
                  setErrorMsg(null);
                  if (recognitionRef.current && isListening) {
                    recognitionRef.current.stop();
                  }
                }}
              >
                Clear
              </button>
            </div>
          </div>

          {/* Inline error banner (no alerts) */}
          {errorMsg && (
            <div className="border-t bg-red-50 px-4 py-3 text-sm text-red-800">
              <div className="font-medium">Couldn't complete that request.</div>
              <div className="mt-1 text-red-700">
                {errorMsg}
              </div>
              <div className="mt-2 text-red-700/80">
                Try: "Plan a relaxed 3-day trip to Pune for food and culture."
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Main: Zone B + Zone C */}
      <main className="mx-auto grid max-w-7xl grid-cols-12 gap-4 px-4 py-4">
        {/* Zone B: Itinerary Canvas */}
        <section className="col-span-12 lg:col-span-8">
          <div className="rounded-2xl border bg-white shadow-sm">
            <div className="border-b px-4 py-3">
              <div className="text-sm font-semibold text-slate-900">Itinerary</div>
              <div className="text-xs text-slate-500">
                Day-wise plan with travel time and durations
              </div>
            </div>

            <div className="p-4">
              {hasItinerary ? (
                <ItineraryView
                  itinerary={session?.itinerary || null}
                  editedDayNum={editedDayNum}
                  lastChanges={lastChanges}
                />
              ) : (
                <div className="rounded-xl border border-dashed bg-slate-50 p-8 text-center">
                  <div className="text-sm font-medium text-slate-900">
                    No itinerary yet
                  </div>
                  <div className="mt-1 text-sm text-slate-600">
                    Tap 🎙️ and say: "Plan a trip to Mumbai"
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Zone C: Inspector Panel */}
        <aside className="col-span-12 lg:col-span-4">
          <div className="rounded-2xl border bg-white shadow-sm">
            <div className="border-b px-3 py-2">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-slate-900">Inspector</div>

                {/* Tabs */}
                <div className="flex rounded-xl bg-slate-100 p-1 text-xs">
                  <button
                    onClick={() => setActiveTab('sources')}
                    className={`rounded-lg px-3 py-1.5 transition ${
                      activeTab === 'sources'
                        ? 'bg-white shadow text-slate-900'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Sources
                  </button>
                  <button
                    onClick={() => setActiveTab('evals')}
                    className={`rounded-lg px-3 py-1.5 transition ${
                      activeTab === 'evals'
                        ? 'bg-white shadow text-slate-900'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Evals
                  </button>
                  <button
                    onClick={() => setActiveTab('debug')}
                    className={`rounded-lg px-3 py-1.5 transition ${
                      activeTab === 'debug'
                        ? 'bg-white shadow text-slate-900'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Debug
                  </button>
                </div>
              </div>
            </div>

            <div className="p-3">
              {activeTab === 'sources' && (
                <SourcesSection session={session} />
              )}

              {activeTab === 'evals' && (
                <EvaluationsSection session={session} />
              )}

              {activeTab === 'debug' && (
                <div className="rounded-xl border bg-slate-50 p-2">
                  <LogsPanel />
                </div>
              )}
            </div>
          </div>
        </aside>
      </main>

      {/* Intent Confirmation Modal */}
      <ConfirmModal
        isOpen={showModal}
        transcript={pendingTranscript}
        onConfirm={executeIntent}
        onCancel={() => {
          setShowModal(false);
          setPendingTranscript('');
        }}
      />
    </div>
  );
}

export default App;
