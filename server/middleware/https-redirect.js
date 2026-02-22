/**
 * HTTPS redirect (proxy-aware) + canonical host redirect.
 * Only when SSL_ENFORCED=1 and/or canonical host is configured.
 * Returns true if response was sent (redirect); false to continue.
 */
function redirectIfNeeded(req, res, options) {
  const { isProd, sslEnforced, canonicalHost, publicBaseUrl } = options;
  if (!isProd) return false;

  const host = (req.headers.host || '').split(':')[0].toLowerCase();
  const xfProto = (req.headers['x-forwarded-proto'] || '').toString().toLowerCase();
  const url = req.url || '/';

  // HTTP → HTTPS (when proxy says it was HTTP)
  if (sslEnforced && xfProto && xfProto !== 'https') {
    const location = `https://${req.headers.host || canonicalHost}${url}`;
    res.writeHead(301, { Location: location });
    res.end();
    return true;
  }

  // Canonical host: redirect if Host is not exactly the canonical host (e.g. www -> apex)
  const canonicalNorm = canonicalHost.toLowerCase().replace(/^www\./, '');
  const hostNorm = host.toLowerCase().replace(/^www\./, '');
  if (hostNorm !== canonicalNorm || host.toLowerCase() !== canonicalHost.toLowerCase()) {
    const location = `${publicBaseUrl}${url}`;
    res.writeHead(301, { Location: location });
    res.end();
    return true;
  }

  return false;
}

module.exports = { redirectIfNeeded };
