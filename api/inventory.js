export default async function handler(req, res) {
  const key = process.env.MARKETCHECK_API_KEY;
  if (!key) {
    res.status(500).json({ error: 'MARKETCHECK_API_KEY is not configured on the server.' });
    return;
  }

  const url = 'https://api.marketcheck.com/v2/search/car/active?' + new URLSearchParams({
    api_key: key,
    rows: req.query.rows || '24',
    start: req.query.start || '0',
    country: req.query.country || 'us',
    zip: req.query.zip || '90210',
    radius: req.query.radius || '50',
  }).toString();

  try {
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    res.status(500).json({ error: 'MarketCheck request failed', message: err.message });
  }
}

