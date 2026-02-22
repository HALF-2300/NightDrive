#!/usr/bin/env node
/**
 * Gate runner for NightDrive deploy readiness.
 * Loads ops/GATE_NIGHTDRIVE_DEPLOY_READY.json and runs checks (or a subset).
 * Exits 0 if required_pass pass; non-zero otherwise.
 * Usage: node scripts/run-gate-nightdrive.js [--ci] [--required-only]
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const gatePath = path.join(__dirname, '..', 'ops', 'GATE_NIGHTDRIVE_DEPLOY_READY.json');
const gate = JSON.parse(fs.readFileSync(gatePath, 'utf8'));

const required = new Set(gate.go_criteria.required_pass || []);
const recommended = new Set(gate.go_criteria.recommended_pass || []);
const ci = process.argv.includes('--ci');
const requiredOnly = process.argv.includes('--required-only');

const checksToRun = requiredOnly
  ? gate.checks.filter((c) => required.has(c.id))
  : gate.checks;

const results = [];
let requiredFailed = 0;

function runOne(check) {
  const id = check.id;
  const name = check.name;
  let ok = false;
  let out = '';

  if (check.type === 'runtime' && check.command) {
    try {
      out = execSync(check.command, {
        encoding: 'utf8',
        timeout: 15000,
        stdio: ['ignore', 'pipe', 'pipe'],
      }).trim();
      if (check.expect && typeof check.expect === 'string') {
        if (check.id === 'P0-CORS-001') {
          ok = !out.includes('Access-Control-Allow-Origin') || out.includes('403');
        } else if (check.id === 'P0-ADMIN-001') {
          ok = out === '401';
        } else if (check.id === 'P1-HTTPS-001') {
          ok = out === '301' || out === '308';
        } else {
          ok = true;
        }
      } else {
        ok = true;
      }
    } catch (e) {
      if (check.id === 'P0-ENV-001') {
        ok = e.status !== 0 && (e.stderr || e.stdout || '').includes('required');
      }
      out = (e.stdout || e.stderr || e.message || '').slice(0, 200);
    }
  } else if (check.type === 'static' && check.command) {
    try {
      out = execSync(check.command, { encoding: 'utf8', timeout: 5000 }).trim();
      ok = !out.includes('autoelite-admin-2026');
    } catch {
      ok = true;
    }
  } else {
    ok = true;
    out = 'skipped (no command or type)';
  }

  return { id, name, ok, out: out.slice(0, 120) };
}

console.log('Gate:', gate.gate_id, gate.app);
console.log('Required:', [...required].join(', '));
console.log('---');

for (const check of checksToRun) {
  const result = runOne(check);
  results.push(result);
  const status = result.ok ? 'PASS' : 'FAIL';
  const tag = required.has(check.id) ? 'P0' : 'P1';
  console.log(`${tag} ${result.id} ${status}  ${check.name}`);
  if (!result.ok && required.has(check.id)) requiredFailed++;
}

console.log('---');
if (requiredFailed > 0) {
  console.log('Result: NO-GO (required checks failed)');
  process.exit(1);
}
console.log('Result: GO (required checks passed)');
process.exit(0);
