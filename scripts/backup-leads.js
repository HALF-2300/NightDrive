/**
 * Backup lead files (contact.ndjson, newsletter.ndjson) to data/backups/ with date suffix.
 * Rotate: keep last 14 daily backups.
 * Run daily via cron: 0 2 * * * cd /path/to/app && node scripts/backup-leads.js
 */
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const FILES = ['contact.ndjson', 'newsletter.ndjson'];
const RETAIN_DAYS = 14;

function main() {
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const date = new Date().toISOString().slice(0, 10);
  for (const f of FILES) {
    const src = path.join(DATA_DIR, f);
    if (!fs.existsSync(src)) continue;
    const dest = path.join(BACKUP_DIR, `${f.replace('.ndjson', '')}-${date}.ndjson`);
    fs.copyFileSync(src, dest);
    console.log('Backed up', f, '->', path.basename(dest));
  }
  const entries = fs.readdirSync(BACKUP_DIR, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.ndjson'))
    .map((e) => ({ name: e.name, mtime: fs.statSync(path.join(BACKUP_DIR, e.name)).mtime.getTime() }))
    .sort((a, b) => b.mtime - a.mtime);
  const toRemove = entries.slice(RETAIN_DAYS);
  for (const e of toRemove) {
    fs.unlinkSync(path.join(BACKUP_DIR, e.name));
    console.log('Rotated (removed)', e.name);
  }
}

main();
