const http = require('http');
const https = require('https');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { pipeline } = require('stream');

/* =========================================================
   ENV (strict schema; fail start in production if required missing)
   ========================================================= */
const config = require('./server/env');
const PORT = config.PORT;
const API_KEY = config.MARKETCHECK_API_KEY;
if (!config.isProd && !API_KEY) console.warn('[WARN] MARKETCHECK_API_KEY not set — API calls will fail');

const EBAY_ENVIRONMENT = config.EBAY_ENVIRONMENT;
const EBAY_CLIENT_ID = config.EBAY_CLIENT_ID;
const EBAY_CLIENT_SECRET = config.EBAY_CLIENT_SECRET;
if (!EBAY_CLIENT_ID && !EBAY_CLIENT_SECRET) {
  /* silent when both missing — eBay is optional */
} else if (!EBAY_CLIENT_ID || !EBAY_CLIENT_SECRET) {
  console.warn('[WARN] eBay: set both EBAY_CLIENT_ID and EBAY_CLIENT_SECRET for API access');
}
const INTERNAL_CORPUS_KEY = config.INTERNAL_CORPUS_KEY;
const AUTO_DEV_API_KEY = config.AUTO_DEV_API_KEY;

const { handleCors } = require('./server/middleware/cors');
const { checkAdmin: adminAuth } = require('./server/middleware/admin-auth');
const { redirectIfNeeded } = require('./server/middleware/https-redirect');

/* =========================================================
   STRUCTURED LOGGER
   ========================================================= */
const LOG_DIR = path.join(__dirname, 'logs');
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

const logStream = fs.createWriteStream(path.join(LOG_DIR, 'server.log'), { flags: 'a' });
const errStream = fs.createWriteStream(path.join(LOG_DIR, 'error.log'), { flags: 'a' });

function log(level, msg, meta) {
  const entry = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    msg,
    ...meta,
  });
  if (level === 'error') {
    errStream.write(entry + '\n');
    console.error(`[ERROR] ${msg}`, meta || '');
  } else {
    logStream.write(entry + '\n');
    if (level === 'warn') console.warn(`[WARN] ${msg}`);
  }
}

/* =========================================================
   SECURITY HEADERS
   ========================================================= */
function applySecurityHeaders(res) {
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(self),camera=(),microphone=()');
  res.setHeader('Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com; font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com data:; img-src 'self' https: data:; connect-src 'self' https://nominatim.openstreetmap.org; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
  );
  if (config.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
}

/* =========================================================
   RATE LIMITER (sliding window per IP)
   ========================================================= */
const rateBuckets = {};
const RATE_LIMITS = {
  api:        { windowMs: 60000, max: 60 },
  contact:    { windowMs: 3600000, max: 10 },
  newsletter: { windowMs: 3600000, max: 5 },
  account:    { windowMs: 3600000, max: 5 },
  admin:      { windowMs: 60000, max: 30 },
};

function getClientIP(req) {
  const cf = req.headers['cf-connecting-ip'];
  if (cf && String(cf).trim()) return String(cf).trim();
  if (config.TRUST_PROXY) {
    const xff = req.headers['x-forwarded-for'];
    if (xff) return String(xff).split(',')[0].trim();
  }
  return req.socket?.remoteAddress || 'unknown';
}

function rateLimit(req, bucket) {
  const cfg = RATE_LIMITS[bucket] || RATE_LIMITS.api;
  const ip = getClientIP(req);
  const key = `${bucket}:${ip}`;
  const now = Date.now();

  if (!rateBuckets[key]) rateBuckets[key] = [];
  rateBuckets[key] = rateBuckets[key].filter(ts => now - ts < cfg.windowMs);

  if (rateBuckets[key].length >= cfg.max) {
    return { allowed: false, retryAfter: Math.ceil(cfg.windowMs / 1000) };
  }
  rateBuckets[key].push(now);
  return { allowed: true };
}

setInterval(() => {
  const now = Date.now();
  for (const key of Object.keys(rateBuckets)) {
    rateBuckets[key] = rateBuckets[key].filter(ts => now - ts < 3600000);
    if (rateBuckets[key].length === 0) delete rateBuckets[key];
  }
}, 300000);

/* =========================================================
   MIME
   ========================================================= */
const MIME_TYPES = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.webp': 'image/webp', '.woff': 'font/woff',
  '.woff2': 'font/woff2', '.txt': 'text/plain', '.xml': 'application/xml',
};
const COMPRESSIBLE = new Set(['text/html', 'text/css', 'application/javascript', 'application/json', 'image/svg+xml', 'application/xml', 'text/plain']);

/* =========================================================
   GZIP / BROTLI COMPRESSION
   ========================================================= */
function negotiateEncoding(req) {
  const ae = req.headers['accept-encoding'] || '';
  if (ae.includes('br')) return 'br';
  if (ae.includes('gzip')) return 'gzip';
  return null;
}

function compressedWrite(req, res, statusCode, contentType, body) {
  const isCompressible = COMPRESSIBLE.has(contentType) && body.length > 1024;
  const encoding = isCompressible ? negotiateEncoding(req) : null;

  if (encoding === 'br') {
    res.setHeader('Content-Encoding', 'br');
    res.writeHead(statusCode, { 'Content-Type': contentType, Vary: 'Accept-Encoding' });
    const buf = typeof body === 'string' ? Buffer.from(body) : body;
    zlib.brotliCompress(buf, (err, compressed) => {
      res.end(err ? buf : compressed);
    });
  } else if (encoding === 'gzip') {
    res.setHeader('Content-Encoding', 'gzip');
    res.writeHead(statusCode, { 'Content-Type': contentType, Vary: 'Accept-Encoding' });
    const buf = typeof body === 'string' ? Buffer.from(body) : body;
    zlib.gzip(buf, (err, compressed) => {
      res.end(err ? buf : compressed);
    });
  } else {
    res.writeHead(statusCode, { 'Content-Type': contentType });
    res.end(body);
  }
}

/* =========================================================
   CACHE (in-memory, stale-while-revalidate)
   ========================================================= */
const _cache = {};
const CACHE_TTL = 5 * 60 * 1000;
const STALE_TTL = 30 * 60 * 1000;

/* Last MarketCheck calls for /api/_diag (dev only) */
let LAST_MC = { ts: null, calls: [] };
function noteMc(endpoint, status, body) {
  LAST_MC.ts = new Date().toISOString();
  LAST_MC.calls.push({
    ts: LAST_MC.ts,
    endpoint,
    status,
    error: body && (body.error || body.message) ? (body.error || body.message) : null,
  });
  if (LAST_MC.calls.length > 25) LAST_MC.calls.shift();
}

function fromCache(key) {
  const c = _cache[key];
  if (!c) return { data: null, stale: false };
  const age = Date.now() - c.ts;
  if (age < CACHE_TTL) return { data: c.data, stale: false };
  if (age < STALE_TTL) return { data: c.data, stale: true };
  delete _cache[key];
  return { data: null, stale: false };
}

function toCache(key, data) {
  _cache[key] = { data, ts: Date.now() };
  return data;
}

/* =========================================================
   MARKETCHECK CLIENT (with retry + timeout)
   ========================================================= */
function mcFetch(endpoint, params, retries) {
  retries = retries != null ? retries : 2;
  return new Promise((resolve, reject) => {
    params.api_key = API_KEY;
    const qs = Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== '')
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');
    const reqUrl = `https://api.marketcheck.com/v2${endpoint}?${qs}`;

    const request = https.get(reqUrl, { headers: { Accept: 'application/json' } }, apiRes => {
      let data = '';
      apiRes.on('data', chunk => (data += chunk));
      apiRes.on('end', () => {
        let body;
        try {
          body = JSON.parse(data);
          noteMc(endpoint, apiRes.statusCode, body);
          resolve({ status: apiRes.statusCode, body });
        } catch {
          body = data;
          noteMc(endpoint, apiRes.statusCode, typeof body === 'object' ? body : null);
          resolve({ status: apiRes.statusCode, body });
        }
      });
    });
    request.on('error', err => {
      if (retries > 0) {
        const delay = (3 - retries) * 1000;
        setTimeout(() => mcFetch(endpoint, params, retries - 1).then(resolve, reject), delay);
      } else {
        reject(err);
      }
    });
    request.setTimeout(12000, () => {
      request.destroy();
      if (retries > 0) {
        setTimeout(() => mcFetch(endpoint, params, retries - 1).then(resolve, reject), 1000);
      } else {
        reject(new Error('Upstream timeout (12s)'));
      }
    });
  });
}

/* =========================================================
   EBAY: OAuth token + Browse API (cars)
   ========================================================= */
const EBAY_TOKEN_CACHE = { token: null, expiresAt: 0 };
const EBAY_SCOPE = 'https://api.ebay.com/oauth/api_scope';

