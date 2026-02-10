// Quick API test
const http = require('http');

const testCases = [
  { utterance: "Plan a trip to Mumbai" },
  { utterance: "Plan a trip to Pune for 3 days" },
  { utterance: "Plan a trip" },
];

async function test() {
  for (const testCase of testCases) {
    console.log(`\n\nTesting: "${testCase.utterance}"`);
    
    const payload = JSON.stringify({
      utterance: testCase.utterance,
      sessionId: `test-${Date.now()}`
    });

    const options = {
      hostname: 'localhost',
      port: 3001,
      path: '/plan',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': payload.length,
      },
    };

    await new Promise((resolve) => {
      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          console.log(`Status: ${res.statusCode}`);
          const parsed = JSON.parse(data);
          if (parsed.error) {
            console.log(`Error: ${parsed.error.code} - ${parsed.error.message}`);
          } else {
            console.log(`Success - session has itinerary with ${parsed.session?.itinerary?.days?.length || 0} days`);
          }
          resolve();
        });
      });

      req.on('error', (e) => {
        console.error(`Error: ${e.message}`);
        resolve();
      });

      req.write(payload);
      req.end();
    });
  }
}

test();
