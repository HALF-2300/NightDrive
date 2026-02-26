# Expert Handoff: Cars Not Showing on NightDrive / AutoElite

**Problem:** The site loads (no 404s on pages), the server starts and reports **"MarketCheck API: Connected"**, but **no cars appear** on the Home or Inventory pages.

**Goal:** Identify why car listings are not displayed and fix so that either (1) live MarketCheck data is shown, or (2) at minimum the built-in demo fallback shows 6 sample cars so the UI is never empty.

---

## 1. Tech stack & data flow

- **Backend:** Node.js (no Express). Entry: `server.js`. Env: `server/env.js` (loads `.env` from project root).
- **Frontend:** Static HTML + vanilla JS. Served by the same Node server from `public/`.
- **Car data source:** MarketCheck API v2 (`https://api.marketcheck.com/v2/search/car/active` and `/listing/car/:id`). API key from `MARKETCHECK_API_KEY` in `.env`.
- **Flow:**
  1. Browser loads e.g. `http://localhost:1554/` or `http://localhost:1554/inventory`.
  2. Frontend JS (`public/js/app.js`) calls `apiFetch('/api/home-feed')` on Home or `apiFetch('/api/inventory?rows=12&start=0')` on Inventory.
  3. `apiBase()` in `public/config.js`: on **localhost / 127.0.0.1** it returns `''` (same-origin). So requests go to `http://localhost:1554/api/...`.
  4. Server handles `/api/home-feed` and `/api/inventory` in `server.js` (inside `handleAPI()`), calls MarketCheck via `mcFetch()`, then returns JSON with `rails` (home) or `listings` (inventory).
  5. Frontend renders cards with `listingCard()` and fills the grids. If the API fails or returns empty, frontend has a **catch** that shows hardcoded `demoVehicles` (6 cars).

---

## 2. Current environment (from user)

- **Server:** Runs with `npm run dev` → `node server.js`. **Port:** `1554` (from `.env`: `PORT=1554`).
- **Console output:** `AutoElite v2.0 is live at http://localhost:1554` and `MarketCheck API: Connected`.
- **Symptom:** No cars on screen (Home and/or Inventory). 404s on site pages have been fixed; issue is specifically **cars not appearing**.

---

## 3. What is already implemented (so expert can avoid redoing it)

- **Demo fallback (server):**
  - `getDemoListings()` in `server.js` returns 6 demo listings with `_meta` (used by pipeline).
  - `buildDemoFeed()` builds a home-feed-shaped object with `rails.editorPicks`, `bestDeals`, `lowMileage`, `justArrived`.
  - **Home feed:** If `fetchFresh()` throws (e.g. MarketCheck error) or returns empty rails, server responds with `buildDemoFeed()`.
  - **Inventory:** If after MarketCheck call `trimmed.length === 0`, server fills with demo listings before sending.
- **Demo fallback (frontend):**
  - If `apiFetch('/api/home-feed')` throws or returns empty rails (`hasAnyRail` false), catch block fills `[data-rail="editorPicks"]` and hunted grid with `demoVehicles`.
  - If `apiFetch('/api/inventory?...')` returns `listings.length === 0` or throws, frontend shows `demoVehicles` and updates count/pagination.
- **API base:** `public/config.js` sets `window.ND_API_BASE = ''` when `hostname` is localhost/127.0.0.1/::1, so same-origin is used. No proxy in this repo (no Vite/Next).

---

## 4. Likely root causes to check (in order)

