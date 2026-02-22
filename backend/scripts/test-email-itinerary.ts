/// <reference types="node" />
/**
 * Test script for email itinerary endpoint
 * Usage: npx tsx scripts/test-email-itinerary.ts --sessionId <id> --toEmail <email>
 * 
 * Before running:
 * 1. Make sure backend is running (npm run dev)
 * 2. Create an itinerary first to get a sessionId
 * 3. Run this script with the sessionId and your email
 */

const API_BASE = 'http://localhost:3001';

async function testEmailItinerary(sessionId: string, toEmail: string) {
  console.log('=== Email Itinerary Test ===');
  console.log(`SessionId: ${sessionId}`);
  console.log(`ToEmail: ${toEmail}`);
  console.log(`API: ${API_BASE}/email-itinerary`);
  console.log('');

  try {
    const startTime = Date.now();
    
    const response = await fetch(`${API_BASE}/email-itinerary`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sessionId, toEmail }),
    });

    const latency = Date.now() - startTime;
    const data = await response.json();

    console.log(`Status: ${response.status}`);
    console.log(`Latency: ${latency}ms`);
    console.log('Response:', JSON.stringify(data, null, 2));

    if (data.ok) {
      console.log('\n✓ Email sent successfully!');
      if (data.requestId) console.log(`  RequestId: ${data.requestId}`);
      if (data.sentTo) console.log(`  SentTo: ${data.sentTo}`);
      if (data.pdfSizeBytes) console.log(`  PDF Size: ${data.pdfSizeBytes} bytes`);
      if (data.dryRun) console.log('  (DRY RUN - no email actually sent)');
    } else {
      console.log('\n✗ Email failed!');
      console.log(`  Error: ${data.error}`);
      if (data.requestId) console.log(`  RequestId: ${data.requestId}`);
    }

  } catch (error: any) {
    console.error('\n✗ Request failed!');
    console.error(`  Error: ${error.message}`);
    if (error.code === 'ECONNREFUSED') {
      console.error('  Make sure the backend server is running (npm run dev)');
    }
  }
}

// Parse CLI arguments
const args = process.argv.slice(2);
let sessionId = '';
let toEmail = '';

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--sessionId' && args[i + 1]) {
    sessionId = args[i + 1];
    i++;
  } else if (args[i] === '--toEmail' && args[i + 1]) {
    toEmail = args[i + 1];
    i++;
  }
}

if (!sessionId || !toEmail) {
  console.error('Usage: npx tsx scripts/test-email-itinerary.ts --sessionId <id> --toEmail <email>');
  console.error('');
  console.error('Example:');
  console.error('  npx tsx scripts/test-email-itinerary.ts --sessionId sess_abc123 --toEmail test@example.com');
  console.error('');
  console.error('To get a sessionId, first create an itinerary via the frontend or API');
  process.exit(1);
}

testEmailItinerary(sessionId, toEmail);
