#!/usr/bin/env node

/**
 * Email PDF Feature - Quick Verification Script
 * Tests backend endpoint without needing frontend
 * 
 * Usage: node test-email-endpoint.js
 * 
 * Prerequisites:
 * 1. Backend running on port 3001
 * 2. n8n running on port 5678 with workflow imported
 * 3. Session with itinerary already exists (get sessionId from browser DevTools)
 */

const http = require('http');

// Configuration
const BACKEND_URL = 'http://localhost:3001';
const BACKEND_PORT = 3001;

// Test data - UPDATE WITH YOUR VALUES
const TEST_SESSION_ID = 'YOUR_SESSION_ID_HERE';  // Get from browser after creating itinerary
const TEST_EMAIL = 'your-email@gmail.com';       // Your test email

console.log('\n=== Email PDF Feature - Endpoint Test ===\n');

// Validate inputs
if (TEST_SESSION_ID === 'YOUR_SESSION_ID_HERE') {
  console.error('❌ Error: Please set TEST_SESSION_ID to your session ID');
  console.log('\nHow to get SESSION_ID:');
  console.log('1. Open frontend at http://localhost:5174');
  console.log('2. Create an itinerary: "Plan a trip to Jaipur"');
  console.log('3. Open DevTools (F12) → Network tab');
  console.log('4. Look for the /plan response → find sessionId in response body');
  console.log('5. Copy sessionId value and update TEST_SESSION_ID above\n');
  process.exit(1);
}

if (TEST_EMAIL === 'your-email@gmail.com') {
  console.error('❌ Error: Please set TEST_EMAIL to your actual email address');
  process.exit(1);
}

console.log('Configuration:');
console.log(`  Backend: ${BACKEND_URL}`);
console.log(`  Session ID: ${TEST_SESSION_ID}`);
console.log(`  Test Email: ${TEST_EMAIL}`);
console.log('');

// Make request
const payload = JSON.stringify({
  sessionId: TEST_SESSION_ID,
  toEmail: TEST_EMAIL,
});

const options = {
  hostname: 'localhost',
  port: BACKEND_PORT,
  path: '/email-itinerary',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': payload.length,
  },
};

console.log('📤 Sending request to POST /email-itinerary...\n');

const req = http.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log(`Response Status: ${res.statusCode}\n`);

    try {
      const response = JSON.parse(data);
      
      if (response.ok) {
        console.log('✅ SUCCESS! Email sent!\n');
        console.log('Details:');
        console.log(`  messageId: ${response.messageId}`);
        console.log(`  sentTo: ${response.sentTo}`);
        console.log('');
        console.log('📧 Check your email inbox (may take 1-2 minutes)');
        console.log('   Subject: "Your Trip to [City] Itinerary"');
        console.log('   Attachment: itinerary.pdf\n');
      } else {
        console.log('❌ FAILED\n');
        console.log(`Error: ${response.error}`);
        console.log('');
        console.log('Troubleshooting:');
        console.log('  • Verify SESSION_ID is correct (has itinerary)');
        console.log('  • Check TEST_EMAIL format');
        console.log('  • Verify n8n is running on port 5678');
        console.log('  • Check Gmail credentials in n8n\n');
      }
    } catch (e) {
      console.log('❌ ERROR parsing response\n');
      console.log('Raw Response:');
      console.log(data);
      console.log('');
      console.log('Troubleshooting:');
      console.log('  • Is backend running? (cd backend && npm run dev)');
      console.log('  • Check backend logs for errors\n');
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Request failed\n');
  console.error(`Error: ${error.message}`);
  console.log('');
  console.log('Troubleshooting:');
  console.log(`  • Is backend running on ${BACKEND_URL}?`);
  console.log('  • Try: cd backend && npm run dev\n');
  process.exit(1);
});

req.write(payload);
req.end();

// Timeout safety
setTimeout(() => {
  console.error('❌ Request timeout (20 seconds)');
  console.log('');
  console.log('Troubleshooting:');
  console.log('  • Is n8n running? (n8n command)');
  console.log('  • Check n8n webhook is active');
  console.log('  • Check network connectivity to n8n\n');
  process.exit(1);
}, 20000);
