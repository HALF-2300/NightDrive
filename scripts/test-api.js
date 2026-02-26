#!/usr/bin/env node
/**
 * Test API — hits main endpoints and prints pass/fail.
 * Usage: node scripts/test-api.js [baseUrl]
 * Default baseUrl: http://localhost:2022
 */

const base = process.argv[2] || 'http://localhost:2022';

async function get(path) {
  const url = base + path;
  const res = await fetch(url, { method: 'GET' });
  const ok = res.ok;
  let body = null;
  const ct = res.headers.get('content-type') || '';
  try {
    if (ct.includes('application/json')) body = await res.json();
    else body = await res.text();
  } catch (_) {}
  return { status: res.status, ok, body };
}

async function main() {
  console.log('Testing API at', base, '\n');

  const results = [];

  // 1. Readiness
  let r = await get('/api/readiness');
  const readinessOk = r.ok && r.body && r.body.checks && r.body.checks.marketcheck === true;
  results.push({ name: 'GET /api/readiness', status: r.status, ok: readinessOk });
  console.log(r.ok ? '✓' : '✗', 'GET /api/readiness', r.status, readinessOk ? '(marketcheck OK)' : '');

  // 2. Diag
  r = await get('/api/_diag');
  const diagOk = r.ok && r.body && r.body.hasKey === true;
  results.push({ name: 'GET /api/_diag', status: r.status, ok: diagOk });
  console.log(r.ok ? '✓' : '✗', 'GET /api/_diag', r.status, r.body && r.body.hasKey ? 'hasKey' : '');

  // 3. Home feed
  r = await get('/api/home-feed');
  const rails = r.body && r.body.rails;
  const editorPicks = (rails && rails.editorPicks) || [];
  const homeOk = r.ok && Array.isArray(editorPicks);
  const homeCount = editorPicks.length;
  results.push({ name: 'GET /api/home-feed', status: r.status, ok: homeOk });
  console.log(r.ok ? '✓' : '✗', 'GET /api/home-feed', r.status, homeCount > 0 ? `(${editorPicks.length} editorPicks)` : '(no rails?)');
  if (homeCount > 0 && r.body && r.body.rails) {
    const first = editorPicks[0];
    if (first) console.log('  → Sample:', first.heading || first.build?.make, first.price ? '$' + Number(first.price).toLocaleString() : '');
  }

  // 4. Inventory
  r = await get('/api/inventory?rows=6&start=0');
  const listings = (r.body && r.body.listings) || [];
  const invOk = r.ok && Array.isArray(listings);
  results.push({ name: 'GET /api/inventory', status: r.status, ok: invOk });
  console.log(r.ok ? '✓' : '✗', 'GET /api/inventory', r.status, invOk ? `(${listings.length} listings)` : '');
  if (listings.length > 0) {
    const first = listings[0];
    if (first) console.log('  → Sample:', first.heading || first.build?.make, first.price ? '$' + Number(first.price).toLocaleString() : '');
  }

  console.log('');
  const failed = results.filter(x => !x.ok);
  if (failed.length) {
    console.log('FAILED:', failed.map(x => x.name + ' ' + x.status).join(', '));
    process.exit(1);
  }
  console.log('All API checks passed.');
  console.log('');
  console.log('If the BROWSER still shows no cars:');
  console.log('  1. Open exactly: http://localhost:2022 (not file:// or another port)');
  console.log('  2. Press F12 → Console. You should see: [ND] app.js LOADED');
  console.log('  3. Press F12 → Network, reload, check "home-feed" or "inventory" → Status 200?');
  process.exit(0);
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