function getEbayToken() {
  if (EBAY_TOKEN_CACHE.token && Date.now() < EBAY_TOKEN_CACHE.expiresAt) {
    return Promise.resolve(EBAY_TOKEN_CACHE.token);
  }
  if (!EBAY_CLIENT_ID || !EBAY_CLIENT_SECRET) return Promise.resolve(null);

  const host = EBAY_ENVIRONMENT === 'production' ? 'api.ebay.com' : 'api.sandbox.ebay.com';
  const credentials = Buffer.from(EBAY_CLIENT_ID + ':' + EBAY_CLIENT_SECRET).toString('base64');
  const body = `grant_type=client_credentials&scope=${encodeURIComponent(EBAY_SCOPE)}`;

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: host,
      path: '/identity/v1/oauth2/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + credentials,
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let data = '';
      res.on('data', (ch) => { data += ch; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (res.statusCode === 200 && json.access_token) {
            EBAY_TOKEN_CACHE.token = json.access_token;
            EBAY_TOKEN_CACHE.expiresAt = Date.now() + (Math.min(Number(json.expires_in) || 7200, 7200) - 60) * 1000;
            resolve(json.access_token);
          } else {
            reject(new Error(json.error_description || 'eBay token failed'));
          }
        } catch (e) {
          reject(new Error(data || 'eBay token parse error'));
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function ebayBrowseSearch(opts) {
  const { q = 'car', limit = 20, offset = 0, category_ids = '6001' } = opts || {};
  const host = EBAY_ENVIRONMENT === 'production' ? 'api.ebay.com' : 'api.sandbox.ebay.com';
  const path = '/buy/browse/v1/item_summary/search?' + [
    'q=' + encodeURIComponent(q),
    'category_ids=' + encodeURIComponent(category_ids),
    'limit=' + Math.min(200, Math.max(1, limit)),
    'offset=' + Math.max(0, offset),
  ].join('&');

  return getEbayToken().then(token => {
    return new Promise((resolve, reject) => {
      const req = https.get({
        hostname: host,
        path,
        headers: {
          'Authorization': 'Bearer ' + token,
          'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
          'Accept': 'application/json',
        },
      }, (res) => {
        let data = '';
        res.on('data', (ch) => { data += ch; });
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (res.statusCode === 200) {
              resolve({ itemSummaries: json.itemSummaries || [], total: json.total || 0 });
            } else {
              reject(new Error(json.errors?.[0]?.message || data));
            }
          } catch (e) {
            reject(new Error(data || 'eBay search parse error'));
          }
        });
      });
      req.on('error', reject);
      req.setTimeout(10000, () => { req.destroy(); reject(new Error('eBay timeout')); });
    });
  }).catch(err => {
    log('warn', 'eBay search skipped', { err: err.message });
    return { itemSummaries: [], total: 0 };
  });
}

function normalizeEbayListing(summary) {
  const price = summary.price?.value != null ? parseFloat(summary.price.value) : null;
  const images = [];
  if (summary.image?.imageUrl) images.push(summary.image.imageUrl);
  (summary.additionalImages || []).slice(0, 9).forEach(img => { if (img?.imageUrl) images.push(img.imageUrl); });
  const loc = summary.itemLocation || {};
  return {
    id: 'ebay-' + (summary.itemId || summary.legacyItemId || ''),
    vin: null,
    heading: summary.title || 'eBay Vehicle',
    price,
    miles: null,
    inventory_type: 'used',
    build: { year: null, make: null, model: null, body_type: 'Other' },
    media: { photo_links: images },
    dealer: {
      city: loc.city || '',
      state: loc.stateOrProvince || '',
      dealer_type: 'independent',
    },
    itemWebUrl: summary.itemWebUrl || '',
    _meta: {
      score: 0.5,
      variant: null,
      dealBadge: price ? 'fair-price' : null,
      priceFairness: 0.5,
      freshness: 0.6,
      mileageValue: 0.5,
      trustSignals: ['verified-vin'],
    },
    _source: 'ebay',
  };
}

function ebayGetItem(itemId) {
  const host = EBAY_ENVIRONMENT === 'production' ? 'api.ebay.com' : 'api.sandbox.ebay.com';
  const path = '/buy/browse/v1/item/' + encodeURIComponent(itemId);
  return getEbayToken().then(token => {
    return new Promise((resolve, reject) => {
      const req = https.get({
        hostname: host,
        path,
        headers: {
          'Authorization': 'Bearer ' + token,
          'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
          'Accept': 'application/json',
        },
      }, (res) => {
        let data = '';
        res.on('data', (ch) => { data += ch; });
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (res.statusCode === 200) resolve(json);
            else reject(new Error(json.errors?.[0]?.message || data));
          } catch (e) {
            reject(new Error(data || 'eBay getItem parse error'));
          }
        });
      });
      req.on('error', reject);
      req.setTimeout(10000, () => { req.destroy(); reject(new Error('eBay timeout')); });
    });
  });
}

/* =========================================================
   AUTO.DEV — Vehicle Listings API (Bearer token, 1000 calls/month)
   ========================================================= */
