# NightDrive — Locked Visual Direction

**Authority:** If conflict exists, DESIGN-SPEC.md wins creative direction; SCORECARD enforces pass/fail.

**Site:** nightdrive.store  
**Status:** Locked  
**Priority:** Power + clarity + consistency over decoration.

---

## Brand Positioning

NightDrive is **not** a “car listing site.”  
It should feel like a **restricted collection of high-value machines**.

---

## Emotional Target

- Controlled
- Dominant
- Premium
- Dangerous (subtle)
- Highly trustworthy

---

## Non-Negotiables

1. **No green** in deal indicators or badges.
2. No playful tones (no friendly “shopping app” look).
3. No soft marketplace styling.
4. Keep clarity/readability high (dark ≠ muddy).
5. Every screen must feel consistent with “Dark Predator.”

---

## Color System (Locked)

| Token | Hex | Usage |
|-------|-----|--------|
| **Obsidian Black** | `#050608` | Page background |
| **Carbon** | `#0B0F14` | Surface 1 |
| **Steel Surface** | `#141A22` | Surface 2 / cards |
| **Crimson** | `#FF2D2D` | Primary action, HUNTED DEAL |
| **Amber/Gold** | `#F59E0B` | Premium signal, NIGHT PICK |
| **Primary Text** | `#F2F4F8` | Headlines, key copy |
| **Secondary Text** | `#9BA3B4` | Body, labels |
| **Danger Deep Red** | `#8A1111` | Overpriced, warnings |

### Semantic Usage

- **HUNTED DEAL / Strong action:** Crimson
- **NIGHT PICK / Premium highlight:** Amber
- **Fair / Neutral:** Gray
- **Overpriced:** Deep red warning treatment

---

## Typography Direction

Choose one pair (sharp + premium):

1. **Sora + Inter**
2. **Space Grotesk + Inter**
3. **Clash Display (or similar sharp headline) + Inter**

Rules:

- Headline weight should feel “commanding,” not playful.
- Body text remains clean, modern, readable.
- Avoid “generic tech startup” vibe.

---

## Component Direction

### Hero

- Strong cinematic night car background.
- Dark gradient overlays for text legibility.
- Headline: **NOT EVERYONE DESERVES THIS CAR.**
- CTA hierarchy: Primary **Explore Cars**, Secondary **Sell Your Car**.

### Listing Cards

- No green. Dark card base, subtle red underglow.
- Micro urgency: “This deal won’t last.” / “Updated 12 min ago.”
- Badges: **HUNTED DEAL**, **NIGHT PICK**, **HIGH DEMAND**.

### Hover Behavior

- Card lifts slightly.
- Image darkens at lower edge.
- Thin red “laser line” sweep on image.
- CTA gains subtle crimson glow.

### Deal Logic

- Smart Deal score prominent.
- “Below market” = tactical edge, not “discount sale.”

---

## Page Consistency

Apply same design DNA to:

1. Home  
2. Inventory  
3. Car Detail  
4. Saved/Watchlist  
5. Mobile layouts  

If one page feels “friendly marketplace,” it fails.

---

## Micro-Interactions

- Soft ambient red pulse on primary CTA (not blinking).
- Transitions: **160–220 ms**.
- Scroll reveal in controlled sequence (not flashy).
- Sticky nav with **dark blur glass**.
- Subtle “restricted system” flavor in transitions.

---

## Copy Tone

**Use:**

- “Enter the Collection”
- “See Why This Car Is a Deal”
- “Built Without Compromise”
- “High Demand Tonight”

**Avoid:**

- “Best Value”
- “Great Offer”
- “Shop Now”
- “Friendly pricing”

---

## Deliverables (Design)

1. Updated desktop + mobile mocks (Home, Inventory, Detail).
2. Component states (default / hover / active / disabled).
3. Token sheet (colors, typography, spacing, elevation, glow).
4. 10–15 s motion prototype (hover + transitions).
5. Visual QA checklist for consistency.

---

## Success Criteria

- First impression feels **elite + intimidating** in &lt;2 seconds.
- No “generic dealership template” signals.
- Deal indicators = premium tactical, not promotional.
- Home / inventory / detail = one system.
- Mobile keeps same brand power.

---

*If tradeoffs are needed: prioritize **power + clarity + consistency** over decoration.*

---

# NightDrive Add-On Pack (Execution Layer)

