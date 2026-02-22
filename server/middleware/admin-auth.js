const crypto = require('crypto');

function safeEq(a, b) {
  const ab = Buffer.from(String(a ?? ''), 'utf8');
  const bb = Buffer.from(String(b ?? ''), 'utf8');
  if (ab.length !== bb.length) return false;
  if (ab.length === 0) return true;
  return crypto.timingSafeEqual(ab, bb);
}

/**
 * Admin auth: Bearer token with timing-safe compare + audit log.
 * Returns true if authorized; false and sends 401 if not.
 */
function checkAdmin(req, res, options) {
  const { adminToken, log, getClientIP } = options;
  const pathname = req.url?.split('?')[0] || '';
  const ip = getClientIP ? getClientIP(req) : (req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown');

  const hdr = req.headers.authorization || '';
  const token = hdr.startsWith('Bearer ') ? hdr.slice(7).trim() : '';
  const ok = !!(adminToken && safeEq(token, adminToken));

  if (log) {
    log('info', 'admin_auth', { adminAuth: true, ok, path: pathname, ip });
  }

  if (!ok) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Unauthorized' }));
    return false;
  }
  return true;
}

module.exports = { checkAdmin, safeEq };
