# AutoElite — Comprehensive Expert Audit Report

**Date:** February 16, 2026
**Auditor:** Development Team (Expert-Level)
**Scope:** Full codebase — `server.js`, 6 HTML pages, `style.css`, `app.js`, `.env`
**Method:** Static code analysis + live endpoint testing against `http://localhost:1335`

---

## 1) Executive Summary — Top 10 Issues by Impact

| # | Sev | Issue | Business / User Impact |
|---|-----|-------|------------------------|
| 1 | **P0** | **`about.html` uses 20+ CSS classes that don't exist in the stylesheet** | Entire About page renders as raw unstyled HTML — broken layout, no spacing, no cards, no CTA. Visitors see a white/black mess. |
| 2 | **P0** | **No security headers on any response** (no CSP, no X-Frame-Options, no X-Content-Type-Options, no HSTS) | Site vulnerable to clickjacking, XSS injection, MIME sniffing. Not deployable to production. |
| 3 | **P0** | **Wildcard CORS `Access-Control-Allow-Origin: *` on all API responses** | Any third-party website can call your `/api/*` endpoints and drain your MarketCheck API quota |
| 4 | **P1** | **FAQ on Contact page is completely broken** — inline `onclick` + JS event listener double-toggle cancels out | Clicking any FAQ question does nothing. Users can't get answers. Trust/conversion damage. |
| 5 | **P1** | **XSS vulnerability** — `seller_comments`, `dealer.name`, `heading` injected via `innerHTML` without sanitization | Malicious data in MarketCheck listings could execute scripts in your users' browsers |
| 6 | **P1** | **Contact form and newsletter submit to `alert()` only** — no backend handler | Every lead is permanently lost. Zero lead capture. Primary business function is non-functional. |
| 7 | **P1** | **No `Cache-Control` headers on static files** (HTML, CSS, JS) | Every page visit re-downloads all 100+ KB of assets. Verified: response headers show no cache directives. |
| 8 | **P1** | **Year filter on Inventory page is not wired in JS** | Users select a year range, click Apply, nothing happens. Filter appears broken. |
| 9 | **P2** | **No Open Graph / Twitter Card meta, no `robots.txt`, no `sitemap.xml`, no `favicon.ico`** | Invisible to search engines, no social media previews when shared, unprofessional browser tab |
| 10 | **P2** | **No rate limiting on API proxy** — uncapped `rows` parameter accepted | A single client can request `rows=999999` and get a 180 KB response. DoS / quota exhaustion risk. |

---

## 2) Technical Errors

### BUG-01: `about.html` — Entire page visually broken (P0)

**Error:** About page uses ~25 CSS class names from a previous stylesheet version. None exist in the current `style.css`.

**Where:** `/about` page — every section

**Steps to reproduce:** Navigate to `http://localhost:1335/about`

**Expected:** Premium dark-themed page matching the rest of the site.
**Actual:** Raw HTML with no background colors, no card styling, broken navbar layout, invisible CTA section.

**Broken class mapping:**

| HTML class (broken) | CSS equivalent (correct) | Section |
|---|---|---|
| `nav-container` | `nav-inner` | Navbar |
| `nav-actions` | `nav-right` | Navbar |
| `page-header` | `page-hero` | Page header |
| `text-gradient` | Not defined (remove or define) | Multiple headings |
| `section-tag` | `label` | Section labels |
| `section-header` | `section-top` | Section headers |
| `section-title` | `h2` class | Section headings |
| `section-subtitle` | `subtitle` | Section descriptions |
| `about-intro`, `about-intro-text` | `about-grid` | Intro section |
| `about-stats`, `about-stat` | `stats-bar`, `stat-item` | Stats bar |
| `about-stat .number` | `stat-val` | Stat values |
| `about-image` | `about-img` | Image placeholder |
| `btn-outline` | `btn-secondary` | CTA buttons |
| `btn-white` | Not defined | CTA section |
| `btn-outline-white` | Not defined | CTA section |
| `cta-banner` | `cta-section` | CTA section |
| `cta-content` | `cta-inner` | CTA layout |
| `cta-text` | Direct children of `cta-inner` | CTA text |
| `footer-col` | No class needed (grid handles) | Footer |
| `back-to-top` / `backToTop` | `btt` / `btt` | Back-to-top button |

