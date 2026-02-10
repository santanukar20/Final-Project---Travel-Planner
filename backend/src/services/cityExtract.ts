/**
 * Deterministic city extraction from travel utterances.
 * Runs BEFORE LLM extraction for fast, reliable city name capture.
 */

export function extractCityDeterministic(utterance: string): string | null {
  if (!utterance || typeof utterance !== 'string') {
    return null;
  }

  const u = utterance.trim();
  console.log('[cityExtract] Input:', u);
  // Matches: "to Pune", "in Kochi", "at Delhi"
  // Uses non-greedy match and lookahead for word boundaries
  const m1 = u.match(
    /\b(?:to|in|at)\s+([A-Za-z][A-Za-z\s.'-]*?)(?=\s+(?:for|next|this|focused|focusing|with|on|and|,|\.)|$)/i
  );
  console.log('[cityExtract] m1:', m1?.[1]);
  if (m1?.[1]) {
    return cleanup(m1[1]);
  }

  // Pattern 2: "trip <city>" or "trip to <city>"
  // Matches: "trip Pune", "trip to Delhi"
  const m2 = u.match(
    /\btrip\s+(?:to\s+)?([A-Za-z][A-Za-z\s.'-]*?)(?=\s+(?:for|next|this|focused|focusing|with|on|and|,|\.)|$)/i
  );
  console.log('[cityExtract] m2:', m2?.[1]);
  if (m2?.[1]) {
    return cleanup(m2[1]);
  }

  // Pattern 3: Fallback - single capitalized word after "to"
  // Matches: "to Pune" (if above patterns failed)
  const m3 = u.match(/\bto\s+([A-Za-z]{2,40})\b/i);
  console.log('[cityExtract] m3:', m3?.[1]);
  if (m3?.[1]) {
    return cleanup(m3[1]);
  }

  console.log('[cityExtract] No match found');
  return null;

  /**
   * Clean up extracted city name: remove quotes, normalize spaces, trim.
   */
  function cleanup(s: string): string {
    return s
      .replace(/["'`]/g, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }
}
