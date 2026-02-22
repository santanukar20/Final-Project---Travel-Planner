// src/services/constraintGate.ts
// Constraint orchestration with clean separation: extracted vs draft vs merged

import { Constraints } from '@shared/types';
import { PartialConstraints, ConstraintQuestion, ConstraintStatus } from '../types/voice';

export const MIN_DAYS = 1;
export const MAX_DAYS = 6;
export const DEFAULT_DAYS = 3;

export const LOCKED_CITY = 'Jaipur';

export const REQUIRED_CONSTRAINTS: (keyof Constraints)[] = [
  'numDays',
  'pace'
];

const CONSTRAINT_QUESTIONS: ConstraintQuestion[] = [
  {
    field: 'numDays',
    question: 'How many days would you like to travel?',
    options: ['1 day', '2 days', '3 days', '4 days', '5 days', '6 days'],
    skipable: false
  },
  {
    field: 'pace',
    question: 'What pace would you prefer for your trip?',
    options: ['Relaxed (6 hours/day)', 'Normal (8 hours/day)', 'Packed (10 hours/day)'],
    skipable: false
  },
  {
    field: 'interests',
    question: 'What are you interested in?',
    options: ['History & Culture', 'Food & Dining', 'Nature & Adventure', 'Shopping', 'Beach & Relaxation'],
    skipable: true
  }
];

export function initializeConstraintStatus(): ConstraintStatus {
  return {
    collected: {},
    missing: [...REQUIRED_CONSTRAINTS],
    questions: CONSTRAINT_QUESTIONS,
    isComplete: false
  };
}

/**
 * Extract constraints from transcript - called ONCE per STT_FINAL
 */
export function extractConstraintsFromTranscript(
  transcript: string
): PartialConstraints {
  const lower = transcript.toLowerCase();
  const result: PartialConstraints = {};

  // Extract number of days - support both "3 days" and "three days"
  const daysMatch = lower.match(/(?:(\d+)|(?:one|two|three|four|five|six))\s*(?:days?|nights?)/i);
  if (daysMatch) {
    let days = 0;
    if (daysMatch[1]) {
      days = parseInt(daysMatch[1], 10);
    } else {
      const wordMap: Record<string, number> = {
        'one': 1, 'two': 2, 'three': 3,
        'four': 4, 'five': 5, 'six': 6
      };
      const matched = lower.match(/(?:one|two|three|four|five|six)\s*(?:days?|nights?)/);
      if (matched) {
        days = wordMap[matched[0].split(/\s/)[0]] || 0;
      }
    }
    if (days >= 1 && days <= 6) {
      result.numDays = days;
    }
  }

  // Extract pace - match variations
  if (lower.includes('relaxed') || lower.includes('relax') ||
      lower.includes('chill') || lower.includes('slow') || lower.includes('easy')) {
    result.pace = 'relaxed';
  } else if (lower.includes('packed') || lower.includes('busy') ||
             lower.includes('intense') || lower.includes('tight')) {
    result.pace = 'packed';
  } else if (lower.includes('normal') || lower.includes('moderate') || lower.includes('standard')) {
    result.pace = 'normal';
  }

  // Extract interests
  const interestKeywords: [string, string][] = [
    ['food', 'food'],
    ['restaurant', 'food'],
    ['eat', 'food'],
    ['temple', 'culture'],
    ['culture', 'culture'],
    ['historic', 'history'],
    ['history', 'history'],
    ['museum', 'history'],
    ['beach', 'beach'],
    ['nature', 'nature'],
    ['shopping', 'shopping'],
    ['market', 'shopping']
  ];

  const foundInterests = new Set<string>();
  for (const [keyword, interest] of interestKeywords) {
    if (lower.includes(keyword)) {
      foundInterests.add(interest);
    }
  }

  if (foundInterests.size > 0) {
    result.interests = Array.from(foundInterests);
  }

  return result;
}

/**
 * Compute merged constraints: extracted + draft, and compute missing fields
 */
