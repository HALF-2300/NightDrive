/**
 * Strict env schema + fail-start rules for production.
 * Loads .env from project root into process.env, then validates.
 * No secret defaults; production must set required vars.
 */
const fs = require('fs');
const path = require('path');

const projectRoot = path.join(__dirname, '..');
const envPath = path.join(projectRoot, '.env');

function loadEnvFile() {
  if (!fs.existsSync(envPath)) return;
  const raw = fs.readFileSync(envPath, 'utf8');
  raw.split('\n').forEach((line) => {
    const idx = line.indexOf('=');
    if (idx > 0) {
      const key = line.slice(0, idx).trim();
      const value = line.slice(idx + 1).trim();
      if (key && !process.env[key]) process.env[key] = value;
    }
  });
}

function requireEnv(name) {
  const v = process.env[name];
  if (v === undefined || v === null || String(v).trim() === '') {
    throw new Error(`${name} required`);
  }
  return String(v).trim();
}

loadEnvFile();

const isProd = process.env.NODE_ENV === 'production';

if (isProd) {
  requireEnv('ADMIN_TOKEN');
  requireEnv('MARKETCHECK_API_KEY');
  const origins = (process.env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (origins.length === 0) throw new Error('ALLOWED_ORIGINS required in production (comma-separated list)');
}

const allowedOriginsRaw = (process.env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
const ALLOWED_ORIGINS_SET = new Set(allowedOriginsRaw);

module.exports = {
  get isProd() {
    return isProd;
  },
  get NODE_ENV() {
    return process.env.NODE_ENV || 'development';
  },
  get PORT() {
    /* Render and similar hosts inject PORT (e.g. 10000); never override it in the dashboard. */
    return parseInt(process.env.PORT || '1335', 10);
  },
  get MARKETCHECK_API_KEY() {
    return (process.env.MARKETCHECK_API_KEY || '').trim();
  },
  get AUTO_DEV_API_KEY() {
    return (process.env.AUTO_DEV_API_KEY || '').trim();
  },
  get ADMIN_TOKEN() {
    return isProd ? (process.env.ADMIN_TOKEN || '').trim() : (process.env.ADMIN_TOKEN || null);
  },
  get ALLOWED_ORIGINS() {
    return ALLOWED_ORIGINS_SET;
  },
  get TRUST_PROXY() {
    return process.env.TRUST_PROXY === '1';
  },
  get EBAY_ENVIRONMENT() {
    return (process.env.EBAY_ENVIRONMENT || 'sandbox').toLowerCase();
  },
  get EBAY_CLIENT_ID() {
    return (process.env.EBAY_CLIENT_ID || '').trim();
  },
  get EBAY_CLIENT_SECRET() {
    return (process.env.EBAY_CLIENT_SECRET || '').trim();
  },
  get INTERNAL_CORPUS_KEY() {
    return (process.env.INTERNAL_CORPUS_KEY || '').trim();
  },
  get SSL_ENFORCED() {
    return process.env.SSL_ENFORCED === '1';
  },
  get CANONICAL_HOST() {
    return (process.env.CANONICAL_HOST || 'nightdrive.store').trim().replace(/^https?:\/\//, '').split('/')[0];
  },
  get PUBLIC_BASE_URL() {
    const base = (process.env.PUBLIC_BASE_URL || 'https://nightdrive.store').trim();
    return base.endsWith('/') ? base.slice(0, -1) : base;
  },
  get LEAD_WEBHOOK_URL() {
    return (process.env.LEAD_WEBHOOK_URL || '').trim();
  },
  get LEAD_WEBHOOK_SECRET() {
    return (process.env.LEAD_WEBHOOK_SECRET || '').trim();
  },
  get RESEND_API_KEY() {
    return (process.env.RESEND_API_KEY || '').trim();
  },
  get NOTIFICATION_FROM_EMAIL() {
    return (process.env.NOTIFICATION_FROM_EMAIL || '').trim();
  },
};