**Additional breaks:** `style="background: var(--gray-50)"` on line 102 and `style="background: var(--white)"` on lines 110/115/120 — both CSS variables are undefined.

**Also:** Footer social links on about.html are missing `aria-label` attributes (present on all other pages).

**Root cause:** `about.html` was created with an earlier CSS naming convention and was never migrated to the V2 design system.

**Fix:** Rewrite `about.html` to use current design system classes.
**Confidence:** **High** — verified by cross-referencing every class in `about.html` against `style.css`
**Files affected:** `public/about.html`

---

### BUG-02: FAQ double-toggle — clicking does nothing (P1)

**Error:** Contact page FAQ items have both:
- Inline `onclick="this.classList.toggle('open')"` (contact.html lines 167, 176, 185, 194)
- JS event listener `item.addEventListener('click', () => item.classList.toggle('open'))` (app.js line 707)

Both fire on every click. First toggles 'open' ON, second immediately toggles it OFF. Net result: nothing happens.

**Where:** `/contact` — FAQ section

**Steps to reproduce:**
1. Go to `http://localhost:1335/contact`
2. Click any FAQ question
3. Answer does not appear

**Expected:** FAQ answer expands/collapses on click.
**Actual:** No visible change. Class is toggled twice, cancelling out.

**Root cause:** Inline handlers were left in the HTML when the JS event listener system was added in `app.js`.

**Fix:** Remove `onclick="this.classList.toggle('open')"` from all 4 FAQ items in `contact.html`. The JS handler in `app.js` already handles it plus adds keyboard support and ARIA attributes.
**Confidence:** **High** — logic is deterministic
**Files affected:** `public/contact.html`

---

### BUG-03: Year filter on Inventory page not connected (P1)

**Error:** The sidebar has "From year" and "To year" `<select>` elements (inventory.html lines 136-159), but `loadInventory()` in `app.js` never reads their values. No `year_range` parameter is sent to the API.

**Where:** `/inventory` — sidebar Year filter

**Steps to reproduce:**
1. Go to `http://localhost:1335/inventory`
2. Set "From" to 2025, "To" to 2026
3. Click "Apply Filters"
4. Results are unchanged — all years still shown

**Expected:** Only 2025-2026 vehicles returned.
**Actual:** Year filter is completely ignored.

**Root cause:** `loadInventory()` reads Make, Price, Body Type, Fuel, Transmission, Condition — but skips the year selects because they lack `id` attributes and aren't targeted by any query selector.

**Fix:** Add `id="filterYearFrom"` and `id="filterYearTo"` to the selects, then in `loadInventory()`:
```javascript
const yearFrom = document.getElementById('filterYearFrom')?.value;
const yearTo = document.getElementById('filterYearTo')?.value;
if (yearFrom || yearTo) qs.set('year_range', `${yearFrom || '2000'}-${yearTo || '2026'}`);
```
**Confidence:** **High**
**Files affected:** `public/inventory.html`, `public/js/app.js`

---

### BUG-04: XSS via `innerHTML` with untrusted API data (P1)

**Error:** Data from MarketCheck API is injected directly into the DOM via `innerHTML` without HTML entity escaping:
- `seller_comments` → detail page overview tab (app.js ~line 577)
- `dealer.name`, `dealer.street` → detail page (app.js ~lines 580-582)
- `listing.heading` → card title (app.js line 125, through template literal)

**Where:** `/car-details?id=...` and all car cards

**Steps to reproduce:** If a MarketCheck listing has `seller_comments` containing `<img src=x onerror=alert(1)>`, it will execute.

**Expected:** Text only, HTML tags escaped.
**Actual:** Raw HTML rendered.

**Fix:** Create an escape function:
```javascript
function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
```
Apply to all API-sourced strings before innerHTML injection.
**Confidence:** **High**
**Files affected:** `public/js/app.js`

---

### BUG-05: Search tabs (All / New / Pre-Owned) are decorative only (P2)

**Error:** The hero search module has 3 tabs (All, New, Pre-Owned) that toggle visual active state but don't affect the search query.

**Where:** Homepage search module

**Steps to reproduce:**
1. Click "New" tab
2. Click "Search vehicles"
3. Results include all conditions, not just new

**Expected:** "New" adds `car_type=new` to the inventory URL.
**Actual:** Tab state is purely visual, ignored by `setupHeroSearch()`.