### A) Port / origin mismatch
- User runs server on **1554**. If they open the site at a different port (e.g. 3000 or file://), or from a different host (e.g. 127.0.0.1 vs localhost), `apiBase()` may still be same-origin but the request might go to the wrong place or CORS can block.
- **Check:** In browser DevTools → Network, filter by Fetch/XHR. Reload. Confirm:
  - Request URL for cars is exactly `http://localhost:1554/api/home-feed` (or 1554) and `http://localhost:1554/api/inventory?...`.
  - Status is **200** and Response has JSON with `rails` (home) or `listings` (inventory). If status is 4xx/5xx or CORS error, that’s the bug.

### B) MarketCheck returns 200 but empty or error payload
- `mcFetch()` in `server.js` **does not reject on HTTP 4xx**. It resolves with `{ status, body }`. So 401/403/429 still resolve; `body` may be `{ error: "..." }` or `{ listings: [] }`.
- Home feed does: `premiumRes.body.listings`, etc. If `body` is `{ error: "Invalid authentication credentials" }`, then `body.listings` is undefined; the code uses `...(premiumRes.body.listings || [])`, so it becomes `[]`. That can lead to empty `allRaw` and then `buildDemoFeed()` is returned — so **server should still send demo cars**. The only way to get no cars from server is if:
  - Something **throws** before the demo fallback (e.g. malformed response that breaks `processPipeline` or JSON parse), or
  - Response is never sent (e.g. handler never runs or wrong route).
- **Check:** Add a one-off log in `server.js` in the home-feed block: e.g. right after `response = await fetchFresh()` log `response.rails.editorPicks.length` and `response.source` (if present). Or call from terminal:
  - `curl -s http://localhost:1554/api/home-feed | head -c 500`
  - `curl -s "http://localhost:1554/api/inventory?rows=12&start=0" | head -c 500`
  Expect JSON with either live data or demo (e.g. `"source":"demo"` or non-empty `listings` / `rails`).

### C) Frontend not receiving or not rendering
- If server returns 200 with valid `rails` / `listings`, but DOM stays empty:
  - **Check:** In DevTools → Console, any JS error? (e.g. in `listingCard` or when reading `data.rails`.)
  - **Check:** Does the page have the right containers? Home: `#curatedFeed`, `[data-rail="editorPicks"]`, etc. Inventory: `#inventoryCars`. If HTML for that page doesn’t have these IDs, the script will not fill them.
- **Check:** In DevTools → Network, open the response body of `/api/home-feed` and `/api/inventory`. Confirm structure:
  - Home: `{ rails: { editorPicks: [...], bestDeals: [...], lowMileage: [...], justArrived: [...] }, totalAvailable?: number }`.
  - Inventory: `{ listings: [...], num_found: number }`.

### D) MarketCheck key / quota / network
- "MarketCheck API: Connected" comes from a **readiness check** that does a single `mcFetch('/search/car/active', { rows: '1', start: '0', country: 'us' })`. If that succeeds (200), the server reports Connected even if later calls fail (e.g. quota exhausted, different endpoint behavior).
- **Check:** In `server.js`, temporarily log inside `mcFetch`’s `apiRes.on('end')`: e.g. `if (apiRes.statusCode !== 200) console.warn('[mcFetch]', endpoint, apiRes.statusCode, body?.error || body)` (without logging full body if it’s large). Reproduce one Home load and one Inventory load; see if any call returns 401/429/500.
- **Check:** `.env` has `MARKETCHECK_API_KEY` set (no BOM or stray characters on the line). No typo in key. MarketCheck dashboard: confirm key is active and has remaining quota.

### E) Pipeline or response shape
- `processPipeline()` (and thus `buildDemoFeed()`) uses `computeMarketContext()` which adds `_meta` to each listing. Frontend expects `listing._meta` for badges/scores. If for some reason the server returns listings without `_meta`, cards might still render but could misbehave; unlikely to cause “zero cars.”
- **Check:** Ensure the response from `/api/home-feed` and `/api/inventory` actually contains arrays with at least one item when you expect cars (either live or demo).

---

## 5. Key file locations

| What | Where |
|------|--------|
| Server entry, API routes, mcFetch, demo fallback | `server.js` |
| Env (PORT, MARKETCHECK_API_KEY) | `server/env.js`, `.env` |
| API base URL (same-origin vs remote) | `public/config.js` |
| Home feed fetch + demo fallback | `public/js/app.js` → `loadHomeFeed()` |
| Inventory fetch + demo fallback | `public/js/app.js` → `loadInventory()` |
| Card rendering | `public/js/app.js` → `listingCard()`, `safeCard()` (fallback: `miniCard()`) |
| Demo data (server) | `server.js` → `getDemoListings()`, `buildDemoFeed()` |
| Demo data (frontend) | `public/js/app.js` → `demoVehicles` |

---

## 6. Minimal reproduction steps (for expert)

1. Clone repo, run `npm install` (if needed).
2. Copy `.env.example` to `.env`. Set at least:
   - `MARKETCHECK_API_KEY=<valid key>`
   - `PORT=1554`
   - `NODE_ENV=development`
3. Start: `npm run dev`. Confirm console shows `AutoElite v2.0 is live at http://localhost:1554` and `MarketCheck API: Connected`.
4. Open **one** tab: `http://localhost:1554/` (Home). Hard reload (Ctrl+F5). Open DevTools → Network (Fetch/XHR) and Console.
5. Check:
   - Is there a request to `http://localhost:1554/api/home-feed`? Status? Response body (has `rails` with non-empty arrays or not)?
   - Any red errors in Console?
6. Then open `http://localhost:1554/inventory`. Same checks for `http://localhost:1554/api/inventory?rows=12&start=0`.

---

## 7. Success criteria

- **Minimum:** Home and Inventory always show at least the 6 demo cars when MarketCheck is unavailable or returns empty (no blank grid).
- **Target:** When MarketCheck key is valid and has quota, Home and Inventory show live listings from the API.

---

## 8. Optional: force demo for quick test

To verify that “no cars” is not a frontend bug, you can temporarily force the server to always return demo:

- In `server.js`, at the start of the `/api/home-feed` block, add:
  - `jsonRes(req, res, 200, buildDemoFeed()); return true;`
- In `/api/inventory`, after building `params`, add:
  - `const demo = processPipeline(getDemoListings(), { rank: false, maxPerModel: 999 }); jsonRes(req, res, 200, { num_found: demo.length, listings: demo.slice(0, rows) }); return true;`

Then reload Home and Inventory. If cars appear, the problem is upstream (MarketCheck or server logic before the fallback). If they still don’t, the problem is frontend (URL, CORS, or DOM/JS).

---

## 9. PATCH 5 — Smoke check (confirm app.js and static serving)

If the page is **completely empty** (no cars at all), first confirm the server is serving static files and the API:

```bash
curl -i http://localhost:1554/js/app.js
curl -i http://localhost:1554/config.js
curl -i http://localhost:1554/api/_diag
```

- **app.js / config.js return 404** → The server is not serving `public/` correctly (wrong static root or route order). Fix static file handling so `/js/app.js` and `/config.js` return 200.
- **All three return 200** → Static and API are reachable. If _diag returns JSON with `port`, `hasKey`, `lastMc`, the server has the latest routes; then the issue is likely frontend (JS error before render, or wrong container IDs).
- **app.js/config.js 200 but _diag 404** → Restart the server (or check port) so the `GET /api/_diag` route is registered; the important check is that **app.js and config.js are not 404**, so the browser can run the script and show demo/panic cards.

---

**End of handoff.** Please report back: (1) exact request URLs and status codes for home-feed and inventory, (2) whether response body has non-empty `rails`/`listings`, (3) any Console errors, and (4) result of the “force demo” test if run.
