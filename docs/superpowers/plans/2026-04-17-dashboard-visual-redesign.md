# Dashboard Visual Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Elevate the dashboard to a premium hospitality SaaS aesthetic — richer dark tokens, gold ops accent, Radisson RED reserved for brand/critical only, larger KPI numbers, and a restructured two-row layout.

**Architecture:** Two files only — `globals.css` gets updated tokens and new gold/surface utilities; `app/page.tsx` gets a restructured layout (chart+reorder row 1, health+activity row 2) and updated class/inline-style references. No API, schema, or other page changes.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS v4, plain CSS custom properties, Chart.js / react-chartjs-2

---

## File Map

| File | What changes |
|---|---|
| `app/globals.css` | Update dark-mode color tokens; add `--gold`, `--gold-soft`, `--surface`, `--surface-raised`; bump `--fs-kpi` to 48px; change KPI card accent to top border; add `.badge-gold`, `.card-top-gold`, `.card-top-red` |
| `app/page.tsx` | Add RED brand badge to page header; restructure two-col rows (chart 60%/reorder 40% row 1, health 40%/activity 60% row 2); swap reorder badge to gold; add `.card-top-gold` to reorder card |

---

## Task 1: Update color tokens and add gold + surface tokens

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 1: Replace the dark-mode base color block**

In `app/globals.css`, find the `/* ── Colours: Dark (default) — Crimson Command ─────────────────── */` block and replace the bg/card/text tokens:

```css
  /* ── Colours: Dark (default) — Crimson Command ─────────────────── */
  --bg:           #08080E;   /* deep near-black                            */
  --bg-sub:       #10101A;   /* modal / card sub-bg                        */
  --sidebar-bg:   #0C0C14;   /* sidebar separation from main bg            */
  --surface:      #10101A;   /* card base                                  */
  --surface-raised: #171724; /* elevated panels, card headers              */
  --card-bg:      #10101A;   /* kept for backward compat                   */
  --card-border:  rgba(255,255,255,0.08);
  --hover-bg:     rgba(255,255,255,0.04);
  --input-bg:     rgba(255,255,255,0.06);
  --input-border: rgba(255,255,255,0.12);

  --text:         #F0EEE8;   /* warm off-white                             */
  --text-muted:   #8A8799;   /* secondary labels                           */
  --text-subtle:  #50505A;   /* timestamps, item codes                     */
  --border:       rgba(255,255,255,0.07);
```

- [ ] **Step 2: Add gold tokens after the `--blue-soft` line**

Find `--blue-soft:    rgba(59, 130, 246, 0.12);` and add after it:

```css
  --gold:         #C9A84C;
  --gold-soft:    rgba(201, 168, 76, 0.12);
```

- [ ] **Step 3: Bump KPI font size**

Find `--fs-kpi:  36px;` and change to:

```css
  --fs-kpi:  48px;   /* KPI values — large visual anchor                  */
```

- [ ] **Step 4: Verify the dev server compiles without errors**

Run: `cd C:/Users/Nexdo/Nex_Doc/Inventory/inventory-system && npm run dev`

Expected: Server starts on `http://localhost:3000` with no CSS errors in terminal.

Stop the server (`Ctrl+C`) before continuing.

- [ ] **Step 5: Commit**

```bash
cd "C:/Users/Nexdo/Nex_Doc/Inventory/inventory-system"
git add app/globals.css
git commit -m "design: update dark-mode tokens — gold accent, surface layers, 48px KPI"
```

---

## Task 2: Add card header background and new utility classes

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 1: Update `.card-header` to use `--surface-raised`**

Find `.card-header {` and update its background:

```css
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--sp-4) var(--sp-5);
  border-bottom: 1px solid var(--border);
  background: var(--surface-raised);
}
```

- [ ] **Step 2: Switch KPI cards from left-border to top-border accent**

Find the `.kpi-card` block and replace it:

