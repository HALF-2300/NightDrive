#!/usr/bin/env node
/**
 * Test eBay environment key — loads .env and requests OAuth token (sandbox or production).
 * Run: node test-ebay-key.js
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const envPath = path.join(__dirname, '.env');
const env = {};
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const idx = line.indexOf('=');
    if (idx > 0) env[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  });
}

const EBAY_ENVIRONMENT = (env.EBAY_ENVIRONMENT || 'sandbox').toLowerCase();
const EBAY_CLIENT_ID = env.EBAY_CLIENT_ID || '';
const EBAY_CLIENT_SECRET = env.EBAY_CLIENT_SECRET || '';

const tokenHost = EBAY_ENVIRONMENT === 'production'
  ? 'api.ebay.com'
  : 'api.sandbox.ebay.com';
const tokenPath = '/identity/v1/oauth2/token';
const scope = 'https://api.ebay.com/oauth/api_scope';

function test() {
  if (!EBAY_CLIENT_ID || !EBAY_CLIENT_SECRET) {
    console.log('FAIL: Set EBAY_CLIENT_ID and EBAY_CLIENT_SECRET in .env');
    process.exit(1);
  }

  const credentials = Buffer.from(EBAY_CLIENT_ID + ':' + EBAY_CLIENT_SECRET).toString('base64');
  const body = `grant_type=client_credentials&scope=${encodeURIComponent(scope)}`;

  const options = {
    hostname: tokenHost,
    path: tokenPath,
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + credentials,
      'Content-Length': Buffer.byteLength(body),
    },
  };

  const req = https.request(options, (res) => {
    let data = '';
    res.on('data', (ch) => { data += ch; });
    res.on('end', () => {
      if (res.statusCode === 200) {
        const json = JSON.parse(data);
        console.log('OK — eBay key valid');
        console.log('  Environment:', EBAY_ENVIRONMENT);
        console.log('  Token type:', json.token_type || 'N/A');
        console.log('  Expires in:', json.expires_in ? json.expires_in + 's' : 'N/A');
        return;
      }
      const err = data ? JSON.parse(data) : {};
      console.log('FAIL:', res.statusCode, err.error_description || data);
      if (res.statusCode === 401) {
        console.log('');
        console.log('  401 = invalid_client. Check:');
        console.log('  • Copy Client ID and Secret again from developer.ebay.com → My Account → Application Keys');
        console.log('  • Use Sandbox keys with EBAY_ENVIRONMENT=sandbox');
        console.log('  • No extra spaces in .env (keys on their own line, no quotes)');
      }
      process.exit(1);
    });
  });

  req.on('error', (err) => {
    console.log('FAIL: Request error', err.message);
    process.exit(1);
  });
  req.write(body);
  req.end();
}

test();
