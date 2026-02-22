# Pre-launch checklist (P0/P1 + final adjustments done)

## Final adjustments (production-ready)

- **Real client IP (rate limiting)**  
  - `getClientIP` prefers **`CF-Connecting-IP`** (Cloudflare), then **`X-Forwarded-For`** when `TRUST_PROXY=1`. Set `TRUST_PROXY=1` behind a reverse proxy so limits apply per real visitor.

- **Webhook safety**  
  - Set **`LEAD_WEBHOOK_SECRET`**; outbound requests send **`X-Webhook-Signature: sha256=<HMAC-SHA256(body, secret)>`**. Verify this on the receiver (Zapier/Make/custom) so you don’t accept blind exfil.  
  - Timeout 8s, one retry after 2s. On failure we only log type and error message (no PII).

- **Payload limits**  
  - Global JSON body cap 1 MB. Contact and newsletter endpoints use a **32 KB** cap to limit POST abuse.

- **Security headers (static pages)**  
  - Applied on all responses: `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (camera/mic off, geolocation self), CSP, HSTS in production.

- **Operational**  
  - **Backup:** Run `node scripts/backup-leads.js` daily (e.g. cron `0 2 * * *`). Keeps last 14 daily copies in `data/backups/`.  
  - **New lead alerts:** Use the webhook in Zapier/Make to send yourself an email or Slack on new contact/newsletter so you don’t rely on checking files.

## P0 — Done

- **Lead storage durability**  
  - File append still used when `data/` is writable (e.g. VPS).  
  - Set **`LEAD_WEBHOOK_URL`** (Zapier/Make/CRM/webhook) so leads are POSTed there too. On serverless, set this and do not rely on local files. Set **`LEAD_WEBHOOK_SECRET`** and verify `X-Webhook-Signature` on the receiver.

- **Spam protection**  
  - IP rate limits: contact 10/hour, newsletter 5/hour.  
  - Honeypot field `website` (must be empty).  
  - Minimum 3s time-to-submit (`_t0`) on contact and newsletter.

- **No `href="#"`**  
  - Footer socials → `/contact`. Financing → `/contact?subject=Financing`.

- **OG images**  
  - Placeholders in `public/images/` (og-home.jpg, og-about.jpg, og-contact.jpg, og-car.jpg, og-inventory.jpg). Replace with real branded images when ready. Regenerate placeholders: `npm run gen:og-images`.

- **Indexing**  
  - `X-Robots-Tag: noindex, nofollow` on all `/api/admin/*` responses.  
  - `robots.txt`: `Disallow: /api/` and `Disallow: /admin`.

## P1 — Done

- **Contact map**  
  - “Open in Google Maps” link (Portland, OR). Update the link if your address changes.

- **Inventory disclaimer**  
  - One line: “Prices and availability subject to change. Verify details with the dealer before purchase.”

- **404**  
  - CTAs: Go home, Back to Inventory. Search form → `/inventory?q=...`.

- **Advisor label**  
  - “NightDrive Concierge” (button and panel). Chat is still placeholder until an LLM is wired.

## Optional (P2 / later)

- **Cloudflare Turnstile**  
  - Add on contact/newsletter if you want stronger bot protection (e.g. when behind Cloudflare).

- **Analytics**  
  - Add Plausible/GA only if you’ll use it; update Privacy policy if you do.

- **Email on new leads**  
  - Webhook can trigger Zapier/Make to email you so you don’t rely on checking files. (Script: `scripts/backup-leads.js` for file backup.)

- **Monitoring**  
  - Uptime check, error logs. Daily backup: `npm run backup-leads` or cron `0 2 * * * node scripts/backup-leads.js`.
