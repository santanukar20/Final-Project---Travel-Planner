// src/services/textToSpeech.ts
// Browser TTS (SpeechSynthesis) service for assistant voice responses
// Prevents STT/TTS feedback loop and logs all events

let isSpeaking = false;
let onSpeakingStateChanged: ((speaking: boolean) => void) | null = null;
let addLog: ((category: string, level: string, message: string, data?: Record<string, any>) => void) | null = null;

/**
 * Initialize TTS service with logging callback
 */
export function initializeTTS(logger: (category: string, level: string, message: string, data?: Record<string, any>) => void): void {
  addLog = logger;
}

/**
 * Subscribe to TTS speaking state changes
 */
export function onTTSStateChange(callback: (speaking: boolean) => void): void {
  onSpeakingStateChanged = callback;
}

export function isCurrentlySpeaking(): boolean {
  return isSpeaking;
}

/**
 * Update internal speaking state and notify subscribers
 */
function setSpeakingState(speaking: boolean): void {
  isSpeaking = speaking;
  if (onSpeakingStateChanged) {
    onSpeakingStateChanged(speaking);
  }
}

/**
 * Speak a short assistant message using browser TTS
 * Prevents STT/TTS feedback loop by returning promise when complete
 */
export function speakAssistantMessage(text: string): Promise<void> {
  return new Promise((resolve) => {
    // Don't speak if already speaking or text is empty
    if (isSpeaking || !text.trim()) {
      resolve();
      return;
    }

    if (addLog) {
      addLog('STT', 'info', 'TTS_STARTED', { message: text.substring(0, 50) });
    }

    const utterance = new SpeechSynthesisUtterance(text);
    
    // Configure for natural speech
    utterance.rate = 1.0; // Normal speed
    utterance.pitch = 1.0; // Normal pitch
    utterance.volume = 1.0; // Full volume
    utterance.lang = 'en-US';
    
    setSpeakingState(true);
    
    utterance.onend = () => {
      setSpeakingState(false);
      if (addLog) {
        addLog('STT', 'info', 'TTS_ENDED', {});
      }
      resolve();
    };
    
    utterance.onerror = (event) => {
      console.error('TTS error:', event);
      setSpeakingState(false);
      if (addLog) {
        addLog('STT', 'error', `TTS_ERROR: ${event.error}`, {});
      }
      resolve(); // Resolve even on error to not block
    };
    
    // Speak the message
    speechSynthesis.cancel(); // Cancel any previous speech
    speechSynthesis.speak(utterance);
  });
}

/**
 * Stop current TTS playback
 */
export function stopSpeaking(): void {
  speechSynthesis.cancel();
  setSpeakingState(false);
  if (addLog) {
    addLog('STT', 'info', 'TTS_STOPPED', {});
  }
}

/**
 * Messages that should trigger TTS responses
 */
export function shouldSpeak(_intent: string | null, _category: 'constraint_question' | 'confirmation' | 'edit_response' | 'explanation' | 'out_of_city' | 'out_of_scope'): boolean {
  // Only speak certain categories
  return ['constraint_question', 'confirmation', 'edit_response', 'explanation', 'out_of_city', 'out_of_scope'].includes(_category);
}

/**
 * Get the spoken version of a message (shortened for TTS)
 */
export function getSpeakableMessage(originalMessage: string, _category: string): string {
  // Shorten messages for spoken delivery
  const shortVersions: Record<string, string> = {
    // Constraints
    'How many days would you like to travel?': 'How many days?',
    'What pace would you prefer for your trip?': 'What pace do you prefer?',
    
    // Confirmations
    'Confirm your trip details:': 'Ready to confirm?',
    'Create Itinerary': 'Creating your itinerary',
    
    // Edit responses
    'Updated Day': 'Updated day',
    
    // Out of scope
    'I\'m a travel planner assistant.': 'I help with travel planning.',
    'This assistant currently plans trips only for Jaipur.': 'I only plan trips for Jaipur.',
  };
  
  // Find matching shortened version
  for (const [original, shortened] of Object.entries(shortVersions)) {
    if (originalMessage.includes(original)) {
      return shortened;
    }
  }
  
  // If no match and message is long, truncate
  if (originalMessage.length > 100) {
    return originalMessage.substring(0, 100) + '...';
  }
  
  return originalMessage;
}