function autoDevFetch(path, qs) {
  if (!AUTO_DEV_API_KEY) return Promise.resolve(null);
  const query = qs && Object.keys(qs).length ? '?' + new URLSearchParams(qs).toString() : '';
  const url = 'https://api.auto.dev/listings' + (path || '') + query;
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.get({
      hostname: u.hostname,
      path: u.pathname + u.search,
      headers: {
        'Authorization': 'Bearer ' + AUTO_DEV_API_KEY,
        'Accept': 'application/json',
      },
    }, (res) => {
      let data = '';
      res.on('data', (ch) => { data += ch; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (res.statusCode === 200) resolve(json);
          else reject(new Error(json.error || json.message || 'HTTP ' + res.statusCode));
        } catch (e) {
          reject(new Error(data || 'auto.dev parse error'));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(12000, () => { req.destroy(); reject(new Error('auto.dev timeout')); });
  }).catch(err => {
    log('warn', 'auto.dev fetch failed', { err: err.message });
    return null;
  });
}

function normalizeAutoDevListing(item) {
  const v = item.vehicle || {};
  const r = item.retailListing || {};
  const w = item.wholesaleListing || {};
  const price = r.price != null ? Number(r.price) : null;
  const miles = r.miles != null ? r.miles : w.miles != null ? w.miles : null;
  const heading = [v.year, v.make, v.model].filter(Boolean).join(' ') || 'Vehicle';
  const photo = r.primaryImage || null;
  const id = item.vin || 'autodev-' + Math.random().toString(36).slice(2, 9);
  return {
    id,
    vin: item.vin,
    heading,
    price,
    miles,
    inventory_type: r.cpo ? 'certified' : (r.used ? 'used' : 'new'),
    build: {
      year: v.year,
      make: v.make,
      model: v.model,
      trim: v.trim,
      fuel_type: v.fuel || v.engine,
      transmission: v.transmission,
      body_type: null,
      drivetrain: v.drivetrain,
      engine: v.engine,
      doors: v.doors,
    },
    media: { photo_links: [photo] },
    dealer: {
      name: r.dealer,
      city: r.city,
      state: r.state,
      zip: r.zip,
      dealer_type: 'independent',
    },
    itemWebUrl: r.vdp,
    _meta: {
      score: 0.6,
      variant: null,
      dealBadge: price ? 'fair-price' : null,
      priceFairness: 0.5,
      freshness: 0.6,
      mileageValue: miles != null ? 0.5 : 0.5,
      trustSignals: item.vin ? ['verified-vin'] : [],
    },
    _source: 'autodev',
  };
}

/* =========================================================
   PIPELINE
   ========================================================= */

function deduplicateListings(listings) {
  const vinSeen = new Set();
  const fuzzyMap = new Map();
  const result = [];

  for (const l of listings) {
    if (l.vin && vinSeen.has(l.vin)) continue;
    if (l.vin) vinSeen.add(l.vin);

    const b = l.build || {};
    const fuzzyKey = [
      (b.make || '').toLowerCase(),
      (b.model || '').toLowerCase(),
      b.year || '',
      (b.trim || '').toLowerCase(),
      l.dealer?.id || '',
    ].join('|');

    if (fuzzyMap.has(fuzzyKey)) {
      const existing = fuzzyMap.get(fuzzyKey);
      const existingPhotos = existing.media?.photo_links?.length || 0;
      const thisPhotos = l.media?.photo_links?.length || 0;
      if (thisPhotos > existingPhotos) {
        const idx = result.indexOf(existing);
        if (idx >= 0) result[idx] = l;
        fuzzyMap.set(fuzzyKey, l);
      }
      continue;
    }
    fuzzyMap.set(fuzzyKey, l);
    result.push(l);
  }
  return result;
}

function computeMarketContext(listings) {
  const groups = {};
  for (const l of listings) {
    const b = l.build || {};
    const key = `${(b.make || '').toLowerCase()}|${(b.model || '').toLowerCase()}|${b.year || ''}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(l);
  }

  const now = Date.now() / 1000;
  const currentYear = new Date().getFullYear();

  return listings.map(l => {
    const b = l.build || {};
    const key = `${(b.make || '').toLowerCase()}|${(b.model || '').toLowerCase()}|${b.year || ''}`;
    const group = groups[key] || [l];
    const prices = group.map(g => g.price).filter(Boolean).sort((a, c) => a - c);
    const medianPrice = prices.length ? prices[Math.floor(prices.length / 2)] : null;

    let priceFairness = 0.5;
    if (l.price && l.msrp && l.msrp > 0) {
      const ratio = l.price / l.msrp;
      priceFairness = ratio < 0.82 ? 1.0 : ratio < 0.90 ? 0.85 : ratio < 0.98 ? 0.65 : ratio < 1.02 ? 0.5 : ratio < 1.10 ? 0.3 : 0.15;
    } else if (l.price && medianPrice) {
      const ratio = l.price / medianPrice;
      priceFairness = ratio < 0.85 ? 1.0 : ratio < 0.93 ? 0.8 : ratio < 1.02 ? 0.5 : ratio < 1.12 ? 0.3 : 0.15;
    }

    const firstSeen = l.first_seen_at || l.first_seen_at_source || now;
    const daysSinceFirst = Math.max(0, (now - firstSeen) / 86400);
    const freshness = daysSinceFirst < 3 ? 1.0 : daysSinceFirst < 7 ? 0.85 : daysSinceFirst < 14 ? 0.6 : daysSinceFirst < 30 ? 0.35 : 0.15;

    const age = Math.max(0, currentYear - (b.year || currentYear));
    const expectedMiles = age <= 0 ? 500 : age * 12000;
    const actualMiles = l.miles ?? 99999;
    const mileRatio = expectedMiles > 0 ? actualMiles / expectedMiles : 1;
    const mileageValue = mileRatio < 0.25 ? 1.0 : mileRatio < 0.5 ? 0.85 : mileRatio < 0.8 ? 0.6 : mileRatio < 1.0 ? 0.4 : 0.2;

    const photoCount = l.media?.photo_links?.length || 0;
    const photoQuality = photoCount >= 20 ? 1.0 : photoCount >= 10 ? 0.85 : photoCount >= 5 ? 0.65 : photoCount >= 2 ? 0.4 : photoCount >= 1 ? 0.25 : 0.0;

    const dealerType = (l.dealer?.dealer_type || '').toLowerCase();
    const dealerQuality = dealerType === 'franchise' ? 0.9 : dealerType === 'independent' ? 0.45 : 0.3;

    const hasPrice = l.price ? 1 : 0;
    const hasPhoto = photoCount > 0 ? 1 : 0;
    const hasColor = l.exterior_color ? 1 : 0;
    const hasMiles = l.miles != null ? 1 : 0;
    const completeness = (hasPrice + hasPhoto + hasColor + hasMiles) / 4;

    /* Featured boost (P3 monetization) */
    const featuredBoost = l._featured ? 0.15 : 0;

    const score =
      0.22 * priceFairness +
      0.18 * freshness +
      0.14 * mileageValue +
      0.14 * photoQuality +
      0.10 * dealerQuality +
      0.12 * completeness +
      0.10 * (hasPrice ? 0.8 : 0.0) +
      featuredBoost;

    let variant = null;
    if (priceFairness >= 0.75 && hasPrice) variant = 'best-value';
    else if (mileageValue >= 0.8)           variant = 'low-mileage';
    else if (freshness >= 0.8)              variant = 'newly-listed';

    let dealBadge = null;
    if (hasPrice) {
      if (priceFairness >= 0.8)       dealBadge = 'great-deal';
      else if (priceFairness >= 0.5)  dealBadge = 'fair-price';
      else if (priceFairness <= 0.25) dealBadge = 'above-market';
    }

    const trustSignals = [];
    if (l.vin)                       trustSignals.push('verified-vin');
    if (dealerType === 'franchise')  trustSignals.push('franchise-dealer');
    if (l.carfax_1_owner)            trustSignals.push('one-owner');
    if (l.carfax_clean_title)        trustSignals.push('clean-title');

    return {
      ...l,
      _meta: {
        score: Math.round(score * 1000) / 1000,
        variant,
        dealBadge,
        priceFairness: Math.round(priceFairness * 100) / 100,
        freshness: Math.round(freshness * 100) / 100,
        mileageValue: Math.round(mileageValue * 100) / 100,
        photoQuality: Math.round(photoQuality * 100) / 100,
        dealerQuality: Math.round(dealerQuality * 100) / 100,
        daysSinceFirst: Math.round(daysSinceFirst),
        medianPrice,
        trustSignals,
        featured: !!l._featured,
      },
    };
  });
}

function rankAndDiversify(listings, blockSize) {
  blockSize = blockSize || 8;
  const sorted = [...listings].sort((a, b) => (b._meta?.score || 0) - (a._meta?.score || 0));
  const result = [];
  const globalDealerCount = {};
  let block = [];

  for (const l of sorted) {
    const b = l.build || {};
    const modelKey = `${(b.make || '')}|${(b.model || '')}`.toLowerCase();
    const dealerId = String(l.dealer?.id || '');

    /* At most 1 of same make|model per block so you don't see same model next to each other */
    const modelInBlock = block.filter(x => {
      const xb = x.build || {};
      return `${(xb.make || '')}|${(xb.model || '')}`.toLowerCase() === modelKey;
    }).length;
    if (modelInBlock >= 1) continue;

    globalDealerCount[dealerId] = (globalDealerCount[dealerId] || 0);
    if (globalDealerCount[dealerId] >= 3) continue;

    result.push(l);
    block.push(l);
    globalDealerCount[dealerId]++;

    if (block.length >= blockSize) block = [];
  }
  return interleaveByModel(result);
}

/** Reorder so no two adjacent listings have the same make|model. */
function interleaveByModel(listings) {
  if (listings.length <= 1) return listings;
  const modelKey = (l) => {
    const b = l.build || {};
    return `${(b.make || '')}|${(b.model || '')}`.toLowerCase();
  };
  const byModel = new Map();
  for (const l of listings) {
    const k = modelKey(l);
    if (!byModel.has(k)) byModel.set(k, []);
    byModel.get(k).push(l);
  }
  const out = [];
  let prevKey = null;
  while (out.length < listings.length) {
    let bestK = null;
    let bestList = null;
    for (const [k, arr] of byModel.entries()) {
      if (arr.length === 0 || k === prevKey) continue;
      if (!bestList || arr.length > bestList.length) {
        bestK = k;
        bestList = arr;
      }
    }
    if (!bestK || !bestList || bestList.length === 0) break;
    out.push(bestList.shift());
    if (bestList.length === 0) byModel.delete(bestK);
    prevKey = bestK;
  }
  /* Append any remaining (same model as last) so we don't drop listings */
  for (const arr of byModel.values()) for (const l of arr) out.push(l);
  return out;
}

function lightDiversify(listings, maxPerModel) {
  maxPerModel = maxPerModel || 3;
  const modelCount = {};
  return listings.filter(l => {
    const b = l.build || {};
    const key = `${(b.make || '')}|${(b.model || '')}`.toLowerCase();
    modelCount[key] = (modelCount[key] || 0) + 1;
    return modelCount[key] <= maxPerModel;
  });
}

function processPipeline(listings, opts) {
  opts = opts || {};

  // Optionally drop cars with too few photos so cards always have a strong image.
  const minPhotos = Number.isFinite(opts.minPhotos) ? opts.minPhotos : 0;
  let base = Array.isArray(listings) ? listings : [];
  if (minPhotos > 0 && base.length) {
    const filtered = base.filter(l => (l.media?.photo_links?.length || 0) >= minPhotos);
    if (filtered.length) base = filtered;
  }

  let result = deduplicateListings(base);
  result = computeMarketContext(result);
  if (opts.rank !== false) {
    result = rankAndDiversify(result, opts.blockSize || 8);
  } else {
    result = lightDiversify(result, opts.maxPerModel || 3);
    result = interleaveByModel(result);
  }
  return result;
}

function pickRail(pool, count, usedIds, scoreFn) {
  const sorted = pool
    .filter(l => !usedIds.has(l.id || l.vin))
    .sort((a, b) => scoreFn(b) - scoreFn(a));

  const result = [];
  const makeCount = {};
  const modelSeen = new Set();

  for (const l of sorted) {
    if (result.length >= count) break;
    const b = l.build || {};
    const make = (b.make || '').toLowerCase();
    const modelKey = `${make}|${(b.model || '').toLowerCase()}`;

    if (modelSeen.has(modelKey)) continue;
    if ((makeCount[make] || 0) >= 2) continue;

    result.push(l);
    usedIds.add(l.id || l.vin);
    modelSeen.add(modelKey);
    makeCount[make] = (makeCount[make] || 0) + 1;
  }
  return result;
}

/* Demo fallback so UI never goes empty when upstream returns zero */
function getDemoListings() {
  return [
    { id: 'demo-1', vin: 'DEMO1', heading: '2026 BMW M4 Competition', price: 82900, miles: 1250, inventory_type: 'new', build: { year: 2026, make: 'BMW', model: 'M4 Competition', fuel_type: 'Gasoline', transmission: 'Automatic', body_type: 'Coupe' }, media: { photo_links: ['https://images.unsplash.com/photo-1555215695-3004980ad54e?w=640&h=400&fit=crop&auto=format&q=80'] }, dealer: { city: 'New York', state: 'NY', dealer_type: 'franchise' } },
    { id: 'demo-2', vin: 'DEMO2', heading: '2026 Mercedes-Benz S-Class', price: 118300, miles: 500, inventory_type: 'new', build: { year: 2026, make: 'Mercedes-Benz', model: 'S-Class', fuel_type: 'Gasoline', transmission: 'Automatic', body_type: 'Sedan' }, media: { photo_links: ['https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?w=640&h=400&fit=crop&auto=format&q=80'] }, dealer: { city: 'Los Angeles', state: 'CA', dealer_type: 'franchise' } },
    { id: 'demo-3', vin: 'DEMO3', heading: '2025 Tesla Model S Plaid', price: 89990, miles: 3200, inventory_type: 'used', build: { year: 2025, make: 'Tesla', model: 'Model S', fuel_type: 'Electric', transmission: 'Automatic', body_type: 'Sedan' }, media: { photo_links: ['https://images.unsplash.com/photo-1560958089-b8a1929cea89?w=640&h=400&fit=crop&auto=format&q=80'] }, dealer: { city: 'San Francisco', state: 'CA', dealer_type: 'independent' } },
    { id: 'demo-4', vin: 'DEMO4', heading: '2025 Porsche 911 Turbo S', price: 216100, miles: 2100, inventory_type: 'certified', build: { year: 2025, make: 'Porsche', model: '911', fuel_type: 'Gasoline', transmission: 'Automatic', body_type: 'Coupe' }, media: { photo_links: ['https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=640&h=400&fit=crop&auto=format&q=80'] }, dealer: { city: 'Miami', state: 'FL', dealer_type: 'franchise' } },
    { id: 'demo-5', vin: 'DEMO5', heading: '2026 Toyota RAV4 Hybrid', price: 35400, miles: 50, inventory_type: 'new', build: { year: 2026, make: 'Toyota', model: 'RAV4', fuel_type: 'Hybrid', transmission: 'Automatic', body_type: 'SUV' }, media: { photo_links: ['https://images.unsplash.com/photo-1609521263047-f8f205293f24?w=640&h=400&fit=crop&auto=format&q=80'] }, dealer: { city: 'Chicago', state: 'IL', dealer_type: 'franchise' } },
    { id: 'demo-6', vin: 'DEMO6', heading: '2025 Ford Mustang GT', price: 42300, miles: 8500, inventory_type: 'used', build: { year: 2025, make: 'Ford', model: 'Mustang', fuel_type: 'Gasoline', transmission: 'Manual', body_type: 'Coupe' }, media: { photo_links: ['https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=640&h=400&fit=crop&auto=format&q=80'] }, dealer: { city: 'Dallas', state: 'TX', dealer_type: 'independent' } },
  ];
}

function buildDemoFeed() {
  const processed = processPipeline(getDemoListings(), { minPhotos: 2 });
  const usedIds = new Set();
  return {
    rails: {
      editorPicks: pickRail(processed, 6, usedIds, l => l._meta?.score || 0),
      bestDeals: pickRail(processed, 6, usedIds, l => l._meta?.priceFairness || 0),
      lowMileage: pickRail(processed, 6, usedIds, l => l._meta?.mileageValue || 0),
      justArrived: pickRail(processed, 6, usedIds, l => l._meta?.freshness || 0),
    },
    totalAvailable: processed.length,
    source: 'demo',
  };
}

/** Real listings from eBay when MarketCheck is unavailable (quota, error). Alternative to demo. */
async function buildEbayFeed() {
  if (!EBAY_CLIENT_ID || !EBAY_CLIENT_SECRET) return null;
  try {
    const [carRes, suvRes, truckRes] = await Promise.all([
      ebayBrowseSearch({ q: 'car', limit: 25, category_ids: '6001' }),
      ebayBrowseSearch({ q: 'suv', limit: 15, category_ids: '6001' }),
      ebayBrowseSearch({ q: 'pickup truck', limit: 10, category_ids: '6001' }),
    ]);
    const seen = new Set();
    const allSummaries = [];
    [...(carRes.itemSummaries || []), ...(suvRes.itemSummaries || []), ...(truckRes.itemSummaries || [])].forEach(s => {
      const id = s.itemId || s.legacyItemId;
      if (id && !seen.has(id)) { seen.add(id); allSummaries.push(s); }
    });
    if (allSummaries.length === 0) return null;
    let allRaw = allSummaries.map(normalizeEbayListing).map(normalizeListing);
    allRaw = applyFeatured(allRaw);
    const processed = processPipeline(allRaw, { minPhotos: 2 });
    const usedIds = new Set();
    const payload = {
      rails: {
        editorPicks: pickRail(processed, 6, usedIds, l => l._meta?.score ?? 0.5),
        bestDeals:   pickRail(processed, 6, usedIds, l => l._meta?.priceFairness ?? 0.5),
        lowMileage:  pickRail(processed, 6, usedIds, l => l._meta?.mileageValue ?? 0.5),
        justArrived: pickRail(processed, 6, usedIds, l => l._meta?.freshness ?? 0.5),
      },
      totalAvailable: (carRes.total || 0) + (suvRes.total || 0) + (truckRes.total || 0),
      source: 'ebay',
    };
    const hasAny = Object.values(payload.rails).some(arr => Array.isArray(arr) && arr.length > 0);
    return hasAny ? payload : null;
  } catch (e) {
    log('warn', 'buildEbayFeed failed', { err: e.message });
    return null;
  }
}

/** Real listings from Auto.dev when MarketCheck is unavailable. Uses AUTO_DEV_API_KEY (1000 calls/month). */
async function buildAutoDevFeed() {
  if (!AUTO_DEV_API_KEY) return null;
  try {
    const res = await autoDevFetch('', { limit: 80, page: 1 });
    if (!res || !Array.isArray(res.data) || res.data.length === 0) return null;
    let allRaw = res.data.map(normalizeAutoDevListing).map(normalizeListing);
    allRaw = applyFeatured(allRaw);
    const processed = processPipeline(allRaw, { minPhotos: 2 });
    const usedIds = new Set();
    const payload = {
      rails: {
        editorPicks: pickRail(processed, 6, usedIds, l => l._meta?.score ?? 0.5),
        bestDeals:   pickRail(processed, 6, usedIds, l => l._meta?.priceFairness ?? 0.5),
        lowMileage:  pickRail(processed, 6, usedIds, l => l._meta?.mileageValue ?? 0.5),
        justArrived: pickRail(processed, 6, usedIds, l => l._meta?.freshness ?? 0.5),
      },
      totalAvailable: res.data.length,
      source: 'autodev',
    };
    const hasAny = Object.values(payload.rails).some(arr => Array.isArray(arr) && arr.length > 0);
    return hasAny ? payload : null;
  } catch (e) {
    log('warn', 'buildAutoDevFeed failed', { err: e.message });
    return null;
  }
}

/* =========================================================
   HTTP HELPERS
   ========================================================= */
function jsonRes(req, res, status, body, extraHeaders) {
  const cacheDir = status >= 200 && status < 300 ? 'public, max-age=300' : 'no-store';
  res.setHeader('Cache-Control', cacheDir);
  if (body && body.source != null) res.setHeader('X-ND-Source', String(body.source));
  if (extraHeaders && typeof extraHeaders === 'object') {
    Object.entries(extraHeaders).forEach(([k, v]) => v != null && res.setHeader(k, v));
  }
  const json = JSON.stringify(body);
  compressedWrite(req, res, status, 'application/json', json);
}

function clampInt(val, min, max, fallback) {
  const n = parseInt(val);
  if (isNaN(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

/* =========================================================
   FEATURED LISTINGS (P3 — Monetization)
   ========================================================= */
const FEATURED_FILE = path.join(__dirname, 'data', 'featured.json');

function loadFeatured() {
  try {
    if (fs.existsSync(FEATURED_FILE)) {
      const data = JSON.parse(fs.readFileSync(FEATURED_FILE, 'utf8'));
      return Array.isArray(data) ? data : [];
    }
  } catch { /* ignore */ }
  return [];
}

function saveFeatured(list) {
  fs.writeFileSync(FEATURED_FILE, JSON.stringify(list, null, 2), 'utf8');
}

/** Ensure each listing has build and heading for pipeline/cards (MarketCheck may use build or top-level year/make/model) */
function normalizeListing(l) {
  const b = l.build || {};
  const build = {
    year: l.year ?? b.year,
    make: l.make ?? b.make,
    model: l.model ?? b.model,
    fuel_type: l.fuel_type ?? b.fuel_type,
    transmission: l.transmission ?? b.transmission,
    body_type: l.body_type ?? b.body_type,
    engine: b.engine,
    drivetrain: b.drivetrain,
    doors: b.doors,
    city_mpg: b.city_mpg,
    highway_mpg: b.highway_mpg,
  };
  const heading = l.heading || (build.year || build.make || build.model ? [build.year, build.make, build.model].filter(Boolean).join(' ') : 'Vehicle');
  return { ...l, build, heading };
}

function applyFeatured(listings) {
  const featured = loadFeatured();
  const now = Date.now();
  const activeIds = new Set(featured.filter(f => !f.expires || f.expires > now).map(f => f.listingId));
  if (activeIds.size === 0) return listings;
  return listings.map(l => activeIds.has(l.id || l.vin) ? { ...l, _featured: true } : l);
}

/* =========================================================
   API ROUTES — single default page size for inventory
   ========================================================= */
const DEFAULT_PAGE_SIZE = 12;  // must match frontend PAGE_SIZE

async function handleAPI(reqUrl, req, res) {
  const u = new URL(reqUrl, `http://${req.headers.host || 'localhost:' + PORT}`);
  const pathname = u.pathname;
  const q = Object.fromEntries(u.searchParams.entries());

  try {

    /* ═══ INTERNAL: Cars corpus (on-demand, key-protected) ═══ */
    if (pathname === '/api/internal/cars-corpus' && req.method === 'GET') {
      const key = req.headers['x-internal-key'];
      if (!INTERNAL_CORPUS_KEY || key !== INTERNAL_CORPUS_KEY) {
        jsonRes(req, res, 403, { error: 'forbidden' });
        return true;
      }
      const fp = path.join(__dirname, 'data', 'cars_corpus.md');
      if (!fs.existsSync(fp)) {
        jsonRes(req, res, 404, { error: 'corpus not found; run npm run gen:cars-corpus' });
        return true;
      }
      const text = fs.readFileSync(fp, 'utf8');
      res.writeHead(200, {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'private, max-age=300',
      });
      res.end(text);
      return true;
    }

    /* ═══ DIAG (dev: MarketCheck key + last calls) ═══ */
    if (pathname === '/api/_diag' && req.method === 'GET') {
      const hasKey = !!(process.env.MARKETCHECK_API_KEY || '').trim();
      jsonRes(req, res, 200, {
        ok: true,
        port: process.env.PORT || null,
        nodeEnv: process.env.NODE_ENV || null,
        hasKey,
        keyLen: hasKey ? String(process.env.MARKETCHECK_API_KEY).trim().length : 0,
        lastMc: LAST_MC,
      });
      return true;
    }

    /* ═══ HOME FEED ═══ */
    if (pathname === '/api/home-feed') {
      const cacheKey = 'home-feed';
      const nocache = (q.nocache === '1' || q.fresh === '1');
      const { data: cached, stale } = nocache ? { data: null, stale: false } : fromCache(cacheKey);
      if (cached && !stale) { jsonRes(req, res, 200, cached); return true; }

      const fetchFresh = async () => {
        const [premiumRes, valueRes, freshRes, suvRes] = await Promise.all([
          mcFetch('/search/car/active', {
            rows: 25, photo_links: 'true', min_photo_links: 5,
            year_range: '2024-2026', price_range: '28000-180000',
            make: 'BMW,Mercedes-Benz,Audi,Porsche,Lexus,Toyota,Honda,Tesla,Ford,Chevrolet,Hyundai,Kia,Mazda,Subaru,Volkswagen',
            sort_by: 'last_seen', sort_order: 'desc', country: 'us',
          }),
          mcFetch('/search/car/active', {
            rows: 25, photo_links: 'true', min_photo_links: 3,
            year_range: '2022-2026', price_range: '15000-50000',
            miles_range: '0-50000',
            sort_by: 'price', sort_order: 'asc', country: 'us',
          }),
          mcFetch('/search/car/active', {
            rows: 25, photo_links: 'true', min_photo_links: 3,
            year_range: '2024-2026', price_range: '20000-120000',
            first_seen_days: '0-7',
            sort_by: 'first_seen', sort_order: 'desc', country: 'us',
          }),
          mcFetch('/search/car/active', {
            rows: 15, photo_links: 'true', min_photo_links: 4,
            year_range: '2024-2026', body_type: 'SUV',
            price_range: '25000-90000',
            sort_by: 'last_seen', sort_order: 'desc', country: 'us',
          }),
        ]);

        /* Treat non-200 or API error as failure so we log and fall back to demo */
        const check = (r, label) => {
          if (r.status !== 200) {
            const msg = (r.body && (r.body.message || r.body.error)) ? (r.body.message || r.body.error) : 'HTTP ' + r.status;
            throw new Error('MarketCheck ' + label + ': ' + msg);
          }
          if (r.body && (r.body.error || r.body.message) && !r.body.listings) {
            throw new Error('MarketCheck ' + label + ': ' + (r.body.message || r.body.error));
          }
        };
        check(premiumRes, 'premium');
        check(valueRes, 'value');
        check(freshRes, 'fresh');
        check(suvRes, 'suv');

        let allRaw = [
          ...(premiumRes.body.listings || []),
          ...(valueRes.body.listings || []),
          ...(freshRes.body.listings || []),
          ...(suvRes.body.listings || []),
        ];

        if (allRaw.length === 0) {
          throw new Error('MarketCheck returned 0 listings (key may be invalid or quota exceeded)');
        }

        allRaw = allRaw.map(normalizeListing);
        allRaw = applyFeatured(allRaw);
        const processed = processPipeline(allRaw, { minPhotos: 2 });
        const usedIds = new Set();

        const payload = {
          rails: {
            editorPicks: pickRail(processed, 6, usedIds, l => l._meta.score),
            bestDeals:   pickRail(processed, 6, usedIds, l => l._meta.priceFairness),
            lowMileage:  pickRail(processed, 6, usedIds, l => l._meta.mileageValue),
            justArrived: pickRail(processed, 6, usedIds, l => l._meta.freshness),
          },
          totalAvailable: premiumRes.body.num_found || 0,
        };
        const hasAny = Object.values(payload.rails).some(arr => Array.isArray(arr) && arr.length > 0);
        return hasAny ? payload : buildDemoFeed();
      };

      if (cached && stale) {
        jsonRes(req, res, 200, cached);
        fetchFresh().then(fresh => toCache(cacheKey, fresh)).catch(err => log('error', 'SWR revalidation failed', { err: err.message }));
        return true;
      }

      let response;
      try {
        response = await fetchFresh();
      } catch (e) {
        log('warn', 'home_feed_marketcheck_failed', { reason: e.message });
        response = await buildAutoDevFeed();
        if (!response) response = await buildEbayFeed();
        if (!response) {
          log('warn', 'home_feed_serving_demo', { reason: 'Auto.dev and eBay unavailable or returned no listings' });
          response = buildDemoFeed();
        }
      }
      const hasRails = response && response.rails &&
        ['editorPicks', 'bestDeals', 'lowMileage', 'justArrived'].some(k =>
          Array.isArray(response.rails[k]) && response.rails[k].length > 0);
      if (!hasRails) {
        response = await buildAutoDevFeed();
        if (!response) response = await buildEbayFeed();
        if (!response) {
          log('warn', 'home_feed_serving_demo', { reason: 'empty_or_invalid_live_feed' });
          response = buildDemoFeed();
          response.source = 'demo';
          response.reason = 'empty_or_invalid_live_feed';
        }
      } else {
        response.source = response.source || 'live';
      }
      if (!nocache) toCache(cacheKey, response);
      jsonRes(req, res, 200, response);
      return true;
    }

    /* Legacy alias used by older clients */
    if (pathname === '/api/listings') {
      const processed = processPipeline(getDemoListings(), { rank: false, maxPerModel: 999, minPhotos: 2 });
      jsonRes(req, res, 200, { num_found: processed.length, listings: processed, source: 'demo' });
      return true;
    }

    /* ═══ INVENTORY SEARCH ═══ */
    if (pathname === '/api/inventory') {
      const rows = Math.min(50, Math.max(1, clampInt(q.rows, 1, 50, DEFAULT_PAGE_SIZE)));
      const start = clampInt(q.start, 0, 10000, 0);
      const fetchRows = Math.max(rows, 50);
      const params = {
        rows: String(fetchRows),
        start: String(start),
        photo_links: 'true',
        country: 'us',
      };
      if (q.make)         params.make = q.make;
      if (q.model)        params.model = q.model;
      if (q.year_range)   params.year_range = q.year_range;
      if (q.year)         params.year = q.year;
      if (q.price_range)  params.price_range = q.price_range;
      if (q.body_type)    params.body_type = q.body_type;
      if (q.car_type)     params.car_type = q.car_type;
      if (q.fuel_type)    params.fuel_type = q.fuel_type;
      if (q.transmission) params.transmission = q.transmission;
      if (q.miles_range)  params.miles_range = q.miles_range;
      if (q.sort_by)      { params.sort_by = q.sort_by; params.sort_order = q.sort_order || 'asc'; }
      else                { params.sort_by = 'last_seen'; params.sort_order = 'desc'; }
      if (q.zip)          { params.zip = q.zip; params.radius = q.radius || '50'; }

      const invCacheKey = 'inv:' + JSON.stringify(params);
      const { data: invCached, stale: invStale } = fromCache(invCacheKey);

      let result;
      if (invCached && !invStale) {
        result = invCached;
      } else if (invCached && invStale) {
        result = invCached;
        mcFetch('/search/car/active', params).then(fresh => toCache(invCacheKey, fresh)).catch(() => {});
      } else {
        try {
          result = await mcFetch('/search/car/active', params);
          toCache(invCacheKey, result);
        } catch (mcErr) {
          log('warn', 'inventory_marketcheck_failed', { reason: mcErr.message });
          if (AUTO_DEV_API_KEY) {
            const adQs = { limit: Math.min(rows, 100), page: Math.floor(start / rows) + 1 };
            if (q.make) adQs.make = q.make;
            const adRes = await autoDevFetch('', adQs);
            if (adRes && Array.isArray(adRes.data) && adRes.data.length > 0) {
              const list = adRes.data.map(normalizeAutoDevListing).map(normalizeListing);
              result = { body: { listings: list, num_found: adRes.data.length }, _source: 'autodev' };
              log('info', 'inventory_serving_autodev', { count: list.length });
            }
          }
          if (!result || !result.body?.listings?.length) {
            if (EBAY_CLIENT_ID && EBAY_CLIENT_SECRET) {
              try {
                const ebayRes = await ebayBrowseSearch({
                  q: (q.make || 'car').trim(),
                  limit: Math.min(rows, 50),
                  offset: start,
                  category_ids: '6001',
                });
                const ebayListings = (ebayRes.itemSummaries || []).map(normalizeEbayListing).map(normalizeListing);
                result = { body: { listings: ebayListings, num_found: ebayRes.total || ebayListings.length }, _source: 'ebay' };
                log('info', 'inventory_serving_ebay', { count: ebayListings.length });
              } catch (ebayErr) {
                log('warn', 'inventory_ebay_fallback_failed', { err: ebayErr.message });
                result = { body: { listings: [], num_found: 0 } };
              }
            } else if (!result) {
              result = { body: { listings: [], num_found: 0 } };
            }
          }
        }
      }

      let raw = result.body?.listings || [];
      raw = applyFeatured(raw);

      const hasSpecificMake = !!q.make;
      const preferredMax = hasSpecificMake ? 6 : 3;
      let processed = processPipeline(raw, { rank: false, maxPerModel: preferredMax, minPhotos: 1 });
      if (processed.length < rows) {
        processed = processPipeline(raw, { rank: false, maxPerModel: 999, minPhotos: 1 });
      }
      let trimmed = processed.slice(0, rows);
      if (trimmed.length === 0) {
        const demo = processPipeline(getDemoListings(), { rank: false, maxPerModel: 999, minPhotos: 2 });
        trimmed = demo.slice(0, rows);
      }

      let out;
      if (EBAY_CLIENT_ID && EBAY_CLIENT_SECRET) {
        const ebayLimit = Math.min(10, Math.max(0, rows));
        const ebayQ = (q.make || 'car').trim();
        try {
          const ebayRes = await ebayBrowseSearch({
            q: ebayQ,
            limit: ebayLimit,
            offset: start,
            category_ids: '6001',
          });
          const ebayListings = (ebayRes.itemSummaries || []).map(normalizeEbayListing);
          trimmed = [...trimmed, ...ebayListings].slice(0, rows);
          const mcCount = result.body?.num_found || 0;
          out = { num_found: Math.max(trimmed.length, mcCount + (ebayRes.total || 0)), listings: trimmed };
        } catch (ebayErr) {
          log('warn', 'eBay merge failed', { err: ebayErr.message });
          out = { num_found: Math.max(trimmed.length, result.body?.num_found || 0), listings: trimmed };
        }
      } else {
        out = { num_found: Math.max(trimmed.length, result.body?.num_found || 0), listings: trimmed };
      }
      if (!Array.isArray(out.listings) || out.listings.length === 0) {
        const demo = processPipeline(getDemoListings(), { rank: false, maxPerModel: 999, minPhotos: 2 });
        jsonRes(req, res, 200, {
          source: 'demo',
          reason: 'empty_or_invalid_live_inventory',
          num_found: demo.length,
          listings: demo.slice(0, rows),
        });
        return true;
      }
      out.source = result._source || 'live';
      jsonRes(req, res, 200, out);
      return true;
    }

    /* ═══ SINGLE LISTING ═══ */
    if (pathname.startsWith('/api/listing/')) {
      const listingId = pathname.replace('/api/listing/', '').replace(/\/$/, '');
      if (listingId.startsWith('ebay-')) {
        const ebayItemId = listingId.slice(5);
        if (!EBAY_CLIENT_ID || !EBAY_CLIENT_SECRET) {
          jsonRes(req, res, 404, { error: 'eBay not configured' });
          return true;
        }
        try {
          const item = await ebayGetItem(ebayItemId);
          const listing = normalizeEbayListing(item);
          jsonRes(req, res, 200, listing);
        } catch (err) {
          log('warn', 'eBay getItem failed', { itemId: ebayItemId, err: err.message });
          jsonRes(req, res, 404, { error: 'eBay item not found' });
        }
        return true;
      }
      const cacheKey = 'listing-' + listingId;
      const { data: cached, stale } = fromCache(cacheKey);

      if (cached && !stale) { jsonRes(req, res, 200, cached); return true; }
      if (cached && stale) {
        jsonRes(req, res, 200, cached);
        mcFetch(`/listing/car/${encodeURIComponent(listingId)}`, {}).then(fresh => {
          if (fresh.body && !fresh.body.error) {
            toCache(cacheKey, computeMarketContext([fresh.body])[0]);
          }
        }).catch(() => {});
        return true;
      }

      const result = await mcFetch(`/listing/car/${encodeURIComponent(listingId)}`, {});
      if (result.body && !result.body.error) {
        const enriched = computeMarketContext([result.body])[0];
        toCache(cacheKey, enriched);
        jsonRes(req, res, 200, enriched);
      } else {
        jsonRes(req, res, 200, result.body);
      }
      return true;
    }

    /* ═══ FACETS ═══ */
    if (pathname === '/api/facets') {
      const facetCacheKey = 'facets:' + (q.fields || 'default');
      const { data: fCached } = fromCache(facetCacheKey);
      if (fCached) { jsonRes(req, res, 200, fCached); return true; }

      const params = {
        rows: '0',
        facets: q.fields || 'make,body_type,fuel_type,transmission',
        country: 'us', year_range: '2020-2026',
      };
      const result = await mcFetch('/search/car/active', params);
      toCache(facetCacheKey, result.body);
      jsonRes(req, res, 200, result.body);
      return true;
    }

  } catch (err) {
    log('error', 'API route error', { path: pathname, err: err.message });
    if (err.message && err.message.includes('timeout')) {
      jsonRes(req, res, 504, { error: 'Upstream timeout' });
    } else {
      jsonRes(req, res, 500, { error: 'API request failed', message: err.message });
    }
    return true;
  }
  return false;
}

/* =========================================================
   BODY PARSER
   ========================================================= */
const BODY_LIMIT_DEFAULT = 1e6;       // 1 MB for general API
const BODY_LIMIT_LEAD_FORMS = 32 * 1024; // 32 KB for contact/newsletter

function readBody(req, maxBytes) {
  const limit = typeof maxBytes === 'number' && maxBytes > 0 ? maxBytes : BODY_LIMIT_DEFAULT;
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', chunk => {
      size += chunk.length;
      if (size > limit) { req.destroy(); reject(new Error('Payload too large')); return; }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString())); }
      catch { reject(new Error('Invalid JSON')); }
    });
    req.on('error', reject);
  });
}

