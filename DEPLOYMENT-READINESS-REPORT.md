# Deployment Readiness Report — NightDrive / AutoElite

**App:** Node.js car marketplace (MarketCheck + optional eBay), static frontend  
**Version:** 2.0.0  
**Date:** 2026-02-18  
**Purpose:** For expert review before production deploy. Use this to decide **go / no-go** and what to fix first.

---

## 1. Executive Summary

| Area | Status | Notes |
|------|--------|------|
| **Security** | ⚠️ Needs work | Admin token has default; CORS; no HTTPS in app |
| **Config & secrets** | ⚠️ Needs work | Env documented; production values must be set |
| **Runtime & process** | ✅ Good | Graceful shutdown, timeouts, PM2 config |
| **Observability** | ✅ Adequate | Health check, file logs, request logging |
| **Data & persistence** | ✅ OK | File-based (ndjson + JSON); dirs created if missing |
| **Infrastructure** | ⚠️ Gaps | No HTTPS/redirect in app; reverse proxy assumed |
| **Content & branding** | ⚠️ Inconsistent | Mix of nightdrive.store and autoelite.com in HTML/sitemap |

**Verdict:** **Not yet “deploy and forget.”** Fix security and config items, then deploy behind a reverse proxy (HTTPS + host). The rest can be iterated post-launch.

---

## 2. What’s in Good Shape

### 2.1 Process & reliability
- **Health endpoint:** `GET /health` returns JSON (status, uptime, memory, cache keys, version). Suitable for load balancer / orchestrator checks.
- **Graceful shutdown:** Handles `SIGTERM` / `SIGINT`; closes server, flushes logs, 10s forced exit.
- **Error handling:** `uncaughtException` and `unhandledRejection` logged and trigger shutdown (no silent crashes).
- **Timeouts:** 30s request timeout; 12s upstream timeout for MarketCheck.

### 2.2 Security headers (every response)
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` (geolocation self; camera/mic off)
- **CSP** (script, style, font, img, connect, frame-ancestors, base-uri, form-action)
- **HSTS** when `NODE_ENV=production` (1 year, includeSubDomains, preload)

### 2.3 Rate limiting (in-memory, per IP)
- API: 60/min  
- Contact form: 10/hour  
- Newsletter: 5/hour  
- Admin: 30/min  

### 2.4 Request safety
- JSON body limit: 1 MB (then connection destroyed).
- Admin routes protected by `Authorization: Bearer <ADMIN_TOKEN>`.

### 2.5 Data & logging
- **Leads:** `data/contact.ndjson`, `data/newsletter.ndjson` (append-only).
- **Featured listings:** `data/featured.json`.
- **Logs:** `logs/server.log`, `logs/error.log` (JSON lines); PM2 can write to `logs/` as well.
- **.gitignore:** `.env`, `data/`, `logs/` are ignored (secrets and runtime data not committed).

### 2.6 Deployment tooling
- **PM2:** `ecosystem.config.js` present (single instance, 512M limit, restart policy, graceful kill/listen timeouts).
- **Scripts:** `npm run start`, `pm2:start`, `pm2:restart`, `pm2:logs`, `pm2:setup` (with logrotate hints).
- **Node:** `engines.node": ">=18.0.0"` in package.json.

---

## 3. Must Fix Before Production

### 3.1 Admin token default (critical)
- **Where:** `server.js` — `ADMIN_TOKEN = env.ADMIN_TOKEN || 'autoelite-admin-2026'`.
- **Risk:** If `.env` is missing or `ADMIN_TOKEN` is not set, anyone who knows the default can access admin endpoints (leads, featured, stats).
- **Action:** Remove the fallback. Require `ADMIN_TOKEN` in production and fail start (or refuse admin routes) when it’s missing. E.g. in production: `if (env.NODE_ENV === 'production' && !env.ADMIN_TOKEN) { console.error('ADMIN_TOKEN required'); process.exit(1); }`.

### 3.2 CORS in production
- **Current:** If `ALLOWED_ORIGINS` is empty, the code sends `Access-Control-Allow-Origin: <request origin>` (any origin).
- **Risk:** Any website can call your API (CSRF / data scraping).
- **Action:** For production, always set `ALLOWED_ORIGINS` to the exact production domain(s) (e.g. `https://nightdrive.store`). Do not deploy with empty `ALLOWED_ORIGINS` in production.

