// src/services/intentRouter.ts
// Deterministic intent classification based on keywords and context

import { IntentResult } from '../types/voice';

// Hard-coded city - Jaipur only
const LOCKED_CITY = 'Jaipur';

// List of other Indian cities to detect for OUT_OF_CITY handling
const OTHER_CITIES = [
  'goa', 'mumbai', 'delhi', 'jaipur', 'agra', 'kerala', 'bangalore', 'chennai',
  'hyderabad', 'kolkata', 'pune', 'shimla', 'manali', 'rishikesh', 'udaipur',
  'jodhpur', 'varanasi', 'amritsar', 'dharamshala', 'ooty', 'munnar'
];

// Travel-related keywords that indicate planning intent
const TRAVEL_KEYWORDS = [
  'trip', 'travel', 'visit', 'go to', 'plan', 'itinerary', 'journey',
  'tour', 'vacation', 'holiday', 'explore', 'destination', 'city'
];

// Edit verbs that indicate modification intent
const EDIT_VERBS = [
  'make', 'swap', 'add', 'remove', 'change', 'update', 'modify',
  'replace', 'switch', 'alter', 'edit', 'shift', 'move', 'reduce',
  'increase', 'shorter', 'longer', 'relaxed', 'more relaxed', 'less packed'
];

// Explain keywords that indicate question intent
const EXPLAIN_KEYWORDS = [
  'why', 'how', 'what', 'explain', 'doable', 'feasible', 'possible',
  'weather', 'temperature', 'rain', 'best time', 'recommend', 'suggest',
  'tell me about', 'describe', 'help me understand'
];

// Out-of-scope keywords that indicate non-travel topics
const OUT_OF_SCOPE_KEYWORDS = [
  'weather in', 'stock', 'sports', 'news', 'politics', 'recipe',
  'music', 'movie', 'book', 'buy', 'sell', 'price of', 'cost of',
  'bitcoin', 'crypto', 'investment', 'health', 'medical', 'diet'
];

/**
 * Extract city from transcript
 * Returns the detected city name or null if not found
 */
export function extractCity(transcript: string): string | null {
  const lower = transcript.toLowerCase();
  
  // Check for explicit "to X" or "in X" patterns
  const cityPatterns = [
    /(?:to|visit|go to|in)\s+([a-z]+)/i,
    /(?:trip to|travel to)\s+([a-z]+)/i,
    /^([a-z]+)\s+(?:trip|vacation|itinerary)/i
  ];
  
  for (const pattern of cityPatterns) {
    const match = lower.match(pattern);
    if (match && match[1]) {
      const city = match[1].toLowerCase();
      // Check if it's a known city
      if (OTHER_CITIES.includes(city)) {
        return city.charAt(0).toUpperCase() + city.slice(1);
      }
    }
  }
  
  return null;
}

/**
 * Check if the detected city is different from locked city
 */
export function isOutOfCity(transcript: string): { isOut: boolean; detectedCity?: string } {
  const detectedCity = extractCity(transcript);
  
  if (detectedCity) {
    const normalizedDetected = detectedCity.toLowerCase();
    const normalizedLocked = LOCKED_CITY.toLowerCase();
    
    if (normalizedDetected !== normalizedLocked) {
      return { isOut: true, detectedCity };
    }
  }
  
  return { isOut: false };
}

/**
 * Get the city lock guardrail message
 */
export function getCityLockMessage(_detectedCity: string): string {
  return `This assistant currently plans trips only for ${LOCKED_CITY}. You can say: "Plan a 2-day trip" or "Make Day 2 more relaxed."`;
}

/**
 * Classify the intent of a transcript
 * Priority: CITY_LOCK (OUT_OF_CITY) > EDIT > EXPLAIN > PLAN > OUT_OF_SCOPE
 */