**Fix:** In `setupHeroSearch()`, read the active tab's `data-tab` value and pass it as a URL parameter.
**Confidence:** **High**
**Files affected:** `public/js/app.js`

---

### BUG-06: `url.parse()` deprecation warning (P2)

**Error:** `server.js` line 323 uses `url.parse(reqUrl, true)`, which triggers:
```
(node:XXXX) [DEP0169] DeprecationWarning: url.parse() behavior is not standardized
```

**Where:** `server.js` — `handleAPI()` function, fires on every API request

**Fix:** Replace with:
```javascript
const parsed = new URL(reqUrl, 'http://localhost:' + PORT);
const q = Object.fromEntries(parsed.searchParams);
```
**Confidence:** **High**
**Files affected:** `server.js`

---

### BUG-07: `about.html` back-to-top button uses wrong class and ID (P3)

**Error:** `about.html` line 234: `<button class="back-to-top" id="backToTop">`. The CSS class is `btt` and `app.js` looks for `id="btt"`.

**Where:** `/about` page — bottom-right corner

**Actual:** Button is unstyled and JS doesn't wire up click/scroll handlers.

**Fix:** Change to `class="btt" id="btt"`.
**Confidence:** **High**
**Files affected:** `public/about.html`

---

### BUG-08: Stale migration script in project (P3)

**Error:** `scripts/release/run-migrations-005-008.sh` exists but is irrelevant — it contains a duplicated self-referencing shell command and has nothing to do with this project.

**Where:** `scripts/release/run-migrations-005-008.sh`

**Fix:** Delete the file and `scripts/` directory.
**Confidence:** **High**

---

## 3) Missing Technical Pieces

### Architecture / Config

| Item | Status | Impact | Effort |
|------|--------|--------|--------|
| `package.json` | **Missing** | No `npm start`, no dependency tracking, no version. Not a standard Node project. | 10 min |
| `.gitignore` | **Missing** | `.env` with API key will be committed if repo is initialized | 5 min |
| `robots.txt` | **Missing** | Search engines have no crawl guidance | 10 min |
| `sitemap.xml` | **Missing** | Search engines can't discover pages | 15 min |
| `favicon.ico` / `apple-touch-icon` | **Missing** | Browser tab shows default icon, unprofessional | 30 min |
| Health check endpoint (`/api/health`) | **Missing** | No way to monitor if server is alive for uptime services | 15 min |
| Environment validation on startup | **Missing** | Server starts silently with empty `API_KEY`, fails only on first user request | 15 min |
| Error logging to file | **Missing** | `console.error` only — lost when terminal closes | 1 hr |
| Process manager (PM2 / systemd) | **Missing** | Server crash = site down until manual restart | 30 min |

### Validation / Error Handling

| Item | Status | Evidence | Impact |
|------|--------|----------|--------|
| API input validation (rows, start) | **Missing** | Tested: `rows=999999` returns 180 KB response; `start=-5` returns empty array with no error | Quota abuse, unexpected behavior |
| Rate limiting | **Missing** | No middleware, no IP throttling | Any client can spam API endpoints |
| Request timeout for MarketCheck calls | **Missing** | `https.get()` has no timeout configured | If MarketCheck is slow, Node.js hangs indefinitely |
| Contact form server-side handler | **Missing** | Form submits to `alert()` — app.js line 719 | Leads permanently lost |
| Newsletter server-side handler | **Missing** | Form submits to `alert()` — app.js line 714 | Subscriptions go nowhere |
| API error differentiation | **Weak** | All errors return generic `500` — no distinction between 401 (bad key), 429 (rate limit), timeout, or parsing errors | User sees "API request failed" for everything |
| Graceful shutdown handler | **Missing** | `process.on('SIGTERM')` not implemented | Active requests dropped on restart |

### Tests

| Type | Count | Notes |
|------|-------|-------|
| Unit tests | **0** | No test framework, no test files, no `package.json` to define test script |
| Integration tests | **0** | No API endpoint tests |
| E2E tests | **0** | No browser automation (Playwright, Cypress, etc.) |
| Accessibility audit (automated) | **0** | No axe-core, pa11y, or lighthouse CI |
| Visual regression tests | **0** | No Percy, Chromatic, or screenshot comparison |

