// Test edit command extraction regex

const testCases = [
  "Change day 2 itinerary",
  "Edit day 2 morning",
  "Update day 2 afternoon to visit museum",
  "Day 2 needs change",
  "on day 2 add food",
  "Change day 2",
  "day 3 morning",
];

const dayRegex = /day\s*(\d+)/i;
const blockRegex = /morning|afternoon|evening/i;

testCases.forEach(test => {
  const dayMatch = test.toLowerCase().match(dayRegex);
  const blockMatch = test.toLowerCase().match(blockRegex);
  
  console.log(`Input: "${test}"`);
  console.log(`  dayIndex: ${dayMatch ? dayMatch[1] : 'NOT FOUND'}`);
  console.log(`  block: ${blockMatch ? blockMatch[0] : 'NOT FOUND'}`);
  console.log();
});
