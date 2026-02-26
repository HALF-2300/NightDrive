export default async function handler(req, res) {
  try {
    const apiKey = process.env.MARKETCHECK_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: 'MARKETCHECK_API_KEY not found in environment',
      });
    }

    const response = await fetch(
      `https://api.marketcheck.com/v2/search/car/active?api_key=${apiKey}&rows=24`
    );

    if (!response.ok) {
      const text = await response.text();
      return res.status(response.status).json({
        error: 'MarketCheck error',
        status: response.status,
        body: text,
      });
    }

    const data = await response.json();
    const listings = Array.isArray(data.listings) ? data.listings : [];

    // Shape the response like the Node backend: rails with up to 6 cards each.
    const rails = {
      editorPicks: listings.slice(0, 6),
      bestDeals: listings.slice(6, 12),
      lowMileage: listings.slice(12, 18),
      justArrived: listings.slice(18, 24),
    };

    return res.status(200).json({
      rails,
      totalAvailable: data.num_found || listings.length || 0,
      source: 'marketcheck-direct',
    });
  } catch (err) {
    return res.status(500).json({
      error: 'Server error',
      message: err.message,
    });
  }
}

