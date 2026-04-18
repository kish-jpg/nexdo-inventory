'use client';

import { useState, useEffect, useCallback } from 'react';
import Modal from '@/app/components/Modal';

// ─── Types ────────────────────────────────────────────────────────────────────

type NexDoItem = {
  id: number; code: string; name: string; category: string; subcategory: string;
  unit: string; stock: number; targetStock: number; reorderPoint: number;
  reorderQty: number; unitCost: number | null; notes: string; status: string; lastUpdated: string;
};

type DashStats = {
  kpis: { total: number; green: number; amber: number; red: number; needsRestock: number; totalValue: number };
  categoryBreakdown: { name: string; count: number; value: number; low: number }[];
  recentTxs: any[];
};

const CATEGORIES = ['All', 'Equipment', 'Chemicals', 'Tools', 'Safety'];

const CAT_COLORS: Record<string, string> = {
  Equipment: 'var(--blue)', Chemicals: 'var(--amber)', Tools: 'var(--green)', Safety: 'var(--red)',
};
const CAT_BG: Record<string, string> = {
  Equipment: 'var(--blue-soft)', Chemicals: 'var(--amber-soft)', Tools: 'var(--green-soft)', Safety: 'var(--red-soft)',
};

function fmtCurrency(v: number | null) {
  if (v == null) return '—';
  return `$${v.toFixed(2)}`;
}
function fmtDate(s: string) {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: '2-digit' });
}

// ─── Spinner ─────────────────────────────────────────────────────────────────

const Spinner = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
    className="is-spinning-icon" aria-hidden style={{ flexShrink: 0 }}>
    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
  </svg>
);

// ─── Adjust Stock Modal ───────────────────────────────────────────────────────

function AdjustModal({ item, onClose, onDone }: { item: NexDoItem; onClose: () => void; onDone: () => void }) {
  const [type, setType] = useState<'add' | 'remove' | 'stocktake'>('add');
  const [qty, setQty] = useState(0);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const preview = type === 'add' ? item.stock + qty
    : type === 'remove' ? Math.max(0, item.stock - qty)
    : qty;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (qty <= 0) { setError('Enter a quantity greater than 0.'); return; }
    setSaving(true); setError('');
    try {
      const res = await fetch(`/api/nexdo/items/${item.id}/adjust`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, quantity: qty, reason }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      onDone();
    } catch (e: any) { setError(e.message); setSaving(false); }
  }

  return (
    <Modal onClose={onClose} labelledBy="nx-adjust-title" maxWidth={420}>
        <div className="modal-header">
          <span className="modal-title" id="nx-adjust-title">Adjust Stock — {item.name}</span>
          <button className="modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <form onSubmit={submit}>
          <div className="stock-preview">
            <div><div className="stock-preview-label">Current</div><div className="stock-preview-num">{item.stock}</div></div>
            <div style={{ color: 'var(--text-subtle)', fontSize: 20 }}>→</div>
            <div><div className="stock-preview-label">After</div><div className="stock-preview-num" style={{ color: preview < item.reorderPoint ? 'var(--red)' : 'var(--green)' }}>{preview}</div></div>
            <div><div className="stock-preview-label">Unit</div><div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>{item.unit}</div></div>
          </div>
          <div className="adjust-type-row">
            {(['add', 'remove', 'stocktake'] as const).map(t => (
              <button key={t} type="button"
                className={`adjust-type-btn${type === t ? ` at-${t === 'stocktake' ? 'stock' : t}` : ''}`}
                onClick={() => setType(t)}>
                {t === 'stocktake' ? 'Stocktake' : t === 'add' ? 'Received' : 'Used / Lost'}
              </button>
            ))}
          </div>
          <div className="form-row">
            <label className="form-label">{type === 'stocktake' ? 'Actual count' : 'Quantity'}</label>
            <input className="form-input" type="number" min={0} value={qty} onChange={e => setQty(Math.max(0, parseInt(e.target.value) || 0))} />
          </div>
          <div className="form-row">
            <label className="form-label">Reason (optional)</label>
            <input className="form-input" placeholder="e.g. Delivery received, cloths worn out..." value={reason} onChange={e => setReason(e.target.value)} />
          </div>
          {error && <div className="error-box">{error}</div>}
          <div className="form-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving} style={{ gap: 6 }}>
              {saving && <Spinner />}{saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
    </Modal>
  );
}

