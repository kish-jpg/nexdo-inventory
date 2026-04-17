# Dashboard Visual Redesign — Design Spec
**Date:** 2026-04-17
**Scope:** Dashboard page (`app/page.tsx` + `app/globals.css`)
**Goal:** Elevate the dashboard to a premium hospitality SaaS aesthetic — dark, warm, pro-level — while also restructuring the layout hierarchy for better visual flow.

---

## 1. Direction

**Elevated Hospitality SaaS.** Dark base, warm off-white text, gold ops accent, Radisson RED reserved for brand and critical alerts only. Feels purpose-built for the property — not a generic inventory tool.

---

## 2. Color & Token System

All tokens defined in `globals.css` as CSS custom properties.

### Base Layers
| Token | Value | Use |
|---|---|---|
| `--bg` | `#08080E` | Page background |
| `--surface` | `#10101A` | Card base |
| `--surface-raised` | `#171724` | Elevated panels |
| `--border` | `rgba(255,255,255,0.07)` | Dividers, card outlines |
| `--border-strong` | `rgba(255,255,255,0.13)` | Active/focused borders |

### Text
| Token | Value | Use |
|---|---|---|
| `--text` | `#F0EEE8` | Warm off-white — primary text |
| `--text-muted` | `#8A8799` | Secondary labels |
| `--text-subtle` | `#50505A` | Timestamps, item codes |

### Accent — Dual Brand
| Token | Value | Use |
|---|---|---|
| `--red` | `#E31937` | Radisson brand + critical stock alerts only |
| `--gold` | `#C9A84C` | Ops accent — reorder badges, card top-border warnings |
| `--green` | `#22C55E` | Stock OK status |
| `--amber` | `#F59E0B` | Low stock status |
| `--blue` | `#60A5FA` | Links, demand chart line |

---

## 3. Typography Scale

| Element | Font | Size | Weight | Notes |
|---|---|---|---|---|
| Page title | JetBrains Mono | 13px | 600 | Uppercase, `letter-spacing: 0.12em` |
| Card titles | Inter/system-ui | 11px | 600 | Uppercase, `letter-spacing: 0.08em` |
| KPI numbers | JetBrains Mono | 48px | 700 | `tabular-nums` |
| KPI labels | Inter | 11px | 500 | Uppercase, `--text-muted` |
| Body/table rows | Inter | 13px | 500 | `--text` |
| Codes/timestamps | JetBrains Mono | 10–11px | 400 | `--text-subtle` |

---

## 4. Layout Hierarchy

The page restructures into a clear top-to-bottom visual flow:

```
┌─────────────────────────────────────────────┐
│  PROPERTY HEADER  (RED badge · time · ops)  │
├──────────┬──────────┬──────────┬────────────┤
│  KPI     │  KPI     │  KPI     │  KPI       │  full-width strip, large numbers
├──────────┴──────────┴──────────┴────────────┤
│                                             │
│  DEMAND CHART (60%)  │  REORDER LIST (40%)  │  chart leads (hotel context first)
│                      │                      │
├──────────────────────┴──────────────────────┤
│                                             │
│  CAT. HEALTH (40%)   │  RECENT ACTIVITY(60%)│  activity gets more space
│                      │                      │
└─────────────────────────────────────────────┘
```

**Key changes from current layout:**
- Demand chart moves to Row 1 left (prominent, hotel context)
- Category health + recent activity swap — activity gets 60% width
- KPI numbers go large (48px) — first visual anchor on the page
- Asymmetric columns replace equal 50/50 splits throughout

---

## 5. Component Details

### Property Header
- Left: `RADISSON RED` badge (RED background, white text, mono font) + property name + subtitle (laundry order cutoff)
- Right: OPERATIONAL status dot + live time + refresh button + Inventory link
- Bottom border: `1px solid var(--border)`

### KPI Cards
- Background: `--surface` with `1px solid var(--border)` outline
- Top accent border: `2px solid` — color matches status (green/amber/red/blue)
- KPI number: 48px mono tabular
- KPI label: 11px uppercase
- No shadows, no gradients

### Glass Cards (content panels)
- Background: `--surface`
- Border: `1px solid var(--border)`
- Card header: `--surface-raised` background, uppercase title, optional badge
- Hover state on table rows: `background: rgba(255,255,255,0.03)`

### Card Top-Border Accents
- Warning state (reorder items): `border-top: 2px solid var(--gold)`
- Critical state (out of stock): `border-top: 2px solid var(--red)`
- Default: no top accent

### Reorder List
- Gold badge for item count (replaces current red badge — RED reserved for critical)
- Critical rows: subtle `rgba(227,25,55,0.06)` row background
- Order quantity column: gold colored, bold

### Status Badges
- `tx-add` (Received): green tint
- `tx-remove` (Used): red tint
- `tx-stock` (Initial Count): muted tint

---

## 6. What Is NOT Changing

- No animations added (baseline-ui rule: only animate when explicitly requested)
- No new data fetching logic or API changes
- No changes to `/inventory`, `/laundry`, `/reports`, `/nexdo` pages in this pass
- Data model and Prisma schema untouched
- All existing functionality preserved

---

## 7. Files in Scope

| File | Change |
|---|---|
| `app/globals.css` | Replace all CSS tokens and component classes with new design system |
| `app/page.tsx` | Update layout structure, class names, inline styles to match new hierarchy |

---

## 8. Success Criteria

- Dashboard looks visually premium — a hotel GM or ops manager would be impressed
- Radisson RED appears only on: property header badge + critical stock alerts
- Gold accent used consistently for ops warnings and highlights
- KPI numbers are the first visual anchor on the page
- No regressions to data display or functionality