---

## 4) Design / UX Gaps

### Visual Inconsistencies

| Issue | Location | Severity | Evidence |
|-------|----------|----------|----------|
| `about.html` uses entirely different, non-existent CSS classes | `/about` | **P0** | See BUG-01 — 25 broken classes |
| `about.html` uses `var(--gray-50)` and `var(--white)` — undefined CSS variables | `/about` section backgrounds | **P0** | Lines 102, 110, 115, 120 |
| `about.html` navbar uses `nav-container` + `nav-actions` instead of `nav-inner` + `nav-right` | `/about` navbar | **P0** | Lines 20, 31 |
| `about.html` footer social links missing `aria-label` (present on all other pages) | `/about` footer | **P2** | Lines 192-195 vs. all other pages |
| `car-details.html` hardcodes "2026 BMW M4 Competition" in `<title>` before JS loads | `/car-details` | **P3** | Line 8 — should be generic until JS updates it |
| `index.html` footer "Browse by type" links use `?type=sports` and `?type=electric` | Footer | **P3** | These values don't map to MarketCheck body types; links return all results |

### Mobile / Responsive

| Issue | Breakpoint | Severity |
|-------|-----------|----------|
| `trust-line` and `card-dom` hidden at 480px — some trust signal / freshness data lost on mobile | `@media(max-width:480px)` | **P3** |
| Gallery thumbnails on car detail overflow horizontally without visible scroll indicator | 320-768px | **P3** |
| Inventory sidebar collapses to single-column grid on 768px, making filter area very long | 768px | **P3** |
| Brand marquee animation has no visible repeat gap — can look glitchy mid-scroll | All mobile | **P3** |

### Navigation / Usability Friction

| Issue | Severity |
|-------|----------|
| **Mobile menu doesn't close when a link is clicked** — user taps "Inventory", menu stays open during navigation | **P2** |
| Save/Favorite buttons don't persist — refreshing the page loses all saves (no `localStorage`) | **P2** |
| "Compare" feature is referenced in design spec but never implemented | **P3** |
| Footer "Privacy" and "Terms" links all go to `#` — dead links | **P3** |
| Footer "Financing" link goes to `#` — dead link | **P3** |
| No loading indicator when pagination changes (scrolls to top → then loads, user sees stale content) | **P3** |

### Accessibility

| Issue | Location | Severity | WCAG |
|-------|----------|----------|------|
| **Missing skip-link** | `index.html`, `404.html` | **P2** | 2.4.1 |
| FAQ items have both inline `onclick` AND JS handlers — keyboard handler works but click doesn't | `contact.html` | **P1** | 2.1.1 |
| Car card `<article>` elements should be in a list container for screen readers | Home page rails | **P3** | 1.3.1 |
| Form labels on contact page not associated with inputs via `for`/`id` pairing | `contact.html` | **P2** | 1.3.1 |
| `role="list"` on inventory grid but cards use `<article>` not `<li>` — semantic mismatch | `inventory.html` line 214 | **P3** | 4.1.2 |
| Image `onerror` handler creates fallback without `alt` or `role` attributes | `app.js` `listingCard()` | **P3** | 1.1.1 |
| `<select>` elements inside inventory sidebar lack visible labels for screen readers (Year "From"/"To" do have `aria-label`) | `inventory.html` | **P3** | 1.3.1 |

---

## 5) Performance

### Response Time Measurements (live test, localhost)

| Resource | Time | Notes |
|----------|------|-------|
| `index.html` (static) | **127 ms** | No gzip, no cache headers |
| `style.css` (43 KB) | ~50 ms | No gzip → ~43 KB over wire. With gzip: ~8 KB. |
| `app.js` (37 KB) | ~50 ms | No gzip → ~37 KB over wire. With gzip: ~9 KB. |
| `/api/home-feed` (cached) | **204 ms** | Good — 5-min TTL cache serving |
| `/api/inventory` (cold) | **2,020 ms** | Slow — single MarketCheck call, no cache for inventory |
| Font Awesome CDN (90 KB) | ~200-400 ms | Full library loaded for ~30 icons |
| Google Fonts (2 families) | ~150-300 ms | `display=swap` set — good |

### Asset Sizes (uncompressed, no build step)

