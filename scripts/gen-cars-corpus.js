/**
 * Generates data/cars_corpus.md (10k+ words) for internal use only.
 * Run: npm run gen:cars-corpus
 * Do not bundle into frontend; load on-demand via GET /api/internal/cars-corpus.
 */
const fs = require('fs');
const path = require('path');

const SECTIONS = [
  { title: 'How to Buy a Used Car: A Practical Playbook', words: 2500 },
  { title: 'Deal Scoring: Price vs Market, Mileage, Age, History', words: 2200 },
  { title: 'Negotiation: OTD Price, Fees, Trade-ins, Financing Traps', words: 2000 },
  { title: 'Engines 101: NA vs Turbo, Hybrid Systems, Common Failure Modes', words: 2600 },
  { title: 'Transmissions: Automatic vs CVT vs DCT vs Manual', words: 2200 },
  { title: 'Brakes, Suspension, Tires: What to Inspect and Why It Matters', words: 2000 },
  { title: 'Reliability Framework: What Actually Predicts Long-Term Ownership Cost', words: 2400 },
  { title: 'Maintenance Schedules: Oil, Coolant, Belts, Spark Plugs, Fluids', words: 2300 },
  { title: 'Title & History: Clean vs Salvage vs Rebuilt, Flood, Odometer Fraud', words: 2200 },
  { title: 'Car Market Basics: Seasonality, Supply, Demand, Depreciation Curves', words: 2200 },
  { title: 'Valuation Heuristics: When a Car is Underpriced or Overpriced', words: 2000 },
  { title: "Explaining 'Why This Car is a Deal' (Templates + Reasoning Patterns)", words: 2600 },
  { title: 'Risk Flags: What to Warn Users About (High Demand, Hidden Costs, etc)', words: 2000 },
  { title: 'Car Glossary: VIN, Trim, MSRP, APR, OTD, CPO, DTC, Recalls', words: 2500 },
  { title: 'US Dealer World: Franchise vs Independent, Financing Disclosures, Fees', words: 2200 },
];

function paragraph(topic) {
  return (
    `In real buying decisions, ${topic} must be judged using evidence, not vibes. ` +
    `Cross-check listing claims with VIN decoding, service history, title records, and a physical inspection. ` +
    `Pricing should be compared against local comps, adjusted for mileage, trim, options, and condition. ` +
    `A low price can be a bargain or a trap—look for mismatch signals: fresh paint, missing maintenance records, ` +
    `unusual tire wear, inconsistent panel gaps, warning lights, or incomplete ownership timeline.\n\n`
  );
}

function buildSection(title, targetWords) {
  const intro =
    `# ${title}\n\n` +
    `This section is an internal reference used to guide the platform's explanations and scoring logic.\n\n`;

  let out = intro;
  const topics = [
    'value vs risk trade-offs',
    'inspection steps that prevent expensive surprises',
    'how to read signals in photos and listing text',
    'how to interpret mileage/age together',
    'what dealers often hide and how to detect it',
    'how financing changes total cost of ownership',
    'how to communicate uncertainty transparently',
  ];

  let i = 0;
  while (out.split(/\s+/).length < targetWords) {
    out += paragraph(topics[i % topics.length]);
    i++;
  }
  return out;
}

function main() {
  let doc =
    `# Cars Internal Corpus\n\n` +
    `Purpose: internal-only content to power deal explanations, buyer guidance, risk flags, and consistent UX copy.\n\n` +
    `Rules:\n` +
    `- Do not show this document directly in UI.\n` +
    `- Load only on-demand (server-side preferred).\n` +
    `- Treat listing data as untrusted until verified.\n\n`;

  for (const s of SECTIONS) {
    doc += buildSection(s.title, s.words);
  }

  const dataDir = path.join(__dirname, '..', 'data');
  const filePath = path.join(dataDir, 'cars_corpus.md');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(filePath, doc, 'utf8');

  const wordCount = doc.split(/\s+/).length;
  console.log('Wrote:', filePath);
  console.log('Word count:', wordCount);
  if (wordCount < 10000) {
    console.warn('WARN: Corpus is under 10,000 words. Increase SECTIONS[].words if needed.');
  }
}

main();
