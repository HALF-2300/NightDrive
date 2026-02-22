/**
 * REQUIRED when frontend is on Cloudflare Pages (nightdrive.store / *.pages.dev).
 * Set this to your Node backend URL (Render or Railway) so the site can load real cars.
 * No trailing slash. Leave empty only when the Node server serves both HTML and API (same origin).
 *
 * Examples:
 *   Render:  window.ND_API_BASE = 'https://nightdrive.onrender.com';
 *   Railway: window.ND_API_BASE = 'https://nightdrive-production-xxxx.up.railway.app';
 */
window.ND_API_BASE = '';  // <-- Set to your backend URL (e.g. from Render or Railway)
