// Quick test of regex patterns for city extraction
const testCases = [
  "Plan a trip to Pune for 3 days focusing on culture and food",
  "Plan 2-day trip in Kochi for food",
  "Trip to New Delhi for 3 days",
  "Plan a relaxed 3-day trip to Mumbai",
  "Plan a trip",
];

// Test Pattern 1: "to|in|at <city>"
const pattern1 = /\b(?:to|in|at)\s+([A-Za-z][A-Za-z\s.'-]*?)(?=\s+(?:for|next|this|focused|focusing|with|on|and|,|\.)|$)/i;

// Test Pattern 3 (simpler): just "to <city>"
const pattern3 = /\bto\s+([A-Za-z]{2,40})\b/i;

console.log('\n=== Testing Pattern 1 (complex) ===');
testCases.forEach(test => {
  const match = test.match(pattern1);
  console.log(`"${test}"`);
  console.log(`  Result: ${match ? match[1] : 'NO MATCH'}`);
});

console.log('\n=== Testing Pattern 3 (simple) ===');
testCases.forEach(test => {
  const match = test.match(pattern3);
  console.log(`"${test}"`);
  console.log(`  Result: ${match ? match[1] : 'NO MATCH'}`);
});

console.log('\n=== Debugging first test case ===');
const testStr = "Plan a trip to Pune for 3 days focusing on culture and food";
console.log(`Input: "${testStr}"`);
console.log(`Pattern1 match:`, testStr.match(pattern1));
console.log(`Pattern3 match:`, testStr.match(pattern3));

// Test the issue - lookahead might be consuming the word
console.log('\n=== Testing lookahead issue ===');
const pattern1NoLookahead = /\b(?:to|in|at)\s+([A-Za-z][A-Za-z\s.'-]*?)(?:\s+|$)/i;
console.log(`Pattern with simple lookahead:`, testStr.match(pattern1NoLookahead));
