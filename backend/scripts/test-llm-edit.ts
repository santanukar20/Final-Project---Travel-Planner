import "dotenv/config";
import { detectIntent, extractEditCommand } from "../src/services/llm";

async function testEditExtraction() {
  console.log("=== Edit Command Extraction - Detailed Test ===\n");

  const testCases = [
    {
      transcript: "make day 2 more relaxed",
      expectedAction: "MAKE_MORE_RELAXED",
      expectedDay: 2,
    },
    {
      transcript: "reduce travel on day 1 morning",
      expectedAction: "REDUCE_TRAVEL",
      expectedDay: 1,
      expectedBlock: "morning",
    },
    {
      transcript: "swap day 3 afternoon to indoor because of rain",
      expectedAction: "SWAP_TO_INDOOR",
      expectedDay: 3,
      expectedBlock: "afternoon",
    },
    {
      transcript: "can we add a good food place to day 2 evening",
      expectedAction: "ADD_FOOD_PLACE",
      expectedDay: 2,
      expectedBlock: "evening",
    },
    {
      transcript: "set a moderate pace for the whole trip",
      expectedAction: "SET_PACE",
    },
  ];

  for (const testCase of testCases) {
    try {
      // First, verify intent
      const intentResult = await detectIntent(testCase.transcript);
      console.log(`📝 Transcript: "${testCase.transcript}"`);
      console.log(`   Intent: ${intentResult.intent} (confidence: ${intentResult.confidence.toFixed(2)})`);

      // Then extract edit command
      const editCmd = await extractEditCommand(testCase.transcript);
      console.log(`   Action: ${editCmd.action} (expected: ${testCase.expectedAction})`);
      if (testCase.expectedDay) {
        console.log(`   Day: ${editCmd.scope?.dayIndex || "any"} (expected: ${testCase.expectedDay})`);
      }
      if (testCase.expectedBlock) {
        console.log(`   Block: ${editCmd.scope?.block || "any"} (expected: ${testCase.expectedBlock})`);
      }

      const actionMatch = editCmd.action === testCase.expectedAction;
      const dayMatch = !testCase.expectedDay || editCmd.scope?.dayIndex === testCase.expectedDay;
      const blockMatch = !testCase.expectedBlock || editCmd.scope?.block === testCase.expectedBlock;

      const allMatch = actionMatch && dayMatch && blockMatch;
      console.log(`   Status: ${allMatch ? "✓ PASS" : "✗ FAIL"}\n`);
    } catch (err) {
      console.log(`   ✗ ERROR: ${(err as Error).message}\n`);
    }
  }

  console.log("✓ Edit command tests completed!");
}

testEditExtraction().catch(console.error);