function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/* =========================================================
   DATA PERSISTENCE (NDJSON)
   ========================================================= */
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const NOINDEX_HEADER = { 'X-Robots-Tag': 'noindex, nofollow' };
const MIN_SUBMIT_MS = 3000; // minimum time form must be open before submit (bot kill)
const HONEYPOT_FIELD = 'website'; // must be empty

function appendNdjson(filename, record) {
  const line = JSON.stringify({ ...record, _ts: new Date().toISOString() }) + '\n';
  try {
    fs.appendFileSync(path.join(DATA_DIR, filename), line, 'utf8');
  } catch (err) {
    log('warn', 'lead_file_append_failed', { filename, err: err.message });
  }
}

/** Send confirmation email to user who requested an account. Uses Resend; from address must be set (no blank). */
function sendAccountConfirmationEmail(toEmail, userName) {
  const apiKey = config.RESEND_API_KEY;
  const from = config.NOTIFICATION_FROM_EMAIL;
  if (!apiKey || !from) return; /* no blank: need both to send */
  const name = (userName && String(userName).trim()) || 'there';
  const html = `
    <p>Hi ${escapeHtml(name)},</p>
    <p>We received your request for a NightDrive account. We'll email you with a link to create your account when it's ready.</p>
    <p>— NightDrive</p>
  `;
  const body = JSON.stringify({
    from,
    to: [toEmail],
    subject: 'We got your NightDrive account request',
    html: html.trim(),
  });
  const opts = {
    hostname: 'api.resend.com',
    port: 443,
    path: '/emails',
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body, 'utf8'),
    },
  };
  const req = https.request(opts, (res) => {
    res.resume();
    if (res.statusCode >= 200 && res.statusCode < 300) return;
    log('warn', 'account_confirmation_email_failed', { status: res.statusCode });
  });
  req.on('error', (err) => log('warn', 'account_confirmation_email_failed', { err: err.message }));
  req.setTimeout(10000, () => req.destroy());
  req.end(body);
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
  const url = config.LEAD_WEBHOOK_URL;
  if (!url) return;
  const body = JSON.stringify({ type, payload, ts: new Date().toISOString() });
  const u = new URL(url);
  const headers = { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body, 'utf8') };
  const secret = config.LEAD_WEBHOOK_SECRET;
  if (secret) {
    const sig = crypto.createHmac('sha256', secret).update(body).digest('hex');
    headers['X-Webhook-Signature'] = `sha256=${sig}`;
  }
  const opts = { hostname: u.hostname, port: u.port || (u.protocol === 'https:' ? 443 : 80), path: u.pathname || '/', method: 'POST', headers };
  const lib = u.protocol === 'https:' ? https : http;
  const WEBHOOK_TIMEOUT_MS = 8000;
  const WEBHOOK_RETRY_DELAY_MS = 2000;

  function doRequest(retryCount) {
    const req = lib.request(opts, (res) => {
      res.resume();
      if (res.statusCode >= 200 && res.statusCode < 300) return;
      const retryable = res.statusCode >= 500 || res.statusCode === 429;
      if (retryCount === 0 && retryable) setTimeout(() => doRequest(1), WEBHOOK_RETRY_DELAY_MS);
      else log('error', 'lead_webhook_failed', { type, status: res.statusCode });
    });
    req.on('error', (err) => {
      if (retryCount === 0) setTimeout(() => doRequest(1), WEBHOOK_RETRY_DELAY_MS);
      else log('error', 'lead_webhook_failed', { type, err: err.message });
    });
    req.setTimeout(WEBHOOK_TIMEOUT_MS, () => { req.destroy(); });
    req.end(body);
  }
  doRequest(0);
}