*Paste this under the master brief so designer + dev execute with zero ambiguity.*

---

## A) 8-Line Slack Version (Fast Send)

Use this when you need a short push message:

1. Lock NightDrive into **Dark Predator**: elite, intimidating, premium, never playful.
2. Remove all green from deals/badges forever.
3. Use crimson/amber semantics: **HUNTED DEAL / NIGHT PICK / HIGH DEMAND**.
4. Hero must feel restricted + cinematic; copy stays aggressive and clean.
5. Cards: dark surfaces, red underglow, laser-line hover, urgency microcopy.
6. Inventory + Detail pages must match Home tone exactly.
7. Motion: subtle, controlled, 160–220ms; no flashy animations.
8. Ship desktop + mobile mocks + token sheet + interaction states.

---

## B) UX Redlines (Do / Don’t)

**DO**

* Use negative space to create authority.
* Keep CTA hierarchy strict (1 primary, 1 secondary).
* Use short, sharp copy.
* Make every “deal” feel tactical, not discount-y.
* Keep data readable on dark backgrounds.

**DON’T**

* No neon overload.
* No cheap “sale” labels.
* No rounded playful UI language.
* No mixed brand tone between pages.
* No green “good deal” visuals.

---

## C) Copy Bank (Drop-in Ready)

### Hero Options

* **NOT EVERYONE DESERVES THIS CAR.**
* **OWN THE NIGHT. DRIVE THE POWER.**
* **BUILT FOR THOSE WHO DON’T DRIVE ORDINARY.**

### Card Labels

* **HUNTED DEAL**
* **NIGHT PICK**
* **HIGH DEMAND**
* **PRICE SHIFT DETECTED**

### CTA Labels

* **Enter the Collection**
* **See Why This Car Is a Deal**
* **Reserve This Car**
* **Track Price Movement**

### Urgency Microcopy

* “This deal won’t last.”
* “Updated 14 min ago.”
* “High interest tonight.”

---

## D) Motion & Interaction Spec (No-Code)

* **Card hover:** lift 4px + soft crimson underglow.
* **Image hover:** bottom dark gradient intensifies + thin red sweep line.
* **CTA hover:** slight bloom (not hard glow), 120–160ms.
* **Section reveal:** staggered fade-up, max 30ms offset per item.
* **Sticky nav:** blur glass + subtle border + zero jitter.
* **Mobile tap feedback:** fast, clear, no bounce effects.

---

## E) Visual Consistency Grid (Must Match Across Pages)

| Element                 | Home               | Inventory | Detail  |
| ----------------------- | ------------------ | --------- | ------- |
| Heading style           | Same family/weight | Same      | Same    |
| Primary CTA color       | Same crimson       | Same      | Same    |
| Deal indicator language | Same labels        | Same      | Same    |
| Surface + borders       | Same depth scale   | Same      | Same    |
| Shadow/glow style       | Same behavior      | Same      | Same    |
| Urgency lines           | Present            | Present   | Present |

**If any row breaks, brand breaks.**

---

## F) 72-Hour Design Sprint Plan

**Day 1 — Foundation**

* Finalize tokens (color, type, radius, elevation, glow).
* Lock hero direction and core card style.
* Approve copy tone.

**Day 2 — Systemization**

* Build complete component states.
* Apply to Home + Inventory.
* Mobile responsiveness pass 1.

**Day 3 — Polish + Handoff**

* Detail page alignment.
* Motion prototype (10–15 sec).
* Final QA + dev-ready specs.

---

## G) Approval Gates (Pass/Fail)

**Gate 1: First Impression**  
In 2 seconds, users feel “premium + intimidating + trustworthy.”

**Gate 2: Card Quality**  
Deals read as “tactical intelligence,” not “promo sale.”

**Gate 3: Consistency**  
Home/Inventory/Detail feel like one platform.

**Gate 4: Readability**  
Dark theme remains easy to scan on all devices.

**Gate 5: Action Confidence**  
User always knows the next action (explore / compare / reserve).

---

## H) Dev Handoff Checklist (Design-to-Build)

* Token sheet exported.
* Component states documented.
* Desktop + mobile spacing rules included.
* Copy variants attached.
* Interaction timing documented.
* QA screenshots for every critical section.

---

## I) Brand Voice One-Liner (Pin This)

**NightDrive is not a marketplace; it is a controlled access system for elite machines.**
