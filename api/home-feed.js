export default async function handler(req, res) {
  try {
    const apiKey = process.env.MARKETCHECK_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: 'MARKETCHECK_API_KEY not found in environment',
      });
    }

    const response = await fetch(
      `https://api.marketcheck.com/v2/search/car/active?api_key=${apiKey}&rows=6`
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

    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({
      error: 'Server error',
      message: err.message,
    });
  }
}