export function classifyIntent(
  transcript: string,
  hasItinerary: boolean
): IntentResult {
  const lower = transcript.toLowerCase().trim();
  
  // FIRST: Check for city lock violation
  const cityCheck = isOutOfCity(transcript);
  if (cityCheck.isOut) {
    return {
      intent: 'OUT_OF_CITY',
      confidence: 0.95,
      reasoning: `User mentioned ${cityCheck.detectedCity}, but this assistant is locked to Jaipur`,
      detectedCity: cityCheck.detectedCity
    };
  }
  
  // Track matched keywords for debugging
  const editVerbs: string[] = [];
  const explainVerbs: string[] = [];
  const travelKeywords: string[] = [];
  
  // Check for edit verbs first (highest priority if itinerary exists)
  if (hasItinerary) {
    for (const verb of EDIT_VERBS) {
      if (lower.includes(verb)) {
        editVerbs.push(verb);
      }
    }
    
    if (editVerbs.length > 0) {
      return {
        intent: 'EDIT_ITINERARY',
        confidence: Math.min(0.9, 0.5 + editVerbs.length * 0.15),
        reasoning: `Found edit verbs: ${editVerbs.join(', ')}`,
        editVerbs
      };
    }
  }
  
  // Check for explain keywords (second priority)
  for (const keyword of EXPLAIN_KEYWORDS) {
    if (lower.includes(keyword)) {
      explainVerbs.push(keyword);
    }
  }
  
  if (explainVerbs.length > 0) {
    return {
      intent: 'EXPLAIN_ITINERARY',
      confidence: Math.min(0.9, 0.5 + explainVerbs.length * 0.15),
      reasoning: `Found explain keywords: ${explainVerbs.join(', ')}`,
      explainVerbs
    };
  }
  
  // Check for travel keywords (third priority)
  for (const keyword of TRAVEL_KEYWORDS) {
    if (lower.includes(keyword)) {
      travelKeywords.push(keyword);
    }
  }
  
  // Also check if user explicitly says "plan" or "create"
  const explicitPlan = lower.startsWith('plan ') || 
                       lower.startsWith('create ') ||
                       lower.startsWith('build ');
  
  if (travelKeywords.length > 0 || explicitPlan) {
    return {
      intent: 'PLAN_TRIP',
      confidence: Math.min(0.9, 0.5 + travelKeywords.length * 0.1),
      reasoning: travelKeywords.length > 0 
        ? `Found travel keywords: ${travelKeywords.join(', ')}`
        : 'Explicit planning command detected'
    };
  }
  
  // Check for out-of-scope keywords
  for (const keyword of OUT_OF_SCOPE_KEYWORDS) {
    if (lower.includes(keyword)) {
      return {
        intent: 'OUT_OF_SCOPE',
        confidence: 0.85,
        reasoning: `Found out-of-scope keyword: ${keyword}`
      };
    }
  }
  
  // If no itinerary exists and no clear travel intent, assume planning
  if (!hasItinerary) {
    return {
      intent: 'PLAN_TRIP',
      confidence: 0.6,
      reasoning: 'No itinerary exists, defaulting to planning intent'
    };
  }
  
  // Default to edit if itinerary exists but no clear intent
  return {
    intent: 'EDIT_ITINERARY',
    confidence: 0.5,
    reasoning: 'No clear keywords detected, defaulting to edit with existing itinerary'
  };
}

/**
 * Extract potential constraints from transcript for pre-filling
 */
export function extractImplicitConstraints(transcript: string): {
  city?: string;
  numDays?: number;
  pace?: 'relaxed' | 'normal' | 'packed';
  interests?: string[];
} {
  const lower = transcript.toLowerCase();
  const result: ReturnType<typeof extractImplicitConstraints> = {};
  
  // Extract city (common patterns)
  const cityPatterns = [
    /(?:to|visit|go to|in)\s+([a-z]+)/i,
    /(?:trip to|travel to)\s+([a-z]+)/i,
    /^([a-z]+)\s+(?:trip|vacation)/i
  ];
  
  for (const pattern of cityPatterns) {
    const match = lower.match(pattern);
    if (match && match[1]) {
      const city = match[1].charAt(0).toUpperCase() + match[1].slice(1);
      // Basic validation - city name should be 2+ chars
      if (city.length >= 2) {
        result.city = city;
        break;
      }
    }
  }
  
  // Extract number of days
  const daysMatch = lower.match(/(\d+)\s*(?:days?|nights?)/i);
  if (daysMatch) {
    const days = parseInt(daysMatch[1], 10);
    if (days >= 1 && days <= 6) {
      result.numDays = days;
    }
  }
  
  // Extract pace
  if (lower.includes('relaxed') || lower.includes('chill') || lower.includes('slow')) {
    result.pace = 'relaxed';
  } else if (lower.includes('packed') || lower.includes('busy') || lower.includes('intense')) {
    result.pace = 'packed';
  } else if (lower.includes('normal') || lower.includes('moderate')) {
    result.pace = 'normal';
  }
  
  // Extract interests
  const interestKeywords: [string, string][] = [
    ['food', 'food'],
    ['restaurant', 'food'],
    ['eat', 'food'],
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
 * Get a polite refusal message for out-of-scope requests
 */
export function getOutOfScopeMessage(): string {
  const messages = [
    "I'm a travel planner assistant. I can help you plan trips, edit your itinerary, or answer questions about your travel plans. What would you like to do?",
    "I specialize in travel planning! I can help you create itineraries, make changes, or explain your trip details. How can I help you travel?",
    "This question is outside my area of expertise. I'm designed to help with travel planning - creating trips, editing itineraries, and answering travel questions. What would you like to plan?"
  ];
  
  // Return a random message
  return messages[Math.floor(Math.random() * messages.length)];
}

/**
 * Get suggested prompts for the user
 */
export function getSuggestedPrompts(hasItinerary: boolean): string[] {
  if (hasItinerary) {
    return [
      "Plan a trip to Jaipur for 3 days",
      "Make Day 2 more relaxed",
      "Add a famous restaurant for dinner",
      "What's the weather like?",
      "Swap Day 1 morning to something indoors"
    ];
  }
  
  return [
    "Plan a trip to Mumbai for 3 days",
    "Plan a relaxed 5-day trip to Goa",
    "Plan a 2-day trip to Delhi for food and culture",
    "Plan an adventure trip to Rishikesh",
    "Plan a beach vacation to Kerala"
  ];
}