export function computeConstraintState(
  extracted: PartialConstraints,
  draft: PartialConstraints
): ConstraintStatus {
  const merged = { ...extracted, ...draft };

  const missing: (keyof Constraints)[] = [];
  for (const field of REQUIRED_CONSTRAINTS) {
    if (!(field in merged) || merged[field as keyof PartialConstraints] === undefined) {
      missing.push(field);
    }
  }

  return {
    collected: merged,
    missing,
    questions: CONSTRAINT_QUESTIONS,
    isComplete: missing.length === 0
  };
}

/**
 * Get the next question to ask the user
 */
export function getNextQuestion(status: ConstraintStatus): ConstraintQuestion | null {
  for (const question of status.questions) {
    if (status.missing.includes(question.field as any) && !question.skipable) {
      return question;
    }
  }

  for (const question of status.questions) {
    if (status.missing.includes(question.field as any) && question.skipable) {
      return question;
    }
  }

  return null;
}

/**
 * Process an answer to a constraint question - updates draft constraints only
 */
export function processConstraintAnswer(
  _extracted: PartialConstraints,
  draft: PartialConstraints,
  question: ConstraintQuestion,
  answer: string
): PartialConstraints {
  const newDraft = { ...draft };
  let value: string | number | undefined;

  switch (question.field) {
    case 'numDays':
      const daysMatch = answer.match(/(\d+)/);
      if (daysMatch) {
        value = Math.min(MAX_DAYS, Math.max(MIN_DAYS, parseInt(daysMatch[1], 10)));
      }
      break;

    case 'pace':
      if (answer.toLowerCase().includes('relaxed') || answer.toLowerCase().includes('6')) {
        value = 'relaxed';
      } else if (answer.toLowerCase().includes('packed') || answer.toLowerCase().includes('10')) {
        value = 'packed';
      } else {
        value = 'normal';
      }
      break;

    case 'interests':
      if (answer.toLowerCase() === 'skip') {
        return newDraft;
      }
      value = answer;
      break;

    default:
      return newDraft;
  }

  if (value !== undefined) {
    newDraft[question.field as keyof PartialConstraints] = value as any;
  }

  return newDraft;
}

/**
 * Get full Constraints object for API call
 */
export function getFinalConstraints(
  collected: PartialConstraints,
  _transcript: string
): Constraints {
  const constraints: Constraints = {
    city: LOCKED_CITY,
    numDays: collected.numDays || DEFAULT_DAYS,
    pace: collected.pace || 'normal',
    interests: collected.interests || [],
    maxDailyHours: collected.pace === 'relaxed' ? 6 :
                   collected.pace === 'packed' ? 10 : 8
  };

  return constraints;
}

/**
 * Format constraints for display
 */
export function formatConstraintsForDisplay(
  constraints: PartialConstraints
): { label: string; value: string }[] {
  const display: { label: string; value: string }[] = [];

  if (constraints.numDays) {
    display.push({ label: 'Duration', value: `${constraints.numDays} day${constraints.numDays > 1 ? 's' : ''}` });
  }

  if (constraints.pace) {
    const paceLabels: Record<string, string> = {
      relaxed: 'Relaxed (6 hrs/day)',
      normal: 'Normal (8 hrs/day)',
      packed: 'Packed (10 hrs/day)'
    };
    display.push({ label: 'Pace', value: paceLabels[constraints.pace] || constraints.pace });
  }

  if (constraints.interests && constraints.interests.length > 0) {
    display.push({ label: 'Interests', value: constraints.interests.join(', ') });
  }

  return display;
}

/**
 * Validate that required constraints are present
 */
export function validateConstraints(
  constraints: PartialConstraints
): { valid: boolean; missing: string[] } {
  const missing: string[] = [];

  if (!constraints.numDays) {
    missing.push('numDays');
  }

  if (!constraints.pace) {
    missing.push('pace');
  }

  return {
    valid: missing.length === 0,
    missing
  };
}

/**
 * Get confirmation message
 */
export function getConfirmationMessage(constraints: PartialConstraints): string {
  const parts: string[] = [];

  parts.push(LOCKED_CITY);

  if (constraints.numDays) {
    parts.push(`${constraints.numDays} days`);
  }

  if (constraints.pace) {
    parts.push(constraints.pace);
  }

  if (parts.length === 1) {
    return 'your trip';
  }

  return parts.join(' - ');
}
