/**
 * Downloads placeholder OG images (1200x630) so social shares don't look blank.
 * Run: node scripts/download-og-placeholders.js
 * Replace these with real branded images before launch.
 */
const https = require('https');
const fs = require('fs');
const path = require('path');

const IMAGES_DIR = path.join(__dirname, '..', 'public', 'images');
const SIZE = '1200x630';
const BG = '0a0e14';
const COLOR = 'c9a227';
const PAGES = [
  { file: 'og-home.jpg', text: 'NightDrive' },
  { file: 'og-about.jpg', text: 'About' },
  { file: 'og-contact.jpg', text: 'Contact' },
  { file: 'og-car.jpg', text: 'Vehicle' },
  { file: 'og-inventory.jpg', text: 'Inventory' },
];

function download(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function main() {
  if (!fs.existsSync(IMAGES_DIR)) fs.mkdirSync(IMAGES_DIR, { recursive: true });
  for (const { file, text } of PAGES) {
    const slug = encodeURIComponent(text);
    const url = `https://placehold.co/${SIZE}/${BG}/${COLOR}/jpg?text=${slug}`;
    try {
      const buf = await download(url);
      fs.writeFileSync(path.join(IMAGES_DIR, file), buf);
      console.log('OK', file);
    } catch (err) {
      console.error('FAIL', file, err.message);
    }
  }
  console.log('Done. Replace public/images/og-*.jpg with real branded images when ready.');
}

main();
