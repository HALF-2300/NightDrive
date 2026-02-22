# AutoElite — Design Expert Brief

**Date:** February 16, 2026  
**From:** AutoElite Development Team  
**To:** Design Expert  
**Subject:** Comprehensive design direction for a premium car dealership platform

---

## 1. Project Overview

**AutoElite** is a premium online car dealership platform that aggregates real U.S. dealer inventory in real-time, runs it through an intelligent data pipeline (deduplication, market scoring, trust verification), and presents it in a curated, luxury-feeling browsing experience.

### What Makes It Unique
- Real-time inventory from 185,000+ listings across U.S. dealers (MarketCheck API)
- AI-driven data pipeline that scores vehicles on price fairness, freshness, mileage value, photo quality, dealer quality, and data completeness
- Three card variants with contextual merchandising (Best Value, Low Mileage, Just Arrived)
- Deal badges (Great Deal, Fair Price, Above Market) based on actual market data
- Trust signals derived from real data (Verified VIN, Franchise Dealer, One Owner, Clean Title)

### Live Pages (6 total)

| Page | Purpose |
|------|---------|
| **Home** | Hero search bar, trust bar, 4 curated vehicle rails (Editor's Picks, Best Deals, Low Mileage, Just Arrived), features, testimonials, newsletter |
| **Inventory** | Full browsable inventory with sidebar filters (make, model, year, price, body type, fuel, transmission, condition), sorting, pagination, active filter chips |
| **Car Details** | Single vehicle deep-dive: photo gallery with thumbnails, specs, dealer info, trust badges, tabbed content (Overview / Specifications / Features), similar vehicles rail |
| **About** | Company story, values (3 cards), team members (4 cards), statistics bar, CTA section |
| **Contact** | Contact form, phone/email/address info, FAQ accordion section |
| **404** | Custom error page with navigation back to home |

---

## 2. The Theme: "Premium Dark"

### Design Philosophy

The core theme is **"Premium Dark"** — a sophisticated, automotive-luxury aesthetic that communicates trust, exclusivity, and modern technology. Think: the showroom experience of a high-end dealership, translated to the screen.

### Emotional Targets

| Emotion | How It's Achieved |
|---------|-------------------|
| **Trust** | Verified badges, real market data, transparent pricing, honest deal ratings |
| **Luxury / Exclusivity** | Deep dark surfaces, red accent, serif display headings, 4-layer depth system |
| **Clarity** | 3-tier text hierarchy, generous spacing, clean typography |
| **Modern / Technical** | Subtle gradients, glassmorphism on nav, CSS custom property architecture |
| **Warmth** | Red accent humanizes the dark palette; not cold or sterile |

### Mood / Direction

- **NOT a generic car listing site.** It should feel like a curated gallery, not a classifieds board.
- **NOT flashy or over-animated.** Subtle hover lifts, smooth transitions, professional restraint.
- **Inspiration:** Tesla's website clarity + Porsche's premium feel + Apple's spacing discipline + a luxury hotel lobby's ambiance.

---

## 3. Complete Design Token System

The entire visual system is defined through CSS custom properties (design tokens). Every component references these tokens — nothing is hardcoded.

### 3.1 Color Palette

#### Surfaces (4-Layer Depth System)

| Token | Hex | Use |
|-------|-----|-----|
| `--bg` | `#08090d` | Page background — near-black with a blue-cold undertone |
| `--surface-1` | `#0f1117` | Cards, containers, primary elevated content |
| `--surface-2` | `#151820` | Hover states, inner containers, gallery thumbnails |
| `--surface-3` | `#1c1f2a` | Input backgrounds, active states |
| `--surface-4` | `#242836` | Deep active states, selected items |

Each layer adds approximately +7-8 lightness while maintaining the same blue-undertone hue. This creates a natural depth illusion without relying on shadows alone.

#### Borders (3-Level Opacity)

| Token | Value | Use |
|-------|-------|-----|
| `--border` | `rgba(255,255,255,0.06)` | Default subtle dividers |
| `--border-h` | `rgba(255,255,255,0.12)` | Hover state borders |
| `--border-a` | `rgba(255,255,255,0.18)` | Active/focused borders |

#### Text Hierarchy

| Token | Hex | Use |
|-------|-----|-----|
| `--text-1` | `#eaeaef` | Primary headings, prices, key info — near-white |
| `--text-2` | `#9ca3b8` | Body text, descriptions — mid-gray with blue tint |
| `--text-3` | `#6b7385` | Labels, muted info, captions — dark gray |

#### Primary Accent: Red

| Token | Hex | Use |
|-------|-----|-----|
| `--accent` | `#e63946` | Primary red — CTAs, logo highlight, active nav, icons |
| `--accent-h` | `#d02e3a` | Hover state — slightly darker |
| `--accent-sub` | `rgba(230,57,70,0.10)` | Subtle backgrounds behind red icons |
| `--accent-t` | `#ff8a8a` | Light tint for text on dark backgrounds |

This red is the **signature brand color** — it appears in the logo, all primary buttons, the hero radial gradient, icon containers, active navigation states, phone number icons, and card favorite buttons.

#### Semantic Colors

| Token | Hex | Purpose |
|-------|-----|---------|
| `--green` / `--green-dim` | `#22c55e` / `rgba(34,197,94,0.10)` | "Great Deal" badges, savings, "Best Value" variant |
| `--blue` / `--blue-dim` | `#3b82f6` / `rgba(59,130,246,0.10)` | "Low Mileage" variant highlight |
| `--amber` / `--amber-dim` | `#f59e0b` / `rgba(245,158,11,0.10)` | "Just Arrived" / "Newly Listed" variant |
| `--gold` | `#eab308` | Premium indicators, "Editor's Picks" rail icon |
| `--red` | `#ef4444` | "Above Market" deal badge |

### 3.2 Typography

| Font | Weight(s) | Use |
|------|-----------|-----|
| **Playfair Display** (serif) | 800 (Extra Bold) | Hero headings only — adds editorial luxury |
| **Inter** (sans-serif) | 400, 500, 600, 700, 800 | Everything else — body, UI, labels, prices |

**Type Scale:**

| Class | Size | Weight | Use |
|-------|------|--------|-----|
| `.h1` | `clamp(2.25rem, 5vw, 3.5rem)` | 800 | Hero headings (Playfair Display) |
| `.h2` | `1.5rem` | 700 | Section headings |
| `.h3` | `1.0625rem` | 600 | Card titles, sub-headings |
| `.body-lg` | `1.0625rem` | 400 | Large body text |
| `.label` | `0.6875rem` | 600 | Uppercase labels, section tags |
| `.subtitle` | `1rem` | 400 | Section descriptions, max-width 520px |
| Price (`.car-card-price`) | `1.375rem` | 800 | Largest text on cards — primary visual anchor |

### 3.3 Spacing Scale

12-step scale for consistent rhythm:

```
2px → 4px → 6px → 8px → 12px → 16px → 20px → 24px → 32px → 40px → 48px → 64px → 80px → 96px
```

Key usage patterns:
- **Section padding**: 96px vertical
- **Container max-width**: 1200px with 24px horizontal padding
- **Card internal padding**: 16px
- **Grid gaps**: 20px (cards), 24px (trust items), 10px (search fields)
- **Between section label and heading**: 8px
- **Between heading and subtitle**: 4-6px

### 3.4 Border Radius Scale

| Token | Value | Use |
|-------|-------|-----|
| `--r-sm` | `6px` | Buttons, links, small elements |
| `--r-md` | `10px` | Inputs, selects, standard cards |
| `--r-lg` | `14px` | Car cards, major containers |
| `--r-xl` | `20px` | Search module, hero elements |
| `--r-full` | `100px` | Pills, chips, badges, round buttons |

### 3.5 Elevation (Box Shadows)

| Token | Value | Use |
|-------|-------|-----|
| `--el-1` | `0 1px 2px rgba(0,0,0,0.3)` | Subtle lift |
| `--el-2` | `0 4px 12px rgba(0,0,0,0.35)` | Active card state |
| `--el-3` | `0 8px 28px rgba(0,0,0,0.45)` | Card hover, search module |
| `--el-4` | `0 16px 48px rgba(0,0,0,0.5)` | Modals, overlays |

### 3.6 Motion / Transitions

| Token | Value | Use |
|-------|-------|-----|
| `--ease` | `0.18s cubic-bezier(.4,0,.2,1)` | Fast micro-interactions (hover, focus) |
| `--ease-m` | `0.3s cubic-bezier(.4,0,.2,1)` | Medium transitions (card lift, nav scroll) |
| `--ease-l` | `0.45s cubic-bezier(.4,0,.2,1)` | Slow reveals (scroll animations) |

All animations respect `prefers-reduced-motion` — completely disabled when user has motion sensitivity.

---

## 4. Key UI Components

### 4.1 Navbar

- **Fixed position**, transparent on page load, becomes frosted glass (`rgba(8,9,13,0.92)` + `backdrop-filter: blur(20px)`) on scroll
- Height: 64px
- Logo: car icon (red) + "Auto" (white) + "Elite" (red, bold)
- Links: muted gray, white on hover/active
- Right side: phone number with red phone icon + red "Browse Cars" CTA button
- Mobile: hamburger toggle (3 spans that animate into an X)

### 4.2 Car Card (V2 — Primary Component)

The car card is the most important design element. It has 7 anatomical layers:

1. **Image area** — 16:10 aspect ratio, lazy-loaded, subtle 3% scale on hover. Badges (condition + deal) top-left. Favorite heart button top-right (frosted glass circle). Variant tag bar at bottom of image.
2. **Price row** — THE largest text on the card (1.375rem, weight 800). Monthly estimate in small gray text beside it.
3. **Variant highlight** — Contextual one-liner in semantic color:
   - Green: "$3,750 below market" (Best Value)
   - Blue: "Only 1,250 mi" (Low Mileage)
   - Amber: "Listed 2 days ago" (Newly Listed)
4. **Title + Location** — Vehicle name (clamped to 2 lines) + city/state with red map pin
5. **Specs row** — Icons + text: mileage, fuel type, transmission, days on market. Separated by a top border line.
6. **Trust line** — Green text with checkmark icons (e.g., "Verified VIN", "Franchise Dealer"). Max 2 shown.
7. **CTA actions** — "View Details" primary button + save/bookmark icon button

**Variant accent**: subtle 3px left border in the semantic color (green/blue/amber)

### 4.3 Search Module (Hero)

- Elevated container on `--surface-1` with `--el-3` shadow and `--r-xl` radius
- Tabs at top: All / New / Pre-Owned (pill toggle on `--surface-2` background)
- 4-column grid of labeled select inputs (Make, Model, Price, Body Type)
- Full-width red search button at bottom

### 4.4 Section Pattern

Sections follow a consistent layout:
- `label` (uppercase, tiny, muted) → `h2` heading → `subtitle` description
- Content area below with consistent grid gaps
- 96px vertical padding between sections

### 4.5 Footer

- 4-column grid: About/Logo + Pages links + Browse by type + Contact info
- Social icons (Facebook, Instagram, Twitter/X, YouTube)
- Bottom bar: copyright + Privacy/Terms links
- Dark surface with subtle border-top separator

### 4.6 Trust Bar

- 4-column grid of trust items
- Each: colored icon container (red background tint) + title + description
- Items: "Verified Vehicles", "Best Prices", "Certified Dealers", "24/7 Support"

---

## 5. Current Design Problems (For the Expert to Address)

### 5.1 About Page — Visually Broken (CRITICAL)

The About page (`about.html`) was recently rewritten and now uses the correct CSS classes, BUT it still needs design polish. Key areas needing attention:

- **Team cards** — need a more premium look (currently using colored initial avatars like "MJ", "ER")
- **Stats bar** — numbers feel flat, could use more visual impact
- **Values section** — reuses the features-grid component; could benefit from unique visual treatment
- **CTA section** — needs stronger visual punch as the page's climax
- **Overall spacing and visual hierarchy** — needs an expert eye to ensure it matches the premium quality of the Home and Inventory pages

### 5.2 Missing Visual Assets

| Asset | Status | Need |
|-------|--------|------|
| **Logo** | Text-only with Font Awesome car icon | Need a proper brand logo (wordmark + icon) |
| **Favicon** | Missing entirely | Need favicon.ico + apple-touch-icon (16px, 32px, 180px) |
| **OG Image** | Referenced but doesn't exist | Need og-home.jpg (1200x630) for social sharing |
| **Hero background** | Currently a subtle radial gradient only | Could benefit from a faint background image or texture |
| **Team photos** | Using letter avatars ("MJ", "ER") | Need real photos or polished illustrated avatars |
| **About page imagery** | Building icon placeholder | Need a real dealership/showroom image or illustration |

### 5.3 UX Gaps Needing Design Solutions

| Gap | Current State | Design Need |
|-----|---------------|-------------|
| **Empty search results** | Shows loading skeleton forever | Need a designed "No results found" state with suggestions |
| **Comparison feature** | Referenced in specs but not built | Need a compare UI (side-by-side cards?) |
| **Favorites persistence** | Heart button toggles but doesn't save | Need a "Saved Vehicles" page/drawer design |
| **Financing calculator** | Not built yet | Need a calculator widget design (monthly payments, rates) |
| **Contact page map** | Just contact info, no visual | Need a Google Maps embed area or styled map section |
| **Loading states** | Skeleton cards exist (good) | Need loading states for other components (filters, details page) |
| **Error states** | 404 page exists | Need error states for failed API calls, offline mode |
| **Privacy & Terms pages** | Links go to `#` (dead) | Need designed legal pages or at least a template |

### 5.4 Mobile Experience Gaps

| Issue | Detail |
|-------|--------|
| Gallery thumbnails overflow on mobile without scroll indicator | Need visible horizontal scroll affordance |
| Inventory filter sidebar becomes very long on mobile | Need a drawer/modal filter approach for mobile |
| Trust line and DOM age hidden on small screens | Information loss on mobile — find alternative placement? |
| Brand marquee has no visible repeat gap | Can look glitchy mid-scroll |

---

## 6. Brand Identity

### Current Brand Elements

| Element | Current | Notes |
|---------|---------|-------|
| **Name** | AutoElite | May change to actual business name |
| **Tagline** | "Premium vehicles, honest pricing" | Used in hero tag line |
| **Secondary tagline** | "Browse verified listings with transparent pricing. Every vehicle inspected, every detail honest." | Hero subtitle |
| **Logo** | `<i class="fas fa-car-side"></i> Auto<strong>Elite</strong>` | Text + icon, red accent on "Elite" |
| **Color identity** | Dark backgrounds + red accent | Consistent across all pages |
| **Voice** | Professional, trustworthy, premium but approachable | Not stuffy, not casual |
| **Location** | Portland, OR | |
| **Phone** | 909 302 240 | |
| **Email** | abesannat@gmail.com | |
| **Hours** | Mon–Sat 9am–8pm, Sun 10am–6pm | |

### Brand Personality Keywords
- Trustworthy
- Premium
- Transparent
- Modern
- Curated (not just a listing dump)
- Data-driven (market context, scoring)
- Honest (trust signals are truthful, not inflated)

---

## 7. Technical Constraints

The design expert should be aware of these implementation realities:

| Constraint | Detail |
|-----------|--------|
| **No build step** | No Sass, no PostCSS, no Tailwind — pure CSS with custom properties |
| **No frameworks** | No React, no Vue — vanilla HTML + JS. Components are rendered via JavaScript template literals |
| **Font Awesome 6.5** | Icon library (CDN). ~30 icons currently used. Consider SVG subset for performance |
| **Google Fonts** | Inter (body) + Playfair Display (headings). `display=swap` enabled |
| **Image source** | Vehicle images come from MarketCheck API (external URLs). No control over image quality/dimensions |
| **Responsive targets** | 320px minimum → 480px → 768px → 1024px → 1200px max-width |
| **Accessibility** | WCAG AA compliance required. Focus rings, ARIA labels, skip links, 44px touch targets |
| **Dark mode only** | No light mode toggle — the dark theme IS the brand |

---

## 8. Competitive Landscape & Inspiration

### Direct Competitors (Car Dealership Sites)

| Site | What to learn | What to avoid |
|------|---------------|---------------|
| **Carvana** | Clean card layout, trust messaging | Overly playful tone, busy interface |
| **Vroom** | Photography quality emphasis | Generic, lacks personality |
| **Cars.com** | Filter system, faceted search | Cluttered, too many ads/CTAs |
| **CarMax** | Transparency messaging, price guarantees | Light theme, corporate feel |
| **AutoTrader** | Comprehensive filters, comparison tools | Dated design, information overload |

### Non-Auto Inspiration

| Site | What's relevant |
|------|-----------------|
| **Tesla.com** | Clean hero sections, minimal navigation, breathing room |
| **Porsche.com** | Premium dark aesthetic, configurator UX, lifestyle photography |
| **Apple.com** | Typography hierarchy, whitespace mastery, product showcase |
| **Stripe.com** | Dark gradients done right, developer-grade design precision |
| **Linear.app** | Dark theme with colored accents, beautiful card components |

---

## 9. Deliverables Requested

### Priority 1 — Brand & Visual Identity
- [ ] Refined logo concept (wordmark + icon, works at 16px and 180px)
- [ ] Favicon set (16px, 32px, 180px apple-touch-icon)
- [ ] OG share image template (1200x630)
- [ ] Color palette refinement (are the current tokens optimal?)
- [ ] Typography audit (is Inter + Playfair the right pairing?)

### Priority 2 — Page-Level Design Review
- [ ] Home page — hero section impact, rail layouts, trust bar effectiveness
- [ ] Inventory page — filter sidebar UX, card grid density, pagination design
- [ ] Car Details page — gallery behavior, spec tabs, dealer info layout
- [ ] About page — team section, values cards, stats bar, overall premium feel
- [ ] Contact page — form layout, FAQ section, trust/credibility elements
- [ ] 404 page — brand-consistent error experience

### Priority 3 — Component Refinement
- [ ] Car card V2 — is the 7-layer anatomy optimal? Badge placement? CTA hierarchy?
- [ ] Search module — tab/filter UX, mobile behavior
- [ ] Trust badges — visual weight, placement strategy
- [ ] Deal badges — are "Great Deal" / "Fair Price" / "Above Market" the right labels?
- [ ] Empty/error/loading states

### Priority 4 — New Feature Designs
- [ ] Saved Vehicles page or drawer
- [ ] Vehicle comparison (side-by-side)
- [ ] Financing calculator widget
- [ ] Google Maps integration on contact page
- [ ] Privacy / Terms page template

---

## 10. File Reference

For hands-on review, the key files are:

| File | Purpose | Size |
|------|---------|------|
| `public/css/style.css` | Complete design system + all component styles | 660 lines |
| `public/index.html` | Home page structure | ~420 lines |
| `public/inventory.html` | Inventory page structure | ~280 lines |
| `public/car-details.html` | Car detail page structure | ~350 lines |
| `public/about.html` | About page structure | ~250 lines |
| `public/contact.html` | Contact page structure | ~270 lines |
| `public/404.html` | Error page | ~50 lines |
| `public/js/app.js` | Card rendering logic (important for understanding dynamic components) | 817 lines |

The live site runs at `http://localhost:1335` via `node server.js`.

---

## 11. Summary for the Design Expert

**In one paragraph:** AutoElite is a premium dark-themed car dealership platform built with zero dependencies and a sophisticated custom data pipeline. The design system is well-architected with 40+ design tokens, a 4-layer surface depth model, and a complete component library. What we need is a design expert's eye to elevate it from "good developer design" to "exceptional product design" — refining the visual identity (logo, favicon, OG images), polishing page layouts (especially the About page), designing missing UX states (empty, error, comparison, saved vehicles, financing), and ensuring the premium dark aesthetic is consistently world-class across every pixel. The foundation is solid; we need the artistry.

---

*This brief was compiled from the full codebase analysis of 18 project files, live server testing, and cross-referenced with the project's audit and overview documents.*
