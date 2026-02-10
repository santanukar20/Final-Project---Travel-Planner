import "dotenv/config";
import { detectIntent, extractPlanConstraints, extractEditCommand, generateExplanation } from "../src/services/llm";

async function runTests() {
  console.log("=== LLM Intent Detection Tests ===\n");

  const testCases = [
    {
      name: "PLAN: Create 3-day itinerary",
      transcript: "Can you create a 3-day itinerary for Jaipur focusing on culture and food?",
      expectedIntent: "PLAN",
    },
    {
      name: "EDIT: Make it more relaxed",
      transcript: "Make day 2 more relaxed, I want slower pace",
      expectedIntent: "EDIT",
    },
    {
      name: "EXPLAIN: Why was this chosen",
      transcript: "Why was Amber Fort included in the itinerary? How does it fit with my interests?",
      expectedIntent: "EXPLAIN",
    },
    {
      name: "PLAN: Show me suggestions",
      transcript: "Show me a Jaipur travel plan with lots of monuments",
      expectedIntent: "PLAN",
    },
    {
      name: "EDIT: Swap to indoor activities",
      transcript: "Can we swap day 1 afternoon to indoor activities because of rain?",
      expectedIntent: "EDIT",
    },
    {
      name: "EXPLAIN: Is it feasible",
      transcript: "Is it feasible to visit both Amber Fort and City Palace in one morning?",
      expectedIntent: "EXPLAIN",
    },
  ];

  for (const testCase of testCases) {
    try {
      const result = await detectIntent(testCase.transcript);
      const pass = result.intent === testCase.expectedIntent;
      const status = pass ? "✓ PASS" : "✗ FAIL";

      console.log(`${status} | ${testCase.name}`);
      console.log(
        `  Intent: ${result.intent} (expected: ${testCase.expectedIntent}), Confidence: ${result.confidence.toFixed(2)}`
      );
      console.log(`  Rationale: ${result.rationale}\n`);
    } catch (err) {
      console.log(`✗ ERROR | ${testCase.name}`);
      console.log(`  Error: ${(err as Error).message}\n`);
    }
  }

  // Test constraint extraction
  console.log("\n=== Constraint Extraction Tests ===\n");

  const constraintTests = [
    "I want a relaxed 3-day trip focused on culture",
    "Make it packed with food experiences",
    "Moderate pace, interested in monuments",
  ];

  for (const transcript of constraintTests) {
    try {
      const constraints = await extractPlanConstraints(transcript);
      console.log(`Input: "${transcript}"`);
      console.log(`  Pace: ${constraints.pace || "not specified"}`);
      console.log(`  Interests: ${(constraints.interests || []).join(", ") || "not specified"}`);
      console.log(`  Days: ${constraints.numDays || "not specified"}\n`);
    } catch (err) {
      console.log(`Input: "${transcript}"`);
      console.log(`  Error: ${(err as Error).message}\n`);
    }
  }

  // Test edit command extraction
  console.log("\n=== Edit Command Extraction Tests ===\n");

  const editTests = [
    "Make day 2 more relaxed",
    "Reduce travel time on day 1 afternoon",
    "Can we add a food place to day 3 evening?",
  ];

  for (const transcript of editTests) {
    try {
      const cmd = await extractEditCommand(transcript);
      console.log(`Input: "${transcript}"`);
      console.log(`  Action: ${cmd.action}`);
      console.log(`  Day: ${cmd.scope?.dayIndex || "any"}, Block: ${cmd.scope?.block || "any"}\n`);
    } catch (err) {
      console.log(`Input: "${transcript}"`);
      console.log(`  Error: ${(err as Error).message}\n`);
    }
  }

  console.log("✓ Tests completed!");
}

runTests().catch(console.error);
