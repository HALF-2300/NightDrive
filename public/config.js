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
// Hosted frontend should use Render/Railway backend URL.
const _ndHost = (typeof window !== 'undefined' && window.location && window.location.hostname) ? window.location.hostname : '';
const _isLocal = _ndHost === 'localhost' || _ndHost === '127.0.0.1' || _ndHost === '::1';
window.ND_API_BASE = _isLocal ? '' : 'https://nightdrive.onrender.com';
