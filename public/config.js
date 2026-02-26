/**
 * REQUIRED when frontend is on Cloudflare Pages (nightdrive.store / *.pages.dev).
 * Set this to your Node backend URL (Render or Railway) so the site can load real cars.
 * No trailing slash. Leave empty only when the Node server serves both HTML and API (same origin).
 *
 * Examples:
 *   Render:  window.ND_API_BASE = 'https://nightdrive.onrender.com';
 *   Railway: window.ND_API_BASE = 'https://nightdrive-production-xxxx.up.railway.app';
 */
// Local dev should use same-origin API (node server on localhost).
// Hosted frontend can use:
// - Same-origin API routes on Vercel (/api/...) when on *.vercel.app or nightdrive.store
// - Render/Railway backend URL for other hosts (e.g. Cloudflare Pages)
const _ndHost = (typeof window !== 'undefined' && window.location && window.location.hostname) ? window.location.hostname : '';
const _isLocal = _ndHost === 'localhost' || _ndHost === '127.0.0.1' || _ndHost === '::1';
// Treat any *.vercel.app and any *.nightdrive.store (root or www) as same-origin API (Vercel routes).
const _isVercelLike = _ndHost.endsWith('.vercel.app') || _ndHost === 'nightdrive.store' || _ndHost.endsWith('.nightdrive.store');
// On local + Vercel, hit same-origin /api/* (Vercel functions).
// On other hosts (e.g. Cloudflare Pages), talk to Render backend.
window.ND_API_BASE = (_isLocal || _isVercelLike) ? '' : 'https://nightdrive.onrender.com';
