// src/components/AIResponsePanel.tsx
// Shows the latest assistant message with citations support
// Replaces generic "processing message" with human-readable assistant responses

import { ConversationState, ExplainResponseData } from '../types/voice';
import { Citation } from '@shared/types';

interface AIResponsePanelProps {
  conversationState: ConversationState;
  lastMessage: string;
  isSpeaking: boolean;
  processingMessage?: string;
  explainResponse?: ExplainResponseData | null;
  assistantMessage?: string | null;
}

export function AIResponsePanel({
  conversationState,
  lastMessage,
  isSpeaking,
  processingMessage,
  explainResponse,
  assistantMessage,
}: AIResponsePanelProps) {
  // Hide during CONFIRMING_CONSTRAINTS - question is shown in Voice Control bar
  if (conversationState === 'CONFIRMING_CONSTRAINTS') {
    return null;
  }
  
  // Priority: assistantMessage > explainResponse > lastMessage > processingMessage > default
  const displayMessage = assistantMessage || explainResponse?.answer || lastMessage || processingMessage || getDefaultMessage(conversationState);
  const citations = explainResponse?.citations || [];
  
  if (!displayMessage) {
    return null;
  }

  const getBgColor = () => {
    if (conversationState === 'ERROR') return 'bg-red-50 border-red-200';
    if (explainResponse || assistantMessage) return 'bg-emerald-50 border-emerald-200';
    if (conversationState === 'PROCESSING') return 'bg-purple-50 border-purple-200';
    if (conversationState === 'LISTENING') return 'bg-blue-50 border-blue-200';
    return 'bg-slate-50 border-slate-200';
  };

  const getTextColor = () => {
    if (conversationState === 'ERROR') return 'text-red-800';
    if (explainResponse || assistantMessage) return 'text-emerald-800';
    if (conversationState === 'PROCESSING') return 'text-purple-800';
    return 'text-slate-800';
  };

  return (
    <div className={`rounded-lg border p-3 ${getBgColor()}`}>
      <div className="flex items-start gap-3">
        {isSpeaking && (
          <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center">
            <div className="flex gap-1">
              <div className="h-1 w-1 animate-pulse rounded-full bg-current"></div>
              <div className="h-1 w-1 animate-pulse rounded-full bg-current delay-100"></div>
              <div className="h-1 w-1 animate-pulse rounded-full bg-current delay-200"></div>
            </div>
          </div>
        )}
        
        <div className="flex-1">
          {isSpeaking && (
            <div className={`mb-1 text-xs font-medium ${getTextColor()}`}>
              Speaking...
            </div>
          )}
          
          {/* Assistant header for explain responses */}
          {explainResponse && (
            <div className="mb-1 text-xs font-medium text-emerald-600">
              Assistant Response
            </div>
          )}
          
          <div className={`text-sm leading-relaxed ${getTextColor()}`}>
            {displayMessage}
          </div>
          
          {/* Citations section */}
          {citations.length > 0 && (
            <div className="mt-3 border-t border-emerald-200 pt-2">
              <div className="text-xs font-medium text-emerald-600 mb-1">
                Sources ({citations.length})
              </div>
              <div className="space-y-1">
                {citations.map((citation, idx) => (
                  <CitationItem key={idx} citation={citation} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CitationItem({ citation }: { citation: Citation }) {
  return (
    <div className="text-xs text-emerald-700 bg-emerald-100 rounded px-2 py-1">
      <span className="font-medium">{citation.source}</span>
      {citation.page && <span className="text-emerald-600"> • {citation.page}</span>}
      {citation.anchor && <span className="text-emerald-500"> #{citation.anchor}</span>}
      {citation.snippet && (
        <div className="mt-0.5 text-emerald-600 italic truncate">
          "{citation.snippet}"
        </div>
      )}
    </div>
  );
}

function getDefaultMessage(state: ConversationState): string {
  switch (state) {
    case 'LISTENING':
      return 'I\'m listening... Tell me about your trip.';
    case 'TRANSCRIBING':
      return 'Processing what you said...';
    case 'PROCESSING':
      return 'Analyzing your request...';
    case 'ERROR':
      return 'I didn\'t understand. Please try again.';
    case 'IDLE':
    default:
      return '';
  }
}

export default AIResponsePanel;
