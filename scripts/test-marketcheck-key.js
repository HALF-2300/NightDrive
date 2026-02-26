/**
 * Test if MARKETCHECK_API_KEY is loaded and what MarketCheck API returns.
 * Run: node scripts/test-marketcheck-key.js
 */
const path = require('path');
const fs = require('fs');

// Load .env (same as server); strip BOM so first key is read correctly
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  let raw = fs.readFileSync(envPath, 'utf8');
  if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
  raw.split(/\r?\n/).forEach((line) => {
    const idx = line.indexOf('=');
    if (idx > 0) {
      let key = line.slice(0, idx).trim().replace(/^\uFEFF/, '');
      let value = line.slice(idx + 1).trim();
      if (/^["']/.test(value)) value = value.slice(1, -1);
      if (key) process.env[key] = value;
    }
  });
}

const key = (process.env.MARKETCHECK_API_KEY || '').trim();
console.log('Step 1 — Key loaded from .env:', key ? `YES (${key.length} chars)` : 'NO');
if (!key) {
  console.log('Step 2 — Skipped (no key)');
  process.exitCode = 1;
  return;
}

const url = 'https://api.marketcheck.com/v2/search/car/active?' + new URLSearchParams({
  api_key: key,
  rows: '1',
  start: '0',
  country: 'us',
  zip: '90210',
  radius: '50',
}).toString();

console.log('Step 2 — Request URL (no key in log):', 'https://api.marketcheck.com/v2/search/car/active?api_key=***&rows=1&...');

fetch(url, { headers: { Accept: 'application/json' } })
  .then((res) => {
    console.log('Step 3 — API HTTP status:', res.status, res.statusText);
    return res.json().then((body) => ({ status: res.status, body }));
  })
  .then(({ status, body }) => {
    console.log('Step 4 — API response body (relevant fields):');
    if (body.error) console.log('   error:', body.error);
    if (body.message) console.log('   message:', body.message);
    if (body.num_found != null) console.log('   num_found:', body.num_found);
    if (body.listings && body.listings.length) console.log('   listings count:', body.listings.length);
    if (status === 429) console.log('\n→ This is how we found out: status 429 + message above = quota/rate limit.');
    if (status === 200) console.log('\n→ Key works; you should see cars on the site.');
  })
  .catch((e) => {
    console.log('Step 3/4 — Request failed:', e.message);
    process.exitCode = 1;
  });