function readNdjson(filename) {
  const filePath = path.join(DATA_DIR, filename);
  if (!fs.existsSync(filePath)) return [];
  return fs.readFileSync(filePath, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map(line => { try { return JSON.parse(line); } catch { return null; } })
    .filter(Boolean);
}

/* Admin auth is in server/middleware/admin-auth.js (timing-safe + audit) */

/* =========================================================
   READINESS (dependencies + disk)
   ========================================================= */
async function runReadinessChecks() {
  const checks = { env: true, dataDir: false, logsDir: false, marketcheck: false };
  if (config.isProd) {
    checks.env = !!(config.ADMIN_TOKEN && config.MARKETCHECK_API_KEY && config.ALLOWED_ORIGINS.size);
  }
  try { fs.accessSync(DATA_DIR, fs.constants.W_OK); checks.dataDir = true; } catch { /* not writable */ }
  try { fs.accessSync(LOG_DIR, fs.constants.W_OK); checks.logsDir = true; } catch { /* not writable */ }
  if (API_KEY) {
    try {
      await Promise.race([
        mcFetch('/search/car/active', { rows: '1', start: '0', country: 'us' }),
        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 5000)),
      ]);
      checks.marketcheck = true;
    } catch { /* upstream fail or timeout */ }
  } else {
    checks.marketcheck = true; /* skip when no key */
  }
  return checks;
}

