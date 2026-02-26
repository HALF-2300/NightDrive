/**
 * Smoke test: assert car pitch response contains required sections.
 * 1) Runs server/pitch.buildPitch() with a mock listing (no server needed).
 * 2) If BASE_URL is set, also GET /api/smoke/pitch and asserts same shape.
 * Usage: node scripts/smoke-pitch.js
 *        BASE_URL=http://127.0.0.1:1154 node scripts/smoke-pitch.js  (optional)
 */

const path = require('path');
const PITCH_KEYS = ['topPick', 'whySpecial', 'specsSnapshot', 'dealNote', 'nextSteps'];

function assertPitchShape(body, label) {
  let failed = false;
  for (const key of PITCH_KEYS) {
    if (!(key in body) || typeof body[key] !== 'string' || body[key].trim() === '') {
      console.error(label, 'missing or empty section:', key);
      failed = true;
    }
  }
  return !failed;
}

/* Unit-style: build pitch from mock listing (no server) */
function runLocal() {
  const { buildPitch } = require(path.join(__dirname, '..', 'server', 'pitch.js'));
  const mock = {
    build: { year: 2023, make: 'Toyota', model: 'Camry', transmission: 'Auto', drivetrain: 'FWD' },
    _meta: { variant: 'best-value', dealBadge: 'great-deal', medianPrice: 30000, trustSignals: ['verified-vin'] },
    price: 27500,
    miles: 12000,
    exterior_color: 'Silver',
  };
  const pitch = buildPitch(mock);
  if (!assertPitchShape(pitch, 'Smoke pitch (local):')) {
    process.exitCode = 1;
    return false;
  }
  console.log('Smoke pitch (local): OK — all pitch sections present');
  return true;
}

async function runRemote() {
  const base = process.env.BASE_URL;
  if (!base) return true;
  const url = base.replace(/\/$/, '') + '/api/smoke/pitch';
  let res, body;
  try {
    res = await fetch(url);
    body = await res.json();
  } catch (e) {
    console.warn('Smoke pitch (API): fetch failed', e.message);
    return true;
  }
  if (res.status !== 200) {
    console.error('Smoke pitch (API): expected 200, got', res.status, body);
    process.exitCode = 1;
    return false;
  }
  if (body.error === 'no_listings') {
    console.warn('Smoke pitch (API): no listings (pitch null).');
    return true;
  }
  if (!assertPitchShape(body, 'Smoke pitch (API):')) {
    process.exitCode = 1;
    return false;
  }
  console.log('Smoke pitch (API): OK — all pitch sections present');
  return true;
}

(async () => {
  if (!runLocal()) return;
  await runRemote();
})();
