const https = require('https');

const cities = ['Mumbai', 'Pune', 'Kochi', 'Delhi'];

async function testNominatim(city) {
  return new Promise((resolve) => {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(city)}&countrycodes=in&limit=1`;
    
    console.log(`\nTesting: ${city}`);
    console.log(`URL: ${url}`);
    
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const results = JSON.parse(data);
          console.log(`Status: ${res.statusCode}`);
          console.log(`Results: ${results.length} found`);
          if (results.length > 0) {
            const first = results[0];
            console.log(`  - Name: ${first.display_name}`);
            console.log(`  - Lat/Lon: ${first.lat}, ${first.lon}`);
          }
        } catch (e) {
          console.log(`Parse error: ${e.message}`);
        }
        resolve();
      });
    }).on('error', (e) => {
      console.error(`Error: ${e.message}`);
      resolve();
    });
  });
}

async function runTests() {
  for (const city of cities) {
    await testNominatim(city);
    // Add delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1500));
  }
}

runTests();