// ─── Add Item Modal ───────────────────────────────────────────────────────────

function AddItemModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState({
    code: '', name: '', category: 'Tools', subcategory: '', unit: 'Each',
    stock: 0, targetStock: 0, reorderPoint: 0, reorderQty: 0, unitCost: '', notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name) { setError('Name is required.'); return; }
    setSaving(true); setError('');
    try {
      const res = await fetch('/api/nexdo/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, unitCost: form.unitCost ? Number(form.unitCost) : null }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      onDone();
    } catch (e: any) { setError(e.message); setSaving(false); }
  }

  return (
    <Modal onClose={onClose} labelledBy="nx-add-title" maxWidth={520}>
        <div className="modal-header">
          <span className="modal-title" id="nx-add-title">Add NexDo Item</span>
          <button className="modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <form onSubmit={submit}>
          <div className="form-two-col">
            <div className="form-row">
              <label className="form-label">Product Code</label>
              <input className="form-input" placeholder="e.g. CH005" value={form.code} onChange={set('code')} />
            </div>
            <div className="form-row">
              <label className="form-label">Category</label>
              <select className="form-input" value={form.category} onChange={set('category')}>
                {['Equipment', 'Chemicals', 'Tools', 'Safety'].map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row">
            <label className="form-label">Item Name *</label>
            <input className="form-input" placeholder="Full product name" value={form.name} onChange={set('name')} />
          </div>
          <div className="form-two-col">
            <div className="form-row">
              <label className="form-label">Subcategory</label>
              <input className="form-input" placeholder="e.g. Cloths, Machines..." value={form.subcategory} onChange={set('subcategory')} />
            </div>
            <div className="form-row">
              <label className="form-label">Unit</label>
              <select className="form-input" value={form.unit} onChange={set('unit')}>
                {['Each', 'Pack', 'Bottle', 'Unit', 'Roll', 'Box'].map(u => <option key={u}>{u}</option>)}
              </select>
            </div>
          </div>
          <div className="form-two-col">
            <div className="form-row">
              <label className="form-label">Current Stock</label>
              <input className="form-input" type="number" min={0} value={form.stock} onChange={set('stock')} />
            </div>
            <div className="form-row">
              <label className="form-label">Target Stock</label>
              <input className="form-input" type="number" min={0} value={form.targetStock} onChange={set('targetStock')} />
            </div>
            <div className="form-row">
              <label className="form-label">Reorder Point</label>
              <input className="form-input" type="number" min={0} value={form.reorderPoint} onChange={set('reorderPoint')} />
            </div>
            <div className="form-row">
              <label className="form-label">Reorder Qty</label>
              <input className="form-input" type="number" min={0} value={form.reorderQty} onChange={set('reorderQty')} />
            </div>
          </div>
          <div className="form-row">
            <label className="form-label">Unit Cost (NZD)</label>
            <input className="form-input" type="number" step="0.01" min={0} placeholder="0.00" value={form.unitCost} onChange={set('unitCost')} />
          </div>
          <div className="form-row">
            <label className="form-label">Notes</label>
            <input className="form-input" placeholder="Usage notes, location..." value={form.notes} onChange={set('notes')} />
          </div>
          {error && <div className="error-box" role="alert">{error}</div>}
          <div className="form-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving && <Spinner />}{saving ? 'Saving…' : 'Add Item'}
            </button>
          </div>
        </form>
    </Modal>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function NexDoPage() {
  const [tab, setTab] = useState<'overview' | 'items' | 'restock'>('overview');
  const [stats, setStats] = useState<DashStats | null>(null);
  const [items, setItems] = useState<NexDoItem[]>([]);
  const [restockItems, setRestockItems] = useState<NexDoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [catFilter, setCatFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [adjustItem, setAdjustItem] = useState<NexDoItem | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [emailCopied, setEmailCopied] = useState(false);

  const loadStats = useCallback(async () => {
    try {
      const res = await fetch('/api/nexdo/dashboard');
      const data = await res.json();
      setStats(data);
    } catch {/* ignore */}
  }, []);

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (catFilter !== 'All') params.set('category', catFilter);
      if (search) params.set('search', search);
      const res = await fetch(`/api/nexdo/items?${params}`);
      const data = await res.json();
      setItems(data.items ?? []);
    } catch {/* ignore */} finally { setLoading(false); }
  }, [catFilter, search]);

  const loadRestock = useCallback(async () => {
    try {
      const res = await fetch('/api/nexdo/restock');
      const data = await res.json();
      setRestockItems(data.items ?? []);
    } catch {/* ignore */}
  }, []);

  useEffect(() => { loadStats(); loadItems(); }, [loadStats, loadItems]);
  useEffect(() => { if (tab === 'restock') loadRestock(); }, [tab, loadRestock]);

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => loadItems(), 300);
    return () => clearTimeout(t);
  }, [search, loadItems]);

  function generateEmail() {
    if (!restockItems.length) return '';
    const bycat: Record<string, NexDoItem[]> = {};
    for (const item of restockItems) {
      if (!bycat[item.category]) bycat[item.category] = [];
      bycat[item.category].push(item);
    }
    const date = new Date().toLocaleDateString('en-NZ', { day: 'numeric', month: 'long', year: 'numeric' });
    let body = `Subject: NexDo Restock Request — Radisson RED Auckland — ${date}\n\nHi,\n\nPlease arrange the following items for Radisson RED Auckland:\n\n`;
    for (const [cat, catItems] of Object.entries(bycat)) {
      body += `${cat.toUpperCase()}:\n`;
      for (const item of catItems) {
        body += `• ${item.name} — Order ${item.reorderQty} ${item.unit}${item.unitCost ? ` @ ${fmtCurrency(item.unitCost)} ea` : ''} (Current stock: ${item.stock})\n`;
      }
      body += '\n';
    }
    body += `Thanks,\nKish\nHousekeeping Manager — Radisson RED Auckland`;
    return body;
  }

  async function copyEmail() {
    const text = generateEmail();
    await navigator.clipboard.writeText(text);
    setEmailCopied(true);
    setTimeout(() => setEmailCopied(false), 2500);
  }

  const filteredItems = items.filter(i => {
    const matchCat = catFilter === 'All' || i.category === catFilter;
    const matchSearch = !search || i.name.toLowerCase().includes(search.toLowerCase()) || i.code.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <div className="page-wrap theme-nexdo">
      {(adjustItem || showAdd) && (
        adjustItem
          ? <AdjustModal item={adjustItem} onClose={() => setAdjustItem(null)} onDone={() => { setAdjustItem(null); loadItems(); loadStats(); }} />
          : <AddItemModal onClose={() => setShowAdd(false)} onDone={() => { setShowAdd(false); loadItems(); loadStats(); }} />
      )}

      {/* Header */}
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <div className="nx-mark">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
            </div>
            <h1 className="page-title" style={{ margin: 0 }}>NexDo Inventory</h1>
            <span className="brand-chip brand-chip--ink">NexDo</span>
          </div>
          <p className="page-sub">Cleaning equipment & supplies — NexDo managed</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {tab === 'items' && (
            <button className="btn btn-primary" onClick={() => setShowAdd(true)} style={{ fontSize: 13 }}>
              + Add Item
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="tab-bar" role="tablist" aria-label="NexDo sections">
        {([
          { id: 'overview', label: 'Overview' },
          { id: 'items',    label: `Inventory${stats ? ` (${stats.kpis.total})` : ''}` },
          { id: 'restock',  label: `Restock Request${restockItems.length ? ` · ${restockItems.length}` : ''}` },
        ] as const).map(t => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className="tab"
          >{t.label}</button>
        ))}
      </div>

      {/* ── OVERVIEW ──────────────────────────────────────────────────────────── */}
      {tab === 'overview' && (
        <div>
          {/* KPIs */}
          <div className="kpi-grid stagger-in" style={{ marginBottom: 24 }}>
            <div className="kpi-card kpi-blue">
              <div className="kpi-label">Total Items</div>
              <div className="kpi-value">{stats?.kpis.total ?? '—'}</div>
              <div className="kpi-trend">across 4 categories</div>
            </div>
            <div className="kpi-card kpi-green">
              <div className="kpi-label">Stock OK</div>
              <div className="kpi-value">{stats?.kpis.green ?? '—'}</div>
              <div className="kpi-trend">above reorder point</div>
            </div>
            <div className="kpi-card kpi-amber">
              <div className="kpi-label">Low Stock</div>
              <div className="kpi-value">{(stats ? stats.kpis.amber + stats.kpis.red : 0)}</div>
              <div className="kpi-trend">need attention</div>
            </div>
            <div className="kpi-card kpi-red">
              <div className="kpi-label">Total Asset Value</div>
              <div className="kpi-value" style={{ fontSize: stats?.kpis.totalValue && stats.kpis.totalValue >= 10000 ? 24 : 36 }}>
                ${stats ? Math.round(stats.kpis.totalValue).toLocaleString() : '—'}
              </div>
              <div className="kpi-trend">NZD — current stock on hand</div>
            </div>
          </div>

          {/* Category breakdown */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 24 }}>
            {(stats?.categoryBreakdown ?? []).map(cat => (
              <div key={cat.name} className="glass-card" style={{ padding: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', borderRadius: 4, background: CAT_BG[cat.name] ?? 'var(--hover-bg)', color: CAT_COLORS[cat.name] ?? 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{cat.name}</span>
                  {cat.low > 0 && <span className="badge badge-amber">{cat.low} low</span>}
                </div>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 28, fontWeight: 600, color: 'var(--text)', lineHeight: 1 }}>{cat.count}</div>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                  ${Math.round(cat.value).toLocaleString()} value
                </div>
              </div>
            ))}
          </div>

          {/* Recent activity */}
          <div className="table-wrap">
            <div className="card-header" style={{ background: 'var(--card-bg)', borderBottom: '1px solid var(--border)', padding: '14px 18px' }}>
              <span className="card-title">Recent Activity</span>
            </div>
            {(stats?.recentTxs ?? []).length === 0 ? (
              <div className="empty-state"><div className="empty-state-title">No activity yet</div><div className="empty-state-sub">Adjustments will appear here</div></div>
            ) : (
              <table className="data-table">
                <thead><tr><th>Item</th><th>Type</th><th className="text-right">Qty</th><th>Reason</th><th>When</th></tr></thead>
                <tbody>
                  {(stats?.recentTxs ?? []).slice(0, 15).map((tx: any) => (
                    <tr key={tx.id}>
                      <td style={{ fontWeight: 500 }}>{tx.itemName}</td>
                      <td><span className={`badge ${tx.type === 'add' ? 'tx-add' : tx.type === 'remove' ? 'tx-remove' : 'tx-stock'}`}>
                        {tx.type === 'add' ? 'Received' : tx.type === 'remove' ? 'Used' : 'Initial Count'}
                      </span></td>
                      <td className="text-right mono" style={{ color: tx.quantity > 0 ? 'var(--green)' : 'var(--red)' }}>{tx.quantity > 0 ? '+' : ''}{tx.quantity}</td>
                      <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{tx.reason || '—'}</td>
                      <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{fmtDate(tx.timestamp)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── ITEMS ─────────────────────────────────────────────────────────────── */}
      {tab === 'items' && (
        <div>
          {/* Toolbar */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <div className="search-wrap" style={{ flex: 1, minWidth: 200 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)', flexShrink: 0 }} aria-hidden><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input aria-label="Search items or code" placeholder="Search items or code..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <div className="cat-filters">
              {CATEGORIES.map(c => (
                <button key={c} className={`cat-btn${catFilter === c ? ' active' : ''}`} onClick={() => setCatFilter(c)}>{c}</button>
              ))}
            </div>
          </div>

          <div className="table-wrap">
            {loading ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}><Spinner /></div>
            ) : filteredItems.length === 0 ? (
              <div className="empty-state"><div className="empty-state-title">No items found</div><div className="empty-state-sub">Try a different filter or add a new item</div></div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Item</th>
                    <th>Category</th>
                    <th className="text-right">Stock</th>
                    <th className="text-right">Target</th>
                    <th className="text-right">Reorder at</th>
                    <th className="text-right">Unit Cost</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map(item => (
                    <tr key={item.id} className={item.status === 'red' ? 'row-critical' : ''}>
                      <td className="mono" style={{ color: 'var(--text-muted)', fontSize: 11 }}>{item.code}</td>
                      <td>
                        <div style={{ fontWeight: 500 }}>{item.name}</div>
                        {item.notes && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{item.notes}</div>}
                      </td>
                      <td>
                        <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 4, background: CAT_BG[item.category] ?? 'var(--hover-bg)', color: CAT_COLORS[item.category] ?? 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{item.category}</span>
                      </td>
                      <td className="text-right mono" style={{ fontWeight: 600, color: item.stock <= item.reorderPoint ? 'var(--red)' : 'var(--text)' }}>{item.stock} <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: 11 }}>{item.unit}</span></td>
                      <td className="text-right mono" style={{ color: 'var(--text-muted)' }}>{item.targetStock}</td>
                      <td className="text-right mono" style={{ color: 'var(--text-muted)' }}>{item.reorderPoint}</td>
                      <td className="text-right mono">{fmtCurrency(item.unitCost)}</td>
                      <td>
                        <span className={`badge badge-${item.status === 'green' ? 'green' : item.status === 'amber' ? 'amber' : 'red'}`}>
                          <span className="status-dot" style={{ background: item.status === 'green' ? 'var(--green)' : item.status === 'amber' ? 'var(--amber)' : 'var(--red)' }} />
                          {item.status === 'green' ? 'OK' : item.status === 'amber' ? 'Low' : 'Critical'}
                        </span>
                      </td>
                      <td>
                        <button className="btn btn-sm btn-action-blue" onClick={() => setAdjustItem(item)}>Adjust</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── RESTOCK REQUEST ───────────────────────────────────────────────────── */}
      {tab === 'restock' && (
        <div>
          {restockItems.length === 0 ? (
            <div className="glass-card" style={{ padding: 60, textAlign: 'center' }}>
              <div style={{ fontSize: 36, marginBottom: 14 }}>✓</div>
              <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--text)', marginBottom: 6 }}>All stocked up</div>
              <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>No NexDo items are below their reorder point right now.</div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: 20, alignItems: 'start' }}>
              {/* Items needing restock */}
              <div className="table-wrap">
                <div className="card-header" style={{ background: 'var(--card-bg)', borderBottom: '1px solid var(--border)', padding: '14px 18px' }}>
                  <span className="card-title">Items to Order — {restockItems.length} items</span>
                  <button className="btn btn-ghost btn-sm" onClick={loadRestock} style={{ padding: '4px 10px' }}>Refresh</button>
                </div>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Category</th>
                      <th className="text-right">Stock</th>
                      <th className="text-right">Reorder at</th>
                      <th className="text-right">Order Qty</th>
                      <th className="text-right">Est. Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {restockItems.map(item => (
                      <tr key={item.id} className={item.stock === 0 ? 'row-critical' : ''}>
                        <td>
                          <div style={{ fontWeight: 500 }}>{item.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.code}</div>
                        </td>
                        <td><span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 4, background: CAT_BG[item.category] ?? 'var(--hover-bg)', color: CAT_COLORS[item.category] ?? 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace', fontSize: 10, fontWeight: 600, textTransform: 'uppercase' }}>{item.category}</span></td>
                        <td className="text-right mono" style={{ color: item.stock === 0 ? 'var(--red)' : 'var(--amber)', fontWeight: 600 }}>{item.stock}</td>
                        <td className="text-right mono" style={{ color: 'var(--text-muted)' }}>{item.reorderPoint}</td>
                        <td className="text-right mono" style={{ color: 'var(--red)', fontWeight: 600 }}>{item.reorderQty} {item.unit}</td>
                        <td className="text-right mono">{item.unitCost ? fmtCurrency(item.unitCost * item.reorderQty) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ padding: '12px 18px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
                  <span className="mono" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    Est. total: <strong style={{ color: 'var(--text)' }}>${restockItems.reduce((s, i) => s + (i.unitCost ?? 0) * i.reorderQty, 0).toFixed(2)}</strong>
                  </span>
                </div>
              </div>

              {/* Email generator */}
              <div className="glass-card">
                <div className="card-header">
                  <span className="card-title">Restock Email</span>
                  <button className="btn btn-primary btn-sm" onClick={copyEmail} style={{ fontSize: 11 }}>
                    {emailCopied ? '✓ Copied!' : 'Copy to Clipboard'}
                  </button>
                </div>
                <div className="card-body">
                  <pre style={{
                    fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--text)',
                    whiteSpace: 'pre-wrap', lineHeight: 1.7, background: 'var(--input-bg)',
                    border: '1px solid var(--input-border)', borderRadius: 7, padding: 14,
                    maxHeight: 480, overflowY: 'auto', userSelect: 'all',
                  }}>
                    {generateEmail()}
                  </pre>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 10 }}>
                    Click "Copy to Clipboard" then paste into your email to your boss.
                  </p>
                </div>
              </div>
            </div>
          )}
 