### 3.3 Environment variables checklist
Production must set (no defaults for secrets):

| Variable | Required | Notes |
|----------|----------|--------|
| `MARKETCHECK_API_KEY` | Yes | No inventory without it |
| `ADMIN_TOKEN` | Yes | Strong random value; no default in prod |
| `NODE_ENV` | Yes | Set to `production` |
| `PORT` | Optional | Default 1335 |
| `ALLOWED_ORIGINS` | Yes (prod) | Exact front-end origin(s) |
| `EBAY_CLIENT_ID` / `EBAY_CLIENT_SECRET` | Optional | Both or neither |
| `EBAY_ENVIRONMENT` | If using eBay | `sandbox` or `production` |
| `INTERNAL_CORPUS_KEY` | Optional | For `/api/internal/cars-corpus` |

---

## 4. Recommended Before / At Deploy

### 4.1 HTTPS and host
- The app does **not** listen on TLS and does **not** redirect HTTP → HTTPS.
- **Recommended:** Run the app on localhost (or internal port) and put **Nginx / Caddy / cloud LB** in front for:
  - TLS termination
  - HTTP → HTTPS redirect
  - Host header and (if needed) rate limiting / DDoS protection

### 4.2 Branding and public URLs
- **Canonical/OG URLs:** Some pages use `nightdrive.store`, others `autoelite.com` (e.g. about, contact, sitemap, robots).
- **Action:** Choose one production domain and:
  - Update all canonicals, og:url, og:image, twitter URLs in HTML.
  - Set `sitemap.xml` and `robots.txt` to that domain.
  - Set `ALLOWED_ORIGINS` to that domain.

### 4.3 Data and logs on the server
- **data/:** Create (or ensure deploy creates) `data/` and ensure the process has write permission. Same for `logs/`.
- **Backups:** Plan backup/retention for `data/*.ndjson` and `data/featured.json` (and logs if you need them).

### 4.4 Optional hardening
- **INTERNAL_CORPUS_KEY:** If you use `/api/internal/cars-corpus`, set a strong secret and restrict who can send `X-Internal-Key`.
- **CSP connect-src:** Currently `'self' https://nominatim.openstreetmap.org`. If you add more APIs (e.g. analytics), extend CSP instead of opening to `*`.

---

## 5. Post-Launch Improvements (Non-Blocking)

- **Structured health:** Add dependency checks (e.g. “can we reach MarketCheck?”) and expose in `/health` or a separate `/ready` for k8s-style probes.
- **Rate limit storage:** Current limiter is in-memory; restarts reset it. For multi-instance or strict limits, consider Redis (or similar).
- **Log aggregation:** Send `logs/server.log` / `error.log` to a central log service for alerts and search.
- **Monitoring:** Basic alerts on `/health` (e.g. 5xx or timeout) and disk usage for `data/` and `logs/`.

---

## 6. Quick Pre-Deploy Checklist (for expert)

- [ ] `ADMIN_TOKEN` set in production env; no default used in prod.
- [ ] `ALLOWED_ORIGINS` set to production domain(s); never empty in prod.
- [ ] `MARKETCHECK_API_KEY` set and tested.
- [ ] `NODE_ENV=production` and `PORT` (if not 1335) set.
- [ ] Reverse proxy in front: HTTPS only, HTTP→HTTPS redirect.
- [ ] One production domain chosen; canonicals, sitemap, robots, CORS aligned.
- [ ] `data/` and `logs/` writable by process; backup strategy for `data/`.
- [ ] PM2 (or similar) used; process restarts on failure and on deploy.

---

## 7. Conclusion

The application is **structurally ready** for deployment (health, shutdown, limits, headers, logging, PM2). The main blockers are **security and config**: remove the admin token default and enforce CORS and env in production. After that, deploy behind HTTPS and a single public host, then iterate on branding, backups, and observability.

**Suggested expert verdict:**  
**Conditional go:** deploy after fixing §3.1 and §3.2 and setting §3.3; use reverse proxy for HTTPS and host.
