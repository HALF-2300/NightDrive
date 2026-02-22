/**
 * CORS: fail-closed in production. No reflection of arbitrary origins.
 * Preflight from disallowed origin → 403.
 */
function handleCors(req, res, options) {
  const { allowedOrigins, isProd } = options;
  const origin = req.headers.origin;

  if (!origin) return true; // non-browser; continue

  if (isProd && allowedOrigins.size === 0) {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Origin not allowed' }));
    return false;
  }

  if (!allowedOrigins.has(origin)) {
    if (req.method === 'OPTIONS') {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Origin not allowed' }));
      return false;
    }
    res.setHeader('Vary', 'Origin');
    return true; // no ACAO header → browser will block cross-origin response
  }

  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Internal-Key');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return false;
  }
  return true;
}

module.exports = { handleCors };
