/**
 * Server-side pitch builder for car listings.
 * Returns the same section keys as the frontend buildPitch() for smoke tests and optional API use.
 * NightDrive / AutoElite sales-style: Top Pick, Why it's special, Specs snapshot, Deal note, Next steps.
 */

function fmt(p) {
  return '$' + Number(p).toLocaleString('en-US');
}

function fmtMi(m) {
  return m == null ? 'N/A' : Number(m).toLocaleString('en-US') + ' mi';
}

/**
 * @param {object} listing - Listing with build, _meta, price, miles, etc.
 * @returns {{ topPick: string, whySpecial: string, specsSnapshot: string, dealNote: string, nextSteps: string }}
 */
function buildPitch(listing) {
  const b = listing.build || {};
  const meta = listing._meta || {};
  const title = listing.heading || [b.year, b.make, b.model].filter(Boolean).join(' ').trim();
  const price = listing.price || 0;
  const miles = listing.miles;

  const topPick = meta.variant === 'best-value'
    ? `Top Pick: ${title} — hunted for value.`
    : meta.variant === 'low-mileage'
      ? `Night Pick: ${title} — low miles, high confidence.`
      : `Why ${title} — a strong option in its class.`;

  let whySpecial = '';
  if (meta.dealBadge === 'great-deal' && meta.medianPrice && price && price < meta.medianPrice) {
    const below = Math.round(meta.medianPrice - price);
    whySpecial = `Priced ${fmt(below)} below market. Clean history and solid specs make this one of the best deals we're showing right now.`;
  } else if ((meta.trustSignals || []).length >= 2) {
    whySpecial = `Verified VIN and strong trust signals. ${miles != null ? fmtMi(miles) + ' on the clock.' : ''} Ready to drive.`;
  } else if (meta.freshness >= 0.5) {
    whySpecial = `High demand listing. ${title} with the right mix of price and condition — get in before it's gone.`;
  } else {
    whySpecial = `${title} delivers on specs and presentation. ${miles != null ? fmtMi(miles) : 'Mileage on request.'} — worth a close look.`;
  }

  const parts = [];
  if (b.transmission) parts.push(b.transmission);
  if (b.drivetrain) parts.push(b.drivetrain);
  if (b.engine) parts.push(b.engine);
  if (listing.exterior_color) parts.push(listing.exterior_color);
  const specsSnapshot = parts.length
    ? parts.join(' · ')
    : [b.year, b.make, b.model].filter(Boolean).join(' ');

  let dealNote = '';
  if (meta.dealBadge === 'great-deal') {
    dealNote = 'Market context: This car is priced below our median for similar listings. Strong deal.';
  } else if (meta.dealBadge === 'above-market') {
    dealNote = 'Market context: Listed above typical range. Consider negotiating or comparing similar units.';
  } else {
    dealNote = 'Market context: Fair price for the segment. Compare similar listings to confirm.';
  }

  const nextSteps = 'Reserve this car to lock it in, or compare similar vehicles in our inventory. Fully refundable reservation.';

  return { topPick, whySpecial, specsSnapshot, dealNote, nextSteps };
}

module.exports = { buildPitch };