| Asset | Raw Size | Minified (est.) | Gzipped (est.) |
|-------|----------|-----------------|----------------|
| `style.css` | 43,466 B | ~28 KB | ~7 KB |
| `app.js` | 37,062 B | ~22 KB | ~8 KB |
| `index.html` | 20,031 B | ~17 KB | ~5 KB |
| Font Awesome (CDN) | ~90 KB | N/A | ~30 KB |
| **Total first load** | **~190 KB** | | **~50 KB** with gzip |

### Core Web Vitals Risk Assessment

| Metric | Risk | Details |
|--------|------|---------|
| **LCP** | **Medium** | Home: hero text renders fast, but car images load after API call (~2s). Inventory: 2s+ cold API wait before any cards render. |
| **CLS** | **Low** | `aspect-ratio: 16/10` on card images prevents shift. Skeleton loaders match final geometry. Good. |
| **INP** | **Low** | No heavy JS on interaction. Smooth transitions. Good. |

### Bottlenecks & Fixes

| Bottleneck | Impact | Quick Win? | Effort |
|------------|--------|------------|--------|
| **No gzip/brotli compression** | 3-4x larger transfer for every asset | **Yes** | 30 min |
| **No `Cache-Control` on static files** | Full re-download every visit | **Yes** | 15 min |
| **No CSS/JS minification** | ~40% larger than needed | Yes | 1 hr (build step) |
| Font Awesome full library for ~30 icons | ~60 KB wasted | Medium | 2 hr (subset or SVG) |
| Inventory API (cold) takes 2s+ | Slow first load for browse page | No | Need server-side caching for inventory |
| `contain: layout style` on cards | Already implemented — good | N/A | Done |
| `loading="lazy"` on images | Already implemented — good | N/A | Done |
| `prefers-reduced-motion` respected | Already implemented — good | N/A | Done |

---

## 6) SEO / Content

### Missing SEO Infrastructure

| Element | Status | Pages Missing | Impact |
|---------|--------|---------------|--------|
| `<link rel="canonical" href="...">` | **Missing** | All 6 pages | Duplicate content risk |
| `<meta property="og:title">` | **Missing** | All 6 pages | No title in social shares |
| `<meta property="og:description">` | **Missing** | All 6 pages | No description in social shares |
| `<meta property="og:image">` | **Missing** | All 6 pages | No preview image when shared |
| `<meta property="og:type">` | **Missing** | All 6 pages | |
| `<meta name="twitter:card">` | **Missing** | All 6 pages | No Twitter preview |
| `robots.txt` | **Missing** | N/A | No crawl directives |
| `sitemap.xml` | **Missing** | N/A | Search engines can't discover pages |
| JSON-LD structured data (`Vehicle`, `AutoDealer`, `BreadcrumbList`) | **Missing** | Home, inventory, detail | No rich search snippets |
| `favicon.ico` | **Missing** | All pages | 404 error in browser console |
| `apple-touch-icon` | **Missing** | All pages | No iOS homescreen icon |

### Internal Linking Issues

| Issue | Impact |
|-------|--------|
| Footer "Browse by type" links use `?type=sports` and `?type=electric` which don't map to MarketCheck API's `body_type` values | Links return unfiltered results — user confusion |
| `index.html` footer vs `inventory.html` footer have inconsistent type param casing (`type=sedan` vs `type=Sedan`) | Inconsistent results |
| "Financing" link in inventory footer goes to `#` | Dead link |
| "Privacy" and "Terms" links go to `#` on all pages | Dead links, looks unprofessional |
| Social media links go to `#` on all pages | Dead links |

### Missing Conversion Content

| Content | Status | Revenue Impact |
|---------|--------|---------------|
| Trade-in value estimator | Missing | High — drives dealer visits |
| Financing pre-qualification (real form → backend) | Missing — form goes to `alert()` | Critical — primary revenue funnel |
| Google Maps embed on Contact page | Missing (placeholder div) | Medium — trust signal |
| Vehicle history report integration (Carfax link) | Missing | Medium — trust |
| Dealer review / rating display | Missing | Medium — trust |
| Newsletter email integration | Missing — goes to `alert()` | Medium — remarketing |

---

## 7) Security & Reliability

### Security Headers (Verified: NONE present)

```
HTTP/1.1 200 OK
Content-Type: text/html
Date: Mon, 16 Feb 2026 11:00:26 GMT
Connection: keep-alive
Keep-Alive: timeout=5
```