```css
.kpi-card {
  background: var(--surface);
  border: 1px solid var(--card-border);
  border-radius: var(--radius);
  padding: var(--sp-5);
  box-shadow: var(--shadow);
  border-top-width: 2px;
  transition: box-shadow var(--dur-normal) ease;
}

.kpi-card:hover { box-shadow: 0 4px 24px rgba(0,0,0,0.35); }
.kpi-card.kpi-blue  { border-top-color: var(--blue); }
.kpi-card.kpi-green { border-top-color: var(--green); }
.kpi-card.kpi-amber { border-top-color: var(--amber); }
.kpi-card.kpi-red   { border-top-color: var(--red); }
```

- [ ] **Step 3: Add top-border accent utilities and gold badge**

After the `.badge-blue` line, add:

```css
.badge-gold   { background: var(--gold-soft);  color: var(--gold); }

/* Card top-border accents for warning/critical state */
.card-top-gold { border-top: 2px solid var(--gold); }
.card-top-red  { border-top: 2px solid var(--red); }
```

- [ ] **Step 4: Update `.glass-card` to use `--surface` background**

Find `.glass-card {` and update:

```css
.glass-card {
  background: var(--surface);
  border: 1px solid var(--card-border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  overflow: hidden;
}
```

(Remove the `backdrop-filter` lines — they're expensive and not needed with a solid background.)

- [ ] **Step 5: Commit**

```bash
cd "C:/Users/Nexdo/Nex_Doc/Inventory/inventory-system"
git add app/globals.css
git commit -m "design: card-header surface-raised, top-border KPI accents, gold badge utility"
```

---

## Task 3: Redesign the property header in page.tsx

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Replace the page header JSX**

Find the `{/* Page Header */}` block (lines ~189–226) and replace it:

```tsx
      {/* Page Header */}
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <span style={{
              background: 'var(--red)',
              color: 'white',
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '10px',
              fontWeight: 700,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              padding: '3px 8px',
              borderRadius: '4px',
            }}>
              Radisson RED
            </span>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '10px', color: 'var(--text-subtle)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Auckland
            </span>
          </div>
          <div className="page-title">DASHBOARD</div>
          <div className="page-sub">Sincerely Laundry — Order by 09:00</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div className="status-indicator">
            <div className="pulse-dot" />
            <span style={{ color: 'var(--green)' }}>OPERATIONAL</span>
          </div>
          <span style={{ fontFamily: 'JetBrains Mono', fontSize: '11px', color: 'var(--text-muted)' }}>
            {currentTime}
          </span>
          <button
            onClick={fetchDashboard}
            aria-label="Refresh dashboard"
            style={{
              background: 'none', border: '1px solid var(--border)',
              color: 'var(--text-muted)', borderRadius: '6px',
              padding: '5px 10px', cursor: 'pointer', fontSize: '13px',
            }}
          >
            ↻
          </button>
          <Link
            href="/inventory"
            className="btn btn-primary btn-sm"
            style={{ textDecoration: 'none', fontFamily: 'JetBrains Mono', letterSpacing: '0.04em' }}
          >
            Inventory →
          </Link>
        </div>
      </div>
```

- [ ] **Step 2: Verify the header renders correctly**

Run the dev server and open `http://localhost:3000`. Confirm:
- RED pill badge appears left of the page title
- "Auckland" appears in subtle text beside it
- Layout looks correct at 1280px width

- [ ] **Step 3: Commit**

```bash
cd "C:/Users/Nexdo/Nex_Doc/Inventory/inventory-system"
git add app/page.tsx
git commit -m "design: property header — RED brand badge + Auckland label"
```

---

## Task 4: Restructure the two-col rows and update reorder badge

**Files:**
- Modify: `app/page.tsx`

The current layout has:
- Row 1: Category Health (55%) | Reorder List (45%)
- Row 2: Demand Chart (55%) | Recent Activity (45%)

Target layout:
- Row 1: Demand Chart (60%) | Reorder List (40%)
- Row 2: Category Health (40%) | Recent Activity (60%)

- [ ] **Step 1: Replace the two `{/* Row 1 */}` and `{/* Row 2 */}` layout blocks**

Find the `{/* Row 1: Category Health + Reorder List */}` comment and replace both row divs with:

```tsx
          {/* Row 1: Demand Chart + Reorder List */}
          <div style={{ display: 'grid', gridTemplateColumns: '60fr 40fr', gap: '16px', marginBottom: '16px' }}>

            {/* Demand Chart */}
            <div className="glass-card">
              <div className="card-header">
                <span className="card-title">7-Day Demand Forecast</span>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono' }}>Opera PMS</span>
              </div>
              <div className="card-body" style={{ height: '260px' }}>
                <Bar data={demandData as any} options={demandOptions as any} />
              </div>
            </div>

            {/* Reorder List */}
            <div className={`glass-card${reorderList.length > 0 ? ' card-top-gold' : ''}`}>
              <div className="card-header">
                <span className="card-title">Reorder List</span>
                {reorderList.length > 0 && (
                  <span className="badge badge-gold">{reorderList.length} items</span>
                )}
              </div>
              {reorderList.length === 0 ? (
                <div className="card-body">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--green)', fontSize: '13px' }}>
                    <span>✓</span> All items are above reorder threshold.
                  </div>
                </div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ width: '5%', paddingLeft: '20px' }}></th>
                      <th style={{ width: '45%' }}>Item</th>
                      <th className="text-right" style={{ width: '17%' }}>Stock</th>
                      <th className="text-right" style={{ width: '17%' }}>Par</th>
                      <th className="text-right" style={{ width: '16%', paddingRight: '20px' }}>Order</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reorderList.slice(0, 8).map(item => (
                      <tr key={item.id} className={item.status === 'red' ? 'row-critical' : ''}>
                        <td style={{ paddingLeft: '20px' }}>
                          <div className="status-dot" style={{
                            background: item.status === 'red' ? 'var(--red)' : 'var(--amber)'
                          }} />
                        </td>
                        <td>
                          <div style={{ fontWeight: 600, fontSize: '12px' }}>{item.name}</div>
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono' }}>
                            {item.category}
                          </div>
                        </td>
                        <td className="text-right mono" style={{ color: 'var(--red)', fontWeight: 600 }}>
                          {item.stock}
                        </td>
                        <td className="text-right mono" style={{ color: 'var(--text-muted)' }}>
                          {item.targetStock}
                        </td>
                        <td className="text-right mono" style={{ color: 'var(--gold)', fontWeight: 600, paddingRight: '20px' }}>
                          {item.reorderQty ?? (item.targetStock - item.stock)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {reorderList.length > 0 && (
                <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)' }}>
                  <Link href="/inventory" style={{ fontSize: '11px', color: 'var(--gold)', textDecoration: 'none', fontWeight: 600, fontFamily: 'JetBrains Mono' }}>
                    VIEW ALL IN INVENTORY →
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Row 2: Category Health + Recent Activity */}
          <div style={{ display: 'grid', gridTemplateColumns: '40fr 60fr', gap: '16px', marginBottom: '16px' }}>

            {/* Category Health */}
            <div className="glass-card">
              <div className="card-header">
                <span className="card-title">Stock Health by Category</span>
              </div>
              <div className="card-body">
                {categoryHealth.length === 0 ? (
                  <div className="empty-state-sub mono">No data available</div>
                ) : (
                  categoryHealth.map(c => {
                    const pct = Math.min(100, Math.round(c.stockPct));
                    return (
                      <div key={c.name} className="bar-item">
                        <div className="bar-label">
                          <span>
                            <strong>{c.name}</strong>
                            <span style={{ marginLeft: 6, color: 'var(--text-subtle)', fontSize: '11px' }}>
                              {c.count} items
                            </span>
                          </span>
                          <span className="mono" style={{ fontSize: '11px', color: barColor(pct) }}>
                            {pct}%
                          </span>
                        </div>
                        <div className="bar-track">
                          <div className={`bar-fill ${barClass(pct)}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Recent Activity */}
            <div className="glass-card">
              <div className="card-header">
                <span className="card-title">Recent Stock Activity</span>
              </div>
              {recentTxs.length === 0 ? (
                <div className="card-body">
                  <div className="empty-state-sub mono">No transactions yet</div>
                </div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ width: '44%', paddingLeft: '20px' }}>Item</th>
                      <th style={{ width: '18%' }}>Type</th>
                      <th className="text-right" style={{ width: '16%' }}>Qty</th>
                      <th className="text-right" style={{ width: '22%', paddingRight: '20px' }}>Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentTxs.slice(0, 10).map(tx => (
                      <tr key={tx.id}>
                        <td style={{ paddingLeft: '20px' }}>
                          <div style={{ fontWeight: 600, fontSize: '12px' }}>{tx.item.name}</div>
                          {tx.reason && (
                            <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono' }}>
                              {tx.reason}
                            </div>
                          )}
                        </td>
                        <td>
                          <span className={txBadgeClass(tx.type)}>
                            {tx.type === 'add' ? 'Received' : tx.type === 'remove' ? 'Used' : 'Initial Count'}
                          </span>
                        </td>
                        <td className="text-right mono" style={{
                          fontWeight: 700,
                          color: tx.quantity >= 0 ? 'var(--green)' : 'var(--red)'
                        }}>
                          {tx.quantity >= 0 ? '+' : ''}{tx.quantity}
                        </td>
                        <td className="text-right mono" style={{ fontSize: '10px', color: 'var(--text-muted)', paddingRight: '20px' }}>
                          {new Date(tx.timestamp).toLocaleTimeString('en-NZ', { hour: '2-digit', minute: '2-digit' })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
```

- [ ] **Step 2: Remove the now-redundant old two-col rows**

The old `{/* Row 2: Demand Chart + Recent Activity */}` block was replaced above. Verify the file no longer contains both the old and new versions — there should be exactly one `Row 1` and one `Row 2` comment block.

- [ ] **Step 3: Commit**

```bash
cd "C:/Users/Nexdo/Nex_Doc/Inventory/inventory-system"
git add app/page.tsx
git commit -m "design: restructure dashboard layout — chart/reorder row 1, health/activity row 2"
```

---

## Task 5: Final visual check and cleanup

**Files:**
- Modify: `app/globals.css` (minor)
- Modify: `app/page.tsx` (minor)

- [ ] **Step 1: Remove `backdrop-filter` from `kpi-card` if still present**

Search `globals.css` for `backdrop-filter` inside `.kpi-card` and remove those lines if they remain. The solid `--surface` background makes them redundant.

- [ ] **Step 2: Verify the `two-col` class is no longer used in page.tsx**

The new layout uses inline `style` grid instead of the `.two-col` class. Run:

```bash
grep -n "two-col" "C:/Users/Nexdo/Nex_Doc/Inventory/inventory-system/app/page.tsx"
```

Expected: no matches. The `.two-col` class can stay in CSS for other pages — don't delete it.

- [ ] **Step 3: Start dev server and do a full visual check**

Run: `npm run dev` and open `http://localhost:3000`

Check:
- Page background is noticeably deeper/darker (`#08080E`)
- RED badge appears in the header above the title
- KPI numbers are large (48px)
- KPI cards have top color accent (not left)
- Row 1: Demand chart on left (wider), Reorder list on right (narrower)
- Row 2: Category health on left (narrower), Recent activity on right (wider)
- Reorder list badge and "VIEW ALL" link use gold (`#C9A84C`), not red
- Card headers have a slightly elevated background vs card body
- No console errors

- [ ] **Step 4: Final commit**

```bash
cd "C:/Users/Nexdo/Nex_Doc/Inventory/inventory-system"
git add app/globals.css app/page.tsx
git commit -m "design: dashboard visual redesign complete — premium dark SaaS aesthetic"
```