/* =========================================================
   STATIC CACHE POLICY
   ========================================================= */
const LONG_CACHE_EXTS = new Set(['.css', '.js', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp', '.woff', '.woff2']);

/* =========================================================
   REQUEST TIMING MIDDLEWARE
   ========================================================= */
function requestTimer(req) {
  const start = process.hrtime.bigint();
  return () => {
    const diff = Number(process.hrtime.bigint() - start) / 1e6;
    return Math.round(diff * 100) / 100;
  };
}

/* =========================================================
   SERVER
   ========================================================= */
const server = http.createServer(async (req, res) => {
  const elapsed = requestTimer(req);
  const ip = getClientIP(req);
  applySecurityHeaders(res);

  /* P1: HTTPS + canonical host redirect (proxy-aware) */
  if (redirectIfNeeded(req, res, {
    isProd: config.isProd,
    sslEnforced: config.SSL_ENFORCED,
    canonicalHost: config.CANONICAL_HOST,
    publicBaseUrl: config.PUBLIC_BASE_URL,
  })) return;

  res.on('finish', () => {
    log('info', 'request', {
      method: req.method,
      url: req.url,
      status: res.statusCode,
      ip,
      ms: elapsed(),
      ua: (req.headers['user-agent'] || '').slice(0, 80),
    });
  });

  /* 30-second overall request timeout */
  req.setTimeout(30000);
  res.setTimeout(30000, () => {
    if (!res.headersSent) {
      res.writeHead(408, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Request timeout' }));
    }
  });

  /* Health check */
  if (req.url === '/health') {
    const uptime = process.uptime();
    const mem = process.memoryUsage();
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({
      status: 'ok',
      uptime: Math.round(uptime),
      memoryMB: Math.round(mem.heapUsed / 1048576),
      cacheKeys: Object.keys(_cache).length,
      version: '2.0.0',
    }));
    return;
  }

  /* Avoid noisy browser/devtools 404s */
  if (req.url === '/favicon.ico') {
    res.writeHead(200, { 'Content-Type': 'image/x-icon', 'Cache-Control': 'public, max-age=86400' });
    res.end();
    return;
  }
  if (req.url === '/.well-known/appspecific/com.chrome.devtools.json') {
    res.writeHead(204, { 'Cache-Control': 'public, max-age=86400' });
    res.end();
    return;
  }

  /* Legacy/non-project frontend probes: keep console clean (temporary no-op) */
  if (req.url.startsWith('/backend-api/')) {
    const pathOnly = req.url.split('?')[0];
    if (pathOnly === '/backend-api/ca/v2/u_connection_status') {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify({ connected: true, source: 'stub' }));
      return;
    }
    if (pathOnly === '/backend-api/conversation/init') {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify({ ok: true, conversationId: null, source: 'stub' }));
      return;
    }
    res.writeHead(204, { 'Cache-Control': 'no-store' });
    res.end();
    return;
  }

  /* ── API routes ── */
  if (req.url.startsWith('/api/')) {
    const corsOk = handleCors(req, res, {
      allowedOrigins: config.ALLOWED_ORIGINS,
      isProd: config.isProd,
    });
    if (!corsOk) return;

    /* P1: Readiness (no rate limit) */
    if (req.url.split('?')[0] === '/api/readiness') {
      const checks = await runReadinessChecks();
      const ok = checks.env && checks.dataDir && checks.logsDir && checks.marketcheck;
      res.writeHead(ok ? 200 : 503, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify({ ok, checks }));
      return;
    }

    /* Rate limit API routes */
    const rl = rateLimit(req, 'api');
    if (!rl.allowed) {
      res.writeHead(429, { 'Content-Type': 'application/json', 'Retry-After': String(rl.retryAfter) });
      res.end(JSON.stringify({ error: 'Too many requests', retryAfter: rl.retryAfter }));
      return;
    }

    /* ═══ POST /api/contact ═══ */
    if (req.method === 'POST' && req.url === '/api/contact') {
      const crl = rateLimit(req, 'contact');
      if (!crl.allowed) {
        res.writeHead(429, { 'Content-Type': 'application/json', 'Retry-After': String(crl.retryAfter) });
        res.end(JSON.stringify({ error: 'Too many submissions. Please try again later.', retryAfter: crl.retryAfter }));
        return;
      }
      try {
        const body = await readBody(req, BODY_LIMIT_LEAD_FORMS);
        const { name, email, message, phone, subject, vehicle, [HONEYPOT_FIELD]: honeypot, _t0: t0 } = body || {};
        if (honeypot && String(honeypot).trim() !== '') {
          jsonRes(req, res, 400, { error: 'Invalid request' });
          return;
        }
        const submittedAt = typeof t0 === 'number' ? t0 : parseInt(t0, 10);
        if (!Number.isFinite(submittedAt) || (Date.now() - submittedAt) < MIN_SUBMIT_MS) {
          jsonRes(req, res, 400, { error: 'Please wait a moment and try again.' });
          return;
        }
        if (!name || !email || !message) {
          jsonRes(req, res, 400, { error: 'Missing required fields: name, email, message' });
          return;
        }
        if (!isValidEmail(email)) {
          jsonRes(req, res, 400, { error: 'Invalid email format' });
          return;
        }
        const lead = {
          name, email, message,
          phone: phone || null,
          subject: subject || null,
          vehicle: vehicle || null,
          source: req.headers.referer || 'direct',
          ip,
        };
        appendNdjson('contact.ndjson', lead);
        sendLeadToWebhook('contact', lead);
        log('info', 'lead_captured', { type: 'contact', email, name });
        res.writeHead(201, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
        res.end(JSON.stringify({ success: true, message: 'Message received. We will get back to you within 24 hours.' }));
      } catch (err) {
        jsonRes(req, res, 400, { error: err.message || 'Invalid request' });
      }
      return;
    }

    /* ═══ POST /api/newsletter ═══ */
    if (req.method === 'POST' && req.url === '/api/newsletter') {
      const nrl = rateLimit(req, 'newsletter');
      if (!nrl.allowed) {
        res.writeHead(429, { 'Content-Type': 'application/json', 'Retry-After': String(nrl.retryAfter) });
        res.end(JSON.stringify({ error: 'Too many subscriptions. Please try again later.', retryAfter: nrl.retryAfter }));
        return;
      }
      try {
        const body = await readBody(req, BODY_LIMIT_LEAD_FORMS);
        const { email, [HONEYPOT_FIELD]: honeypot, _t0: t0 } = body || {};
        if (honeypot && String(honeypot).trim() !== '') {
          jsonRes(req, res, 400, { error: 'Invalid request' });
          return;
        }
        const submittedAt = typeof t0 === 'number' ? t0 : parseInt(t0, 10);
        if (!Number.isFinite(submittedAt) || (Date.now() - submittedAt) < MIN_SUBMIT_MS) {
          jsonRes(req, res, 400, { error: 'Please wait a moment and try again.' });
          return;
        }
        if (!email) {
          jsonRes(req, res, 400, { error: 'Missing required field: email' });
          return;
        }
        if (!isValidEmail(email)) {
          jsonRes(req, res, 400, { error: 'Invalid email format' });
          return;
        }
        const record = { email, source: req.headers.referer || 'direct', ip };
        appendNdjson('newsletter.ndjson', record);
        sendLeadToWebhook('newsletter', record);
        log('info', 'lead_captured', { type: 'newsletter', email });
        res.writeHead(201, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
        res.end(JSON.stringify({ success: true, message: 'Subscribed successfully!' }));
      } catch (err) {
        jsonRes(req, res, 400, { error: err.message || 'Invalid request' });
      }
      return;
    }

    /* ═══ POST /api/account-request ═══ */
    if (req.method === 'POST' && req.url === '/api/account-request') {
      const arl = rateLimit(req, 'account');
      if (!arl.allowed) {
        res.writeHead(429, { 'Content-Type': 'application/json', 'Retry-After': String(arl.retryAfter) });
        res.end(JSON.stringify({ error: 'Too many requests. Please try again later.', retryAfter: arl.retryAfter }));
        return;
      }
      try {
        const body = await readBody(req, BODY_LIMIT_LEAD_FORMS);
        const { name, email, [HONEYPOT_FIELD]: honeypot, _t0: t0 } = body || {};
        if (honeypot && String(honeypot).trim() !== '') {
          jsonRes(req, res, 400, { error: 'Invalid request' });
          return;
        }
        const submittedAt = typeof t0 === 'number' ? t0 : parseInt(t0, 10);
        if (!Number.isFinite(submittedAt) || (Date.now() - submittedAt) < MIN_SUBMIT_MS) {
          jsonRes(req, res, 400, { error: 'Please wait a moment and try again.' });
          return;
        }
        if (!email) {
          jsonRes(req, res, 400, { error: 'Missing required field: email' });
          return;
        }
        if (!isValidEmail(email)) {
          jsonRes(req, res, 400, { error: 'Invalid email format' });
          return;
        }
        const record = {
          name: name || null,
          email,
          source: req.headers.referer || 'direct',
          ip,
        };
        appendNdjson('account-requests.ndjson', record);
        sendLeadToWebhook('account-request', record);
        sendAccountConfirmationEmail(record.email, record.name);
        log('info', 'lead_captured', { type: 'account', email });
        res.writeHead(201, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
        res.end(JSON.stringify({ success: true, message: 'Account request received. We will email you with steps to create your account.' }));
      } catch (err) {
        jsonRes(req, res, 400, { error: err.message || 'Invalid request' });
      }
      return;
    }

    /* ═══ POST /api/chat/stream — AI Advisor streaming (token-by-token) ═══ */
    if (req.method === 'POST' && req.url === '/api/chat/stream') {
      const chatRl = rateLimit(req, 'api');
      if (!chatRl.allowed) {
        res.writeHead(429, { 'Content-Type': 'application/json', 'Retry-After': String(chatRl.retryAfter) });
        res.end(JSON.stringify({ error: 'Too many requests', retryAfter: chatRl.retryAfter }));
        return;
      }
      readBody(req).then(body => {
        const prompt = (body && body.prompt) ? String(body.prompt).trim() : '';
        res.writeHead(200, {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'no-store',
          'X-Accel-Buffering': 'no',
        });
        if (!prompt) {
          res.end('Tell me your budget, body type, or brand and I\'ll suggest the best deals.');
          return;
        }
        /* Placeholder: stream a short reply word-by-word. Replace with real LLM streaming later. */
        const reply = 'Based on your search, I recommend checking our Inventory for matching listings. Use the filters (make, price, body type) to narrow it down. We\'ll have full AI recommendations soon.';
        const tokens = reply.split(/(\s+)/).filter(Boolean);
        let i = 0;
        function sendNext() {
          if (i >= tokens.length) {
            res.end();
            return;
          }
          res.write(tokens[i]);
          i += 1;
          if (i < tokens.length) setImmediate(sendNext);
          else res.end();
        }
        setImmediate(sendNext);
      }).catch(() => {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid request body' }));
      });
      return;
    }

    /* Parse pathname for admin routes */
    const adminUrl = new URL(req.url, `http://localhost:${PORT}`);
    const pathname = adminUrl.pathname;

    /* ═══ ADMIN: GET /api/admin/leads ═══ */
    if (pathname === '/api/admin/leads' && req.method === 'GET') {
      if (!adminAuth(req, res, { adminToken: config.ADMIN_TOKEN, log, getClientIP })) return;
      const arl = rateLimit(req, 'admin');
      if (!arl.allowed) {
        res.writeHead(429, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Rate limited' }));
        return;
      }
      const u2 = new URL(req.url, `http://localhost:${PORT}`);
      const type = u2.searchParams.get('type') || 'all';
      const limit = clampInt(u2.searchParams.get('limit'), 1, 500, 100);
      const since = u2.searchParams.get('since') || null;

      let contacts = type === 'newsletter' ? [] : readNdjson('contact.ndjson');
      let newsletters = type === 'contact' ? [] : readNdjson('newsletter.ndjson');

      if (since) {
        const sinceTs = new Date(since).toISOString();
        contacts = contacts.filter(c => c._ts >= sinceTs);
        newsletters = newsletters.filter(n => n._ts >= sinceTs);
      }

      contacts = contacts.slice(-limit).reverse();
      newsletters = newsletters.slice(-limit).reverse();

      jsonRes(req, res, 200, {
        contacts: { count: contacts.length, items: contacts },
        newsletters: { count: newsletters.length, items: newsletters },
        stats: {
          totalContacts: readNdjson('contact.ndjson').length,
          totalNewsletters: readNdjson('newsletter.ndjson').length,
        },
      }, NOINDEX_HEADER);
      return;
    }

    /* ═══ ADMIN: POST /api/admin/featured ═══ */
    if (pathname === '/api/admin/featured' && req.method === 'POST') {
      if (!adminAuth(req, res, { adminToken: config.ADMIN_TOKEN, log, getClientIP })) return;
      try {
        const body = await readBody(req);
        const { listingId, dealerId, priority, expiresInDays } = body || {};
        if (!listingId) {
          jsonRes(req, res, 400, { error: 'listingId required' });
          return;
        }
        const featured = loadFeatured();
        featured.push({
          listingId,
          dealerId: dealerId || null,
          priority: priority || 1,
          expires: expiresInDays ? Date.now() + expiresInDays * 86400000 : null,
          createdAt: new Date().toISOString(),
        });
        saveFeatured(featured);
        log('info', 'featured_listing_added', { listingId, dealerId });
        jsonRes(req, res, 201, { success: true, count: featured.length }, NOINDEX_HEADER);
      } catch (err) {
        jsonRes(req, res, 400, { error: err.message });
      }
      return;
    }

    /* ═══ ADMIN: GET /api/admin/featured ═══ */
    if (pathname === '/api/admin/featured' && req.method === 'GET') {
      if (!adminAuth(req, res, { adminToken: config.ADMIN_TOKEN, log, getClientIP })) return;
      jsonRes(req, res, 200, { featured: loadFeatured() }, NOINDEX_HEADER);
      return;
    }

    /* ═══ ADMIN: GET /api/admin/stats ═══ */
    if (pathname === '/api/admin/stats' && req.method === 'GET') {
      if (!adminAuth(req, res, { adminToken: config.ADMIN_TOKEN, log, getClientIP })) return;
      const contacts = readNdjson('contact.ndjson');
      const newsletters = readNdjson('newsletter.ndjson');
      const now = new Date();
      const todayStr = now.toISOString().slice(0, 10);
      const weekAgo = new Date(now - 7 * 86400000).toISOString();

      jsonRes(req, res, 200, {
        leads: {
          totalContacts: contacts.length,
          totalNewsletters: newsletters.length,
          contactsToday: contacts.filter(c => c._ts?.startsWith(todayStr)).length,
          contactsThisWeek: contacts.filter(c => c._ts >= weekAgo).length,
          newslettersThisWeek: newsletters.filter(n => n._ts >= weekAgo).length,
        },
        server: {
          uptime: Math.round(process.uptime()),
          memoryMB: Math.round(process.memoryUsage().heapUsed / 1048576),
          cacheKeys: Object.keys(_cache).length,
        },
        featured: loadFeatured().length,
      }, NOINDEX_HEADER);
      return;
    }

    /* GET API routes */
    const handled = await handleAPI(req.url, req, res);
    if (handled) return;
    jsonRes(req, res, 404, { error: 'Unknown API endpoint' });
    return;
  }

  /* ── Static files ── */
  let filePath = req.url === '/' ? '/index.html' : req.url;
  filePath = filePath.split('?')[0];
  if (!path.extname(filePath)) filePath += '.html';

  const fullPath = path.join(__dirname, 'public', filePath);
  const ext = path.extname(fullPath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(fullPath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        fs.readFile(path.join(__dirname, 'public', '404.html'), (_, c404) => {
          res.writeHead(404, { 'Content-Type': 'text/html' });
          res.end(c404 || '<h1>404 - Page Not Found</h1>');
        });
      } else { res.writeHead(500); res.end('Server Error'); }
    } else {
      const cacheHeader = LONG_CACHE_EXTS.has(ext)
        ? 'public, max-age=31536000, immutable'
        : 'public, max-age=300';
      res.setHeader('Cache-Control', cacheHeader);
      compressedWrite(req, res, 200, contentType, content);
    }
  });
});

/* =========================================================
   GRACEFUL SHUTDOWN
   ========================================================= */
let isShuttingDown = false;

function gracefulShutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  log('info', `Received ${signal}. Graceful shutdown starting...`);
  console.log(`\n  [${signal}] Shutting down gracefully...`);

  server.close(() => {
    log('info', 'Server closed. Flushing logs...');
    logStream.end();
    errStream.end();
    console.log('  Server closed. Goodbye.\n');
    process.exit(0);
  });

  setTimeout(() => {
    log('warn', 'Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('uncaughtException', (err) => {
  log('error', 'Uncaught exception', { err: err.message, stack: err.stack });
  console.error('[FATAL] Uncaught exception:', err);
  gracefulShutdown('uncaughtException');
});
process.on('unhandledRejection', (reason) => {
  log('error', 'Unhandled rejection', { reason: String(reason) });
  console.error('[WARN] Unhandled rejection:', reason);
});

/* =========================================================
   START
   ========================================================= */
server.listen(PORT, () => {
  const startMsg = [
    '',
    `  AutoElite v2.0 is live at http://localhost:${PORT}`,
    `  MarketCheck API: ${API_KEY ? 'Connected' : 'No key found'}`,
    `  CORS origins: ${config.ALLOWED_ORIGINS.size ? [...config.ALLOWED_ORIGINS].join(', ') : '(none configured — same-origin only)'}`,
    `  Rate limiting: ${RATE_LIMITS.api.max} req/min per IP`,
    `  Compression: gzip + brotli`,
    `  Cache: 5min fresh / 30min stale-while-revalidate`,
    `  Pipeline: dedup → market context → featured boost → rank → diversity`,
    `  Logs: ${LOG_DIR}`,
    '',
  ].join('\n');
  console.log(startMsg);
  log('info', 'Server started', { port: PORT, version: '2.0.0' });
});