**Missing (all critical for production):**

| Header | Missing | Risk |
|--------|---------|------|
| `Content-Security-Policy` | **Yes** | XSS, code injection |
| `X-Frame-Options` | **Yes** | Clickjacking |
| `X-Content-Type-Options` | **Yes** | MIME sniffing attacks |
| `Strict-Transport-Security` | **Yes** | Downgrade attacks (when on HTTPS) |
| `Referrer-Policy` | **Yes** | Leaks referrer data |
| `Permissions-Policy` | **Yes** | Uncontrolled browser API access |

### CORS Configuration

```
Access-Control-Allow-Origin: *
```

**Risk:** Any website on the internet can call your API endpoints (`/api/home-feed`, `/api/inventory`, `/api/listing/*`, `/api/facets`) and:
- Consume your MarketCheck API quota
- Scrape your enriched listing data
- Use your proxy as their own free API

**Fix:** Remove `Access-Control-Allow-Origin: *` or restrict to your domain.

### Input Validation (Verified via live tests)

| Test | Payload | Result | Risk |
|------|---------|--------|------|
| Path traversal | `/../../../windows/win.ini` | 404 (safe) | Low — Node's `path.join` resolves correctly |
| Null byte injection | `/%00.html` | 404 (safe) | Low |
| Oversized rows | `?rows=999999` | 200, **180 KB response** | Medium — server sends `rows=50` to MarketCheck but returns all to client |
| Negative start | `?start=-5` | 200, empty result | Low — MarketCheck handles it |
| XSS in listing data | `seller_comments` → `innerHTML` | **Vulnerable** | **High** — see BUG-04 |

### Secrets & Deployment

| Issue | Severity |
|-------|----------|
| `.env` has API key in plaintext with no `.gitignore` protection | **P1** |
| No HTTPS — plain HTTP only | **P1** — browsers show "Not Secure" |
| API key hardcoded server-side path (good) but no rotation/expiry mechanism | **P2** |
| No backup/failover for MarketCheck API | **P2** — single point of failure |

### Crash / Fallback / Retry

| Issue | Impact |
|-------|--------|
| Server crash = complete outage (no PM2, no systemd, no container) | Full site down |
| No `process.on('uncaughtException')` handler | Crash on unhandled promise rejection |
| No retry logic for failed MarketCheck calls | Single failure = empty results |
| No graceful shutdown (`SIGTERM` handler) | Active requests dropped on restart |
| In-memory cache lost on every restart | Cold cache = slow first requests for all users |

---

## 8) Prioritized Action Plan

### 24-Hour Fixes (Critical)

| # | Task | Owner | Est. | Risk | Expected Impact | Files Affected |
|---|------|-------|------|------|-----------------|----------------|
| 1 | **Rewrite `about.html`** with current CSS classes | Frontend | 2h | Low | Entire page becomes functional | `public/about.html` |
| 2 | **Remove inline `onclick`** from all 4 FAQ items in `contact.html` | Frontend | 10min | None | FAQ starts working | `public/contact.html` |
| 3 | **Add `.gitignore`** (exclude `.env`, `node_modules`, `scripts/`) | DevOps | 5min | None | Prevents API key leak | `.gitignore` (new) |
| 4 | **Remove wildcard CORS** — set `Access-Control-Allow-Origin` to specific domain or remove entirely | Backend | 15min | Low | Stops API quota abuse | `server.js` |
| 5 | **Add security headers** to all responses (CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy) | Backend | 30min | Low | Blocks XSS, clickjacking, MIME attacks | `server.js` |
| 6 | **Create `package.json`** with start script and dependencies | DevOps | 10min | None | Standard Node project | `package.json` (new) |
| 7 | **Sanitize all `innerHTML` injections** from API data (escape HTML entities) | Frontend | 1h | Low | Closes XSS vulnerability | `public/js/app.js` |

### 7-Day Fixes (Important)

