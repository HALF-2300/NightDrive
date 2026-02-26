export default function handler(req, res) {
  res.status(200).json({
    hasKey: !!process.env.MARKETCHECK_API_KEY,
    keyLength: process.env.MARKETCHECK_API_KEY
      ? process.env.MARKETCHECK_API_KEY.length
      : 0,
    runtime: process.env.VERCEL ? 'vercel' : 'unknown',
  });
}

