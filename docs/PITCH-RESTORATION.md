# Car Pitching Behavior — Root Cause & Restoration

## What was requested

Restore the **sales-style “pitching”** presentation for car listings (NightDrive/AutoElite): clear headline, why it’s a great pick, key highlights, best-for context, and a quick CTA — confident and sharp, not robotic.

## Root cause (what removed the pitching)

- **No single “pitch removal” commit was found.** The codebase had deal badges, Smart Deal score, variant tags, and CTAs, but **no dedicated pitch block** with the five sections: **Top Pick**, **Why it’s special**, **Specs snapshot**, **Deal note / market context**, **Next steps**.
- Likely the pitch had been either:
  - Never fully implemented in the current frontend, or
  - Removed or refactored earlier (e.g. when moving to “card v2” or market-context pipeline) without a replacement that exposed these sections explicitly.
- There is **no feature flag or env var** that was disabling pitching; the structure simply wasn’t present in the detail page or in a reusable pitch builder.

## How it was restored

1. **Pitch builder (shared shape)**  
   - **Frontend:** `buildPitch(listing)` in `public/js/app.js` returns `{ topPick, whySpecial, specsSnapshot, dealNote, nextSteps }` using listing + `_meta` (variant, dealBadge, medianPrice, trustSignals, freshness).  
   - **Server:** `server/pitch.js` exports the same shape for the smoke API and any future server-rendered pitch.

2. **Detail page**  
   - **`public/car-details.html`**  
     - Added a **pitch block** container: `#detailPitch`.  
   - **`public/js/app.js`**  
     - In `loadCarDetails()`, the block is filled with the five sections (headline, why it’s special, specs snapshot, deal note, next steps).  
   - **`public/css/style.css`**  
     - Styles for `.detail-pitch` and `.pitch-*` so the block is clear and on-brand.

3. **Listing cards**  
   - **`public/js/app.js`**  
     - For cards with `best-value` / `great-deal` or `low-mileage`, added a short **pitch line** (“Top pick: …”, “Why we like it: …”, “Night pick: …”) so the feed also “sells” with a one-liner.

4. **Smoke test**  
   - **`scripts/smoke-pitch.js`**  
     - Asserts that the pitch **shape** is correct:  
       - Runs **locally** by calling `server/pitch.js` `buildPitch(mockListing)` and checking all five keys are non-empty strings (no server required).  
       - **Optionally** if `BASE_URL` is set, GETs `/api/smoke/pitch` and asserts the same sections.  
   - **`server.js`**  
     - **`GET /api/smoke/pitch`** returns the pitch object for the first listing from cache/demo (after pipeline), so integration tests can assert the API response contains the pitch sections.

## Files touched

- `public/js/app.js` — `buildPitch()`, pitch block in `loadCarDetails()`, pitch line on cards.  
- `public/car-details.html` — `#detailPitch` container.  
- `public/css/style.css` — `.detail-pitch`, `.pitch-*`, `.card-pitch-line`.  
- `server/pitch.js` — new; server-side pitch builder.  
- `server.js` — `buildPitchServer` require, `GET /api/smoke/pitch`.  
- `scripts/smoke-pitch.js` — new; smoke test for pitch sections.  
- `docs/PITCH-RESTORATION.md` — this note.

## What was not changed

- Billing, invoice, or API key logic (confirmed not the cause).  
- MarketCheck / cache-first / LISTINGS_MODE behavior.

## How to verify

- **Detail page:** Open any car detail (e.g. `/car-details?id=demo-1`). You should see the pitch block with: Top Pick, Why it’s special, Specs snapshot, Deal note, Next steps.  
- **Cards:** On home or inventory, cards that are best-value or great-deal or low-mileage should show the one-line pitch.  
- **Smoke test:**  
  - `node scripts/smoke-pitch.js` — must pass (local assertion).  
  - With server running: `BASE_URL=http://127.0.0.1:1154 node scripts/smoke-pitch.js` — optional API assertion.