| # | Task | Owner | Est. | Risk | Expected Impact | Files Affected |
|---|------|-------|------|------|-----------------|----------------|
| 8 | **Wire year filter** in inventory JS — add IDs to selects, read values in `loadInventory()` | Frontend | 30min | None | Year filter works | `inventory.html`, `app.js` |
| 9 | **Wire search tabs** (All/New/Pre-Owned) to pass `car_type` parameter | Frontend | 20min | None | Search tabs functional | `app.js` |
| 10 | **Add `Cache-Control` headers** to static file responses (`max-age=31536000` with cache-bust params for CSS/JS) | Backend | 30min | Low | 50-70% fewer re-downloads | `server.js` |
| 11 | **Add gzip compression** (use `zlib.createGzip()` in response pipe) | Backend | 1h | Low | 60-70% smaller responses | `server.js` |
| 12 | **Add `robots.txt`** and **`sitemap.xml`** | SEO | 1h | None | Search engine visibility | `public/robots.txt`, `public/sitemap.xml` (new) |
| 13 | **Add Open Graph + Twitter Card meta** to all 6 pages | SEO | 2h | None | Social shares show previews | All HTML files |
| 14 | **Add favicon** (`.ico` + `apple-touch-icon`) | Design | 30min | None | Professional browser tab | `public/favicon.ico` (new), all HTML |
| 15 | **Fix mobile menu** — close on link click | Frontend | 15min | None | Better mobile UX | `app.js` |
| 16 | **Add skip-link** to `index.html` and `404.html` | Frontend | 10min | None | WCAG 2.4.1 compliance | `index.html`, `404.html` |
| 17 | **Add timeout** to MarketCheck API calls (10s) | Backend | 30min | Low | Prevents server hangs | `server.js` |
| 18 | **Add rate limiting** (60 req/min per IP for API routes) | Backend | 2h | Low | Protects API quota | `server.js` |
| 19 | **Clamp API input params** (`rows` max 50, `start` min 0) | Backend | 20min | None | Prevents abuse | `server.js` |
| 20 | **Replace deprecated `url.parse()`** with `new URL()` | Backend | 20min | Low | Removes deprecation warning | `server.js` |
| 21 | **Add `for`/`id` pairing** on contact form labels | Frontend | 15min | None | Better accessibility | `contact.html` |
| 22 | **Delete stale `scripts/` directory** | DevOps | 2min | None | Clean project | `scripts/` (delete) |

### 30-Day Improvements (Strategic)

| # | Task | Owner | Est. | Risk | Expected Impact | Files Affected |
|---|------|-------|------|------|-----------------|----------------|
| 23 | **Connect contact form** to email service (SendGrid / Formspree) | Backend | 4h | Low | Lead capture begins | `server.js`, `app.js` |
| 24 | **Connect newsletter** to email list (Mailchimp / Buttondown) | Backend | 3h | Low | Email list growth | `server.js`, `app.js` |
| 25 | **Add JSON-LD structured data** (Vehicle, AutoDealer, BreadcrumbList) | SEO | 4h | None | Rich search results | All HTML, `app.js` |
| 26 | **Deploy to production** (Railway / Render / VPS) with custom domain + SSL | DevOps | 4h | Medium | Site goes live with HTTPS |  |
| 27 | **Add PM2** for auto-restart, cluster mode, log rotation | DevOps | 1h | Low | Zero-downtime reliability |  |
| 28 | **CSS/JS minification build step** (esbuild or similar) | Build | 2h | Low | 40% smaller assets | Build script (new) |
| 29 | **Replace Font Awesome CDN** with icon subset or inline SVGs | Performance | 3h | Low | ~60 KB saved | All HTML, `style.css` |
| 30 | **Persist save/favorite state** in `localStorage` | Frontend | 2h | None | Saves survive refresh | `app.js` |
| 31 | **Add Google Maps embed** to contact page | Frontend | 1h | None | Trust + real location | `contact.html` |
| 32 | **Add Google Analytics or Plausible** | Analytics | 1h | None | Traffic data | All HTML |
| 33 | **Add basic unit tests** for pipeline (dedup, scoring, diversity) | Testing | 4h | None | Catch regressions | New test files |
| 34 | **Implement retry logic** for MarketCheck API calls (exponential backoff, 3 attempts) | Backend | 2h | Low | Resilient to temporary failures | `server.js` |
| 35 | **Fix footer "type" links** to use correct MarketCheck `body_type` values | Frontend | 20min | None | Filter links work | All HTML footers |
| 36 | **Create Privacy and Terms pages** (or remove links) | Content | 2-8h | None | Professional, legal compliance | New HTML files |

