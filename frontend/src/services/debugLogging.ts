// src/services/debugLogging.ts
// Enhanced logging utilities for constraint loop debugging

/**
 * Generate a simple hash of transcript for deduplication detection
 */
export function hashTranscript(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16);
}

/**
 * Structured log helper: State transition
 */
export function logStateTransition(
  logger: (category: string, level: string, message: string, data?: Record<string, any>) => void,
  from: string,
  to: string
) {
  logger('STATE', 'info', `STATE_TRANSITION ${from} -> ${to}`, {
    from,
    to,
  });
}

/**
 * Structured log helper: Constraint state snapshot
 */
export function logConstraintState(
  logger: (category: string, level: string, message: string, data?: Record<string, any>) => void,
  extracted: Record<string, any>,
  draft: Record<string, any>,
  merged: Record<string, any>,
  missing: string[]
) {
  logger('CONSTRAINT', 'info', 'CONSTRAINT_STATE snapshot', {
    extractedFromTranscript: extracted,
    draftConstraints: draft,
    mergedConstraints: merged,
    missingFields: missing,
  });
}

/**
 * Structured log helper: Reprocess reason
 */
export function logReprocessReason(
  logger: (category: string, level: string, message: string, data?: Record<string, any>) => void,
  reason: string,
  context?: Record<string, any>
) {
  logger('CONSTRAINT', 'warning', `REPROCESS_REASON: ${reason}`, {
    reason,
    ...context,
  });
}

/**
 * Structured log helper: Plan API calls
 */
export function logPlanApiStart(
  logger: (category: string, level: string, message: string, data?: Record<string, any>) => void,
  requestId: string,
  transcript: string,
  transcriptHash: string,
  constraints?: { city: string; numDays?: number; pace?: string; interests?: string[] }
) {
  logger('API', 'info', 'PLAN_API_CALL_START', {
    requestId,
    transcript,
    transcriptHash,
    constraints: constraints || {},
  });
}

export function logPlanApiSuccess(
  logger: (category: string, level: string, message: string, data?: Record<string, any>) => void,
  requestId: string,
  sessionId: string,
  latency: number
) {
  logger('API', 'info', 'PLAN_API_CALL_SUCCESS', {
    requestId,
    sessionId,
    latency,
  });
}

export function logPlanApiError(
  logger: (category: string, level: string, message: string, data?: Record<string, any>) => void,
  requestId: string,
  error: string,
  latency: number
) {
  logger('API', 'error', 'PLAN_API_CALL_ERROR', {
    requestId,
    error,
    latency,
  });
}

/**
 * Reprocess detection: Check if same transcript is being reprocessed
 */
export class ReprocessDetector {
  private lastTranscriptHash: string | null = null;
  private reprocessCount: number = 0;

  checkAndLog(
    logger: (category: string, level: string, message: string, data?: Record<string, any>) => void,
    currentHash: string,
    currentTranscript: string
  ): boolean {
    const isDuplicate = currentHash === this.lastTranscriptHash;
    
    if (isDuplicate) {
      this.reprocessCount++;
      logReprocessReason(logger, `DUPLICATE_TRANSCRIPT_DETECTED (occurrence #${this.reprocessCount})`, {
        transcriptHash: currentHash,
        transcript: currentTranscript,
        reprocessCount: this.reprocessCount,
      });
    } else {
      this.reprocessCount = 0;
      this.lastTranscriptHash = currentHash;
    }
    
    return isDuplicate;
  }

  reset() {
    this.lastTranscriptHash = null;
    this.reprocessCount = 0;
  }
}
