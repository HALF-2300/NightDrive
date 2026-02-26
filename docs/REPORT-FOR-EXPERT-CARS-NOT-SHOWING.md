# Report for Expert — Cars Not Showing on Site (NightDrive / AutoElite)

Hi,

With regard to **NightDrive / AutoElite** (car dealership platform), we have an issue where the backend/API is confirmed healthy via CLI tests, but the **browser UI shows no dynamic car listings**.

**Company / product:** NightDrive (brand) / AutoElite (project name)  
**Stack:** Node.js server (`server.js`), static HTML + vanilla JS in `public/`, MarketCheck API

---

## What's confirmed working (backend ✅)

CLI tests succeed (PowerShell/Node), for example:

- `GET /api/readiness` → 200 (marketcheck OK)
- `GET /api/_diag` → 200 (hasKey)
- `GET /api/home-feed` → 200 (returns items)
- `GET /api/inventory` → 200 (returns listings)

So this is **not an API key** issue.

---

## Expert update — likely root cause is CSS/rendering (not data)

An expert reviewed the same setup and reported:

- **Console is healthy** — no CORS/fetch failures, no red errors. Logs show:
  - `[ND] app.js LOADED`
  - `[ND] /api/home-feed source= autodev`
- The UI shows a count like **"of 6 SORT Featured"** (Inventory), meaning the frontend **did receive results** and updated the count.
- **Conclusion:** cards are likely **present in the DOM but invisible** due to CSS/layout/overlay.

### Most likely CSS/display causes

- `opacity: 0` stuck from an animation that never completes
- `overflow: hidden` + wrong container height (cards clipped)
- full-screen overlay/hero covering the grid
- grid/flex collapse (`width: 0` / `height: 0`)

### 30-second confirmation

F12 → **Elements** → find the inventory container (e.g. `#inventoryCars` or the main grid wrapper).  
If it has children, it's a **CSS/paint** issue. Check **Computed** styles for:

- `opacity`, `visibility`, `display`
- `height`, `min-height`, `overflow`
- `position` + `z-index` overlays

---

## Fix applied (current repo) — animation no longer hides cards

The grid entrance animation `cardIn` used `from { opacity: 0 }` → `to { opacity: 1 }`.  
On some browsers (reported: **Edge**), the animation can fail to run/complete, leaving cards stuck at `opacity: 0`.

**Change made:**

- Cards **start visible** (`opacity: 1`)
- Only transform (slide-up) animates
- Force `.cars-grid .car-card { opacity: 1 }` so cards never render invisible

**File:** `public/css/style.css` (search for `cardIn`)

Suggested safe CSS pattern:

```css
.cars-grid .car-card { opacity: 1; }

@keyframes cardIn {
  from { transform: translateY(10px); }
  to   { transform: translateY(0); }
}

/* Optional: if animation is used */
.cars-grid .car-card {
  animation: cardIn 240ms ease-out both;
}
```

And for accessibility / reliability:

```css
@media (prefers-reduced-motion: reduce) {
  .cars-grid .car-card { animation: none !important; }
}
```

---

## What we need from the expert (verification + hardening)

Please help verify:

1. The issue is fully resolved across browsers (Chrome + Edge + Firefox).
2. No overlay or layout regression exists on mobile widths.
3. Add a **dev-only visual debug toggle** (optional): outline the grid/cards and log card count after render.

### Minimum evidence requested

1. **DevTools → Console** (first ~20 lines after load)
2. **DevTools → Elements** showing car-card elements exist under the container
3. **DevTools → Computed** for one `.car-card` (opacity/visibility/display)
4. **DevTools → Network (fetch/XHR)** confirming:
   - `/api/inventory` → 200 + JSON
   - `/api/home-feed` → 200 + JSON

---

## Definition of done

- Fresh load shows dynamic car cards (not only static HTML demo cars)
- Console shows "loaded N listings" (or equivalent) with **no errors**
- Cards visible on Chrome + Edge (and ideally Firefox)
- If API fails, UI shows a visible error banner (not silent empty state)

Thank you for your help.

---

## How to share the code files (for the expert)

You asked for **public/app.js**, **public/css/style.css**, and **server.js**. In this project:

- **Frontend JS:** **public/js/app.js** (not `public/app.js`). Path: `public\js\app.js`
- **CSS:** **public/css/style.css** → `public\css\style.css`
- **Server:** **server.js** in the project root

You can drag and drop these three files into the chat, or open them and copy-paste the contents (label each with the path above).

Project root: `c:\Users\abesa\OneDrive\Desktop\Desktop\CAR`

**Note:** Frontend uses `data.listings` for inventory and `data.rails` (e.g. `editorPicks`, `bestDeals`) for home-feed. Cards are rendered with `listingCard()` / `safeCard()` into `#inventoryCars`, `[data-rail="editorPicks"]`, and `#huntedGrid`.

---

## Root cause applied (expert analysis)

**Bug #1 (primary):** In `loadHomeFeed()`, `grid.closest('.car-rail')` could return `null`; then `.style.display = ''` threw and killed the whole function. The catch then called `renderDemoHome()`, overwriting any rails that had rendered.

**Fix applied in `public/js/app.js`:** Use `const railWrap = grid.closest('.car-rail')` and guard with `if (railWrap)` before setting `style.display`. Wrap each rail iteration in `try/catch` so one bad rail doesn't kill the rest.

**Bug #2 (ND_API_BASE):** Checked — `public/config.js` sets `ND_API_BASE = ''` on localhost/127.0.0.1, so no change needed for local dev.
