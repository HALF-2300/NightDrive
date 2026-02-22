# NightDrive Design QA Scorecard v1.0 (0–100)

**Authority:** If conflict exists, DESIGN-SPEC.md wins creative direction; SCORECARD enforces pass/fail.

**Reference:** `DESIGN-SPEC.md` (master brief + Add-On Pack).

---

## Pass Rules

* **90–100** = Ship
* **85–89** = Ship only with 24h patch list
* **&lt;85** = No ship
* Any **Blocker** = automatic no ship, regardless of score

---

## 1) First-Impact Brand Power (20 pts)

1. Hero feels **premium + intimidating + trustworthy** in under 2 seconds (0–6)
2. Headline tone matches brand voice (not generic dealer copy) (0–4)
3. Visual hierarchy immediately clear (headline → CTA → search) (0–5)
4. No playful/cartoon signals in icons, copy, spacing, colors (0–5)

**Subtotal:** ____ /20

---

## 2) Color & Visual System Integrity (15 pts)

1. No green remains in deal semantics (0–5)
2. Crimson/Amber/Neutral semantics are consistent across pages (0–4)
3. Dark surfaces stay readable and not muddy (0–3)
4. Glow/shadow usage is subtle and controlled (0–3)

**Subtotal:** ____ /15

---

## 3) Card System Quality (15 pts)

1. Listing cards feel “system-grade,” not ecommerce template (0–4)
2. Deal labels use NightDrive language (HUNTED DEAL / NIGHT PICK / HIGH DEMAND) (0–4)
3. Deal reason is visible fast (below market, demand, freshness) (0–4)
4. Card CTA is high-clarity and high-intent (0–3)

**Subtotal:** ____ /15

---

## 4) Interaction & Motion Discipline (15 pts)

1. Hover behavior adds confidence (lift, underglow, image treatment) (0–4)
2. Motion timing is smooth and controlled (no flashy effects) (0–4)
3. Sticky nav behavior is stable (no jitter/flicker) (0–3)
4. Tap/hover feedback is consistent across components (0–4)

**Subtotal:** ____ /15

---

## 5) Conversion Clarity (15 pts)

1. Primary CTA is always obvious at each step (0–4)
2. Next action is clear on Home, Inventory, Detail (0–4)
3. High-intent microcopy supports action (“This deal won’t last”) (0–3)
4. Decision info appears before friction (price, score, reason) (0–4)

**Subtotal:** ____ /15

---

## 6) Mobile Command Presence (10 pts)

1. Mobile keeps same brand power (not diluted/friendly) (0–4)
2. Readability/tap targets are clean and safe (0–3)
3. Search + cards are fast to scan on first screen (0–3)

**Subtotal:** ____ /10

---

## 7) Trust Signals & Marketplace Credibility (10 pts)

1. Verified dealer / market-verified pricing cues are visible (0–4)
2. Vehicle credibility markers visible (VIN/dealer/badges) (0–3)
3. Trust messaging feels institutional, not promotional (0–3)

**Subtotal:** ____ /10

---

# Total Score: **____ /100**

---

## Automatic Blockers (Instant Fail)

If any of these exist, do **not** ship:

1. Any remaining green deal styling in core listing flow
2. Home/Inventory/Detail tone mismatch
3. Low contrast text on dark surfaces affecting readability
4. Primary CTA ambiguity on any key page
5. “Generic marketplace” template look dominating key sections

---

## 24h Fix Priority (if score 85–89)

1. Remove remaining off-brand colors and inconsistent badge language
2. Tighten card spacing + typography scale for scan speed
3. Normalize CTA hierarchy across all pages
4. Reduce motion noise and sharpen hover clarity
5. Align mobile hero + first-scroll cards with desktop tone

---

## Definition of Done

NightDrive is ready when:

* It feels like a **restricted premium system** (not a shopping site),
* Users can evaluate a deal in seconds,
* The brand tone is identical across all major screens,
* Mobile experience carries the same power as desktop,
* Design supports conversion, not decoration.

---

## Quick Team Workflow (Use Today)

* **Designer:** run scorecard pass 1 (visual + interaction)
* **Frontend:** implement deltas only for items scoring below full points
* **QA:** rerun scorecard + blocker checklist
* **Owner signoff:** ship only at 90+ (or 85–89 with 24h patch list)

**Rule:** no visual change without a score impact reason.

---

## 24-Hour Execution Plan (team-ready)

### Hour 0–4: Design Freeze

* Freeze tokens (colors/type/spacing/elevation/motion timing)
* Freeze copy bank labels and CTA language
* Freeze card states and badge semantics

### Hour 4–12: Build Pass

* Apply spec to Home, Inventory, Detail
* Remove remaining off-brand visuals
* Normalize CTA hierarchy across pages

### Hour 12–18: QA Pass

* Run scorecard for each page (desktop + mobile)
* Record totals in run table
* Create blocker/fix list

### Hour 18–24: Final Polish + Release Candidate

* Apply only score-driven fixes
* Re-run scorecard
* Approve/hold based on threshold

---

## QA Discipline (how to run it)

For each run:

* **Page:** Home / Inventory / Detail
* **Device:** Desktop + Mobile
* Score all 7 sections (point values as above)
* Sum total (max 100)
* Mark pass/fail per Pass Rules
* Log **top 3 deltas** only (avoid random tweaks)

**Rule:** no visual change without a score impact reason.

---

## Release Gate (final)

Ship only when all are true:

* Total score **≥ 90** (or **85–89** with signed 24h patch list)
* No auto-fail blockers
* Cross-page consistency confirmed
* Mobile tone equals desktop tone
* CTA clarity confirmed at each major step

---

## One-Line Owner Command (paste to team)

**“From now on, DESIGN-SPEC.md is the brand authority and DESIGN-QA-SCORECARD.md is the ship gate; no change merges unless it improves score or removes a blocker.”**

---

## Run Log

| Run | Date | Page(s) | Device | Total | Blockers? | Pass? |
|-----|------|---------|--------|-------|-----------|-------|
| 1 | ______ | ________ | ________ | ____ | ☐ | ☐ |
| 2 | ______ | ________ | ________ | ____ | ☐ | ☐ |
| 3 | ______ | ________ | ________ | ____ | ☐ | ☐ |