---

## Ready-to-Ship Checklist

| Category | Check | Status | Evidence |
|----------|-------|--------|----------|
| **Pages** | All 6 pages load with 200 status | **PASS** | Live test: `/` → 200, `/inventory` → 200, `/car-details` → 200, `/about` → 200, `/contact` → 200, `/404` → 404 |
| **Pages** | 404 page returns proper 404 status for unknown routes | **PASS** | Live test: `/nonexistent-page` → 404 |
| **Pages** | All pages use consistent design system | **FAIL** | `about.html` uses 25 broken CSS classes |
| **API** | `/api/home-feed` returns 24 cards, 0 duplicates | **PASS** | Live test: 24 cards, 0 duplicate VINs, 24/24 have `_meta` |
| **API** | `/api/inventory` returns results with pagination | **PASS** | Live test: returns listings + `num_found` |
| **API** | `/api/listing/:id` returns enriched listing | **PASS** | Live test: HTTP 200 with data |
| **API** | `/api/facets` returns facet data | **PASS** | Live test: HTTP 200 |
| **API** | Unknown API returns 404 | **PASS** | Live test: `/api/nonexistent` → 404 |
| **Data** | Duplicate VINs in home feed = 0 | **PASS** | 0 duplicate VINs in 24 cards |
| **Data** | Missing image in top 24 < 2% | **PASS** | 0 missing images |
| **Data** | Missing price in top 24 = 0 | **PASS** | 0 missing prices |
| **Data** | Missing make in top 24 = 0 | **PASS** | 0 missing makes |
| **Data** | All cards have `_meta` enrichment | **PASS** | 24/24 cards have `_meta` |
| **Security** | Security headers present | **FAIL** | Zero security headers on any response |
| **Security** | CORS restricted to own domain | **FAIL** | `Access-Control-Allow-Origin: *` on all API responses |
| **Security** | `.gitignore` protects `.env` | **FAIL** | No `.gitignore` exists |
| **Security** | User input sanitized before DOM injection | **FAIL** | Raw `innerHTML` from API data |
| **Security** | Path traversal blocked | **PASS** | `/../../../` → 404 |
| **UX** | FAQ works on contact page | **FAIL** | Double-toggle bug — click does nothing |
| **UX** | Year filter works on inventory page | **FAIL** | Not wired in JS |
| **UX** | Search tabs work on homepage | **FAIL** | Decorative only |
| **SEO** | Open Graph meta tags on all pages | **FAIL** | Missing on all 6 pages |
| **SEO** | `robots.txt` and `sitemap.xml` present | **FAIL** | Missing |
| **SEO** | Favicon present | **FAIL** | Missing |
| **Performance** | Static files have cache headers | **FAIL** | No `Cache-Control` on HTML/CSS/JS |
| **Performance** | Responses compressed | **FAIL** | No gzip/brotli |
| **Accessibility** | Skip-link on all pages | **FAIL** | Missing on `index.html` and `404.html` |
| **Accessibility** | Keyboard navigation works | **PASS** | Tab, Enter, focus rings all work |
| **Accessibility** | `prefers-reduced-motion` respected | **PASS** | Animations disabled with media query |
| **Forms** | Contact form delivers to inbox | **FAIL** | Goes to `alert()` |
| **Forms** | Newsletter subscribes user | **FAIL** | Goes to `alert()` |

---

## Summary

**What's working well:**
- Data pipeline (dedup, scoring, diversity) is production-quality
- 0% duplicate rate, 100% field completeness, 100% meta enrichment
- Card system V2 with variant highlights looks premium
- Design tokens are well-structured and consistent (on pages that use them)
- Responsive breakpoints are thorough (320/480/768/1024)
- Accessibility foundations are solid (focus rings, ARIA, reduced motion)

**What blocks production launch (must fix):**
1. Rewrite `about.html` with correct CSS classes (~2 hours)
2. Remove FAQ `onclick` duplicates in `contact.html` (~10 minutes)
3. Add security headers + restrict CORS (~45 minutes)
4. Sanitize `innerHTML` injections (~1 hour)
5. Create `.gitignore` (~5 minutes)

**Total time to unblock launch: ~4 hours.**

---

*This audit was generated from static code analysis of all 10 project files plus live endpoint testing against the running server. No issues are marked as fixed without verification.*
