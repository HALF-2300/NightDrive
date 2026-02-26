/**
 * Test AUTO_DEV_API_KEY — call api.auto.dev/listings and print result.
 * Run: node scripts/test-autodev-key.js
 */
const path = require('path');
const fs = require('fs');
const https = require('https');

const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  let raw = fs.readFileSync(envPath, 'utf8');
  if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
  raw.split(/\r?\n/).forEach((line) => {
    const idx = line.indexOf('=');
    if (idx > 0) {
      const key = line.slice(0, idx).trim().replace(/^\uFEFF/, '');
      let value = line.slice(idx + 1).trim();
      if (/^["']/.test(value)) value = value.slice(1, -1);
      if (key) process.env[key] = value;
    }
  });
}

const key = (process.env.AUTO_DEV_API_KEY || '').trim();
console.log('Step 1 — AUTO_DEV_API_KEY loaded:', key ? `YES (${key.length} chars)` : 'NO');
if (!key) {
  process.exitCode = 1;
  return;
}

const url = 'https://api.auto.dev/listings?limit=5&page=1';
console.log('Step 2 — Requesting', url);

https.get(url, {
  headers: { 'Authorization': 'Bearer ' + key, 'Accept': 'application/json' },
}, (res) => {
  let data = '';
  res.on('data', (c) => data += c);
  res.on('end', () => {
    console.log('Step 3 — Status:', res.statusCode, res.statusMessage);
    try {
      const j = JSON.parse(data);
      if (j.error) {
        console.log('Step 4 — API error:', j.error);
        if (j.status) console.log('         status:', j.status);
        process.exitCode = 1;
        return;
      }
      if (j.data && Array.isArray(j.data)) {
        console.log('Step 4 — Listings count:', j.data.length);
        if (j.data[0]) {
          const v = j.data[0].vehicle || {};
          const r = j.data[0].retailListing || {};
          console.log('         First:', v.year, v.make, v.model, '- $' + (r.price || 'N/A'));
        }
        console.log('\n→ Key works; Auto.dev can be used as temporary source.');
      } else {
        console.log('Step 4 — Response:', JSON.stringify(j).slice(0, 400));
      }
    } catch (e) {
      console.log('Step 4 — Parse error:', e.message);
      console.log('         Body:', data.slice(0, 300));
      process.exitCode = 1;
    }
  });
}).on('error', (e) => {
  console.log('Step 3 — Request error:', e.message);
  process.exitCode = 1;
});
