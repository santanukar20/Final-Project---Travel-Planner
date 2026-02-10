import { useState, useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import { pushLog } from '../debug/logStore';

interface VoiceBarProps {
  onTranscriptSubmit: (transcript: string) => void;
  isLoading?: boolean;
}

export interface VoiceBarRef {
  startListening: () => void;
  stopListening: () => void;
  clearTranscript: () => void;
  getTranscript: () => string;
  getStatus: () => 'ready' | 'listening' | 'processing';
  isListening: boolean;
}

export const VoiceBar = forwardRef<VoiceBarRef, VoiceBarProps>(({ onTranscriptSubmit, isLoading = false }, ref) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [status, setStatus] = useState<'ready' | 'listening' | 'processing'>('ready');
  const recognitionRef = useRef<any>(null);
  const silenceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      setStatus('listening');
      pushLog('SYSTEM', '🎤 Mic started');
    };

    recognitionRef.current.onresult = (event: any) => {
      let interimTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcriptSegment = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          setTranscript((prev) => prev + transcriptSegment + ' ');
        } else {
          interimTranscript += transcriptSegment;
        }
      }

      // Reset silence timeout on each result
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
      }

      // Auto-stop after 2 seconds of silence
      silenceTimeoutRef.current = setTimeout(() => {
        stopListening();
      }, 2000);
    };

    recognitionRef.current.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      pushLog('ERROR', `🎤 Speech recognition error: ${event.error}`);
      setStatus('ready');
      setIsListening(false);
    };

    recognitionRef.current.onend = () => {
      setIsListening(false);
      setStatus('ready');
      pushLog('SYSTEM', '🎤 Mic stopped');
    };

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
      }
    };
  }, []);

  useImperativeHandle(ref, () => ({
    startListening: () => {
      if (recognitionRef.current && !isListening) {
        recognitionRef.current.start();
      }
    },
    stopListening: () => {
      if (recognitionRef.current && isListening) {
        recognitionRef.current.stop();
      }
    },
    clearTranscript: () => {
      setTranscript('');
    },
    getTranscript: () => transcript,
    getStatus: () => status,
    isListening,
  }), [isListening, transcript, status]);

  const startListening = () => {
    if (recognitionRef.current && !isListening) {
      recognitionRef.current.start();
    }
  };

  const stopListening = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
    }
  };

  const handleSubmit = () => {
    if (transcript.trim()) {
      stopListening();
      setStatus('processing');
      const finalText = transcript.trim();
      pushLog('SYSTEM', `📝 Final transcript: ${finalText}`);
      onTranscriptSubmit(finalText);
      setTranscript('');
      setStatus('ready');
    }
  };

  const handleClear = () => {
    setTranscript('');
    stopListening();
  };

  const statusText = isLoading ? 'Processing...' : status === 'listening' ? 'Listening...' : 'Ready';

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-slate-50">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Voice Input</h3>
        <div className="text-sm font-medium text-slate-600">{statusText}</div>
      </div>

      <textarea
        value={transcript}
        readOnly
        placeholder="Your voice transcript will appear here..."
        className="w-full h-24 p-3 border rounded bg-white font-mono text-sm resize-none"
      />

      <div className="flex gap-2">
        <button
          onClick={isListening ? stopListening : startListening}
          disabled={isLoading}
          className={`flex-1 py-2 px-4 rounded font-medium transition ${
            isListening
              ? 'bg-red-500 hover:bg-red-600 text-white'
              : 'bg-blue-500 hover:bg-blue-600 text-white'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {isListening ? '⏹ Stop' : '🎤 Start Recording'}
        </button>
        <button
          onClick={handleSubmit}
          disabled={!transcript.trim() || isLoading}
          className="flex-1 py-2 px-4 bg-green-500 hover:bg-green-600 text-white rounded font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Send
        </button>
        <button
          onClick={handleClear}
          className="flex-1 py-2 px-4 bg-slate-400 hover:bg-slate-500 text-white rounded font-medium transition"
        >
          Clear
        </button>
      </div>
    </div>
  );
});
