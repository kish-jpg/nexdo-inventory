"use client";

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';

// ─── Types ────────────────────────────────────────────────────────────────────

type Category = { id: number; name: string; _count?: { items: number } };

type Item = {
  id: number;
  itemCode: string | null;
  name: string;
  category: Category;
  categoryId: number;
  subCategory: string | null;
  unit: string;
  stock: number;
  targetStock: number;
  reorderPoint: number | null;
  reorderQty: number | null;
  status: string;
  location: string | null;
  supplier: string | null;
  unitCost: number | null;
  lastUpdated: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusBadgeClass(s: string) {
  if (s === 'green') return 'badge badge-green';
  if (s === 'red')   return 'badge badge-red';
  return 'badge badge-amber';
}

function statusLabel(s: string) {
  if (s === 'green') return 'OK';
  if (s === 'red')   return 'Reorder';
  return 'Low';
}

function statusColor(s: string) {
  if (s === 'green') return 'var(--green)';
  if (s === 'red')   return 'var(--red)';
  return 'var(--amber)';
}

// Category badge mapping
const CAT_BADGE_MAP: Record<string, string> = {
  'Linen & Bedding': 'badge cat-badge-linen',
  'Bathroom':        'badge cat-badge-bath',
  'Cleaning':        'badge cat-badge-clean',
  'Guest Supplies':  'badge cat-badge-guest',
  'Equipment':       'badge cat-badge-equip',
};
function catBadgeClass(name: string) {
  return CAT_BADGE_MAP[name] ?? 'badge cat-badge-default';
}

// ─── Item Form Modal ──────────────────────────────────────────────────────────

type ItemFormProps = {
  mode: 'new' | 'edit';
  item?: Item;
  categories: Category[];
  onSave: (data: Partial<Item>) => void;
  onClose: () => void;
  loading: boolean;
  error: string | null;
};

function ItemFormModal({ mode, item, categories, onSave, onClose, loading, error }: ItemFormProps) {
  const [form, setForm] = useState({
    name: item?.name ?? '',
    categoryId: String(item?.categoryId ?? (categories[0]?.id ?? '')),
    subCategory: item?.subCategory ?? '',
    unit: item?.unit ?? 'Each',
    stock: String(item?.stock ?? 0),
    targetStock: String(item?.targetStock ?? ''),
    reorderPoint: String(item?.reorderPoint ?? ''),
    reorderQty: String(item?.reorderQty ?? ''),
    supplier: item?.supplier ?? '',
    unitCost: String(item?.unitCost ?? ''),
    location: item?.location ?? '',
    itemCode: item?.itemCode ?? '',
  });

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      name: form.name,
      categoryId: parseInt(form.categoryId) as any,
      subCategory: form.subCategory || null,
      unit: form.unit,
      stock: parseInt(form.stock) as any,
      targetStock: parseInt(form.targetStock) as any,
      reorderPoint: form.reorderPoint ? parseInt(form.reorderPoint) as any : null,
      reorderQty: form.reorderQty ? parseInt(form.reorderQty) as any : null,
      supplier: form.supplier || null,
      unitCost: form.unitCost ? parseFloat(form.unitCost) as any : null,
      location: form.location || null,
      itemCode: form.itemCode || null,
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" style={{ maxWidth: '540px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="modal-title">{mode === 'new' ? 'Add New Item' : `Edit: ${item?.name}`}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono', marginTop: '4px' }}>
              {mode === 'new' ? 'Fill in item details below' : 'Update item details'}
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        {error && <div className="error-box">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-two-col">
            <div className="form-row">
              <label className="form-label">Item Name *</label>
              <input className="form-input" value={form.name} onChange={e => set('name', e.target.value)} required placeholder="e.g. Bath Towels" />
            </div>
            <div className="form-row">
              <label className="form-label">Item Code</label>
              <input className="form-input" value={form.itemCode} onChange={e => set('itemCode', e.target.value)} placeholder="e.g. L006" />
            </div>
          </div>

          <div className="form-two-col">
            <div className="form-row">
              <label className="form-label">Category *</label>
              <select className="form-input" value={form.categoryId} onChange={e => set('categoryId', e.target.value)} required>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="form-row">
              <label className="form-label">Sub-Category</label>
              <input className="form-input" value={form.subCategory} onChange={e => set('subCategory', e.target.value)} placeholder="e.g. Towels" />
            </div>
          </div>

          <div className="form-two-col">
            <div className="form-row">
              <label className="form-label">Unit</label>
              <select className="form-input" value={form.unit} onChange={e => set('unit', e.target.value)}>
                {['Each', 'Bottle', 'Roll', 'Box', 'Pack', 'Litre', 'Unit', 'Pair', 'Set'].map(u => <option key={u}>{u}</option>)}
              </select>
            </div>
            <div className="form-row">
              <label className="form-label">Current Stock *</label>
              <input className="form-input" type="number" min="0" value={form.stock} onChange={e => set('stock', e.target.value)} required />
            </div>
          </div>

          <div className="form-two-col">
            <div className="form-row">
              <label className="form-label">Par Level (Target) *</label>
              <input className="form-input" type="number" min="0" value={form.targetStock} onChange={e => set('targetStock', e.target.value)} required placeholder="Hotel total par" />
            </div>
            <div className="form-row">
              <label className="form-label">Reorder Point</label>
              <input className="form-input" type="number" min="0" value={form.reorderPoint} onChange={e => set('reorderPoint', e.target.value)} placeholder="Alert threshold" />
            </div>
          </div>

          <div className="form-two-col">
            <div className="form-row">
              <label className="form-label">Reorder Qty</label>
              <input className="form-input" type="number" min="0" value={form.reorderQty} onChange={e => set('reorderQty', e.target.value)} placeholder="Qty to order" />
            </div>
            <div className="form-row">
              <label className="form-label">Unit Cost (NZD)</label>
              <input className="form-input" type="number" min="0" step="0.01" value={form.unitCost} onChange={e => set('unitCost', e.target.value)} placeholder="0.00" />
            </div>
          </div>

          <div className="form-two-col">
            <div className="form-row">
              <label className="form-label">Supplier</label>
              <input className="form-input" value={form.supplier} onChange={e => set('supplier', e.target.value)} placeholder="Supplier name" />
            </div>
            <div className="form-row">
              <label className="form-label">Location</label>
              <input className="form-input" value={form.location} onChange={e => set('location', e.target.value)} placeholder="e.g. Pantry L5" />
            </div>
          </div>

          <div className="form-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Saving…' : mode === 'new' ? 'Add Item' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Adjust Stock Modal ───────────────────────────────────────────────────────

type AdjustModalProps = {
  item: Item;
  onSave: (type: string, qty: number, reason: string) => void;
  onClose: () => void;
  loading: boolean;
  error: string | null;
};

function AdjustModal({ item, onSave, onClose, loading, error }: AdjustModalProps) {
  const [adjustType, setAdjustType] = useState<'add' | 'remove' | 'stocktake'>('add');
  const [qty, setQty] = useState('');
  const [reason, setReason] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = parseInt(qty);
    if (isNaN(q) || q < 0) return;
    onSave(adjustType, q, reason);
  };

  const newStock =
    adjustType === 'add'      ? item.stock + (parseInt(qty) || 0) :
    adjustType === 'remove'   ? Math.max(0, item.stock - (parseInt(qty) || 0)) :
    parseInt(qty) || item.stock;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" style={{ maxWidth: '420px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="modal-title">Adjust Stock</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono', marginTop: '4px' }}>
              {item.name}
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        {/* Type selector */}
        <div className="adjust-type-row">
          {(['add', 'remove', 'stocktake'] as const).map(t => (
            <button
              key={t}
              type="button"
              onClick={() => setAdjustType(t)}
              className={`adjust-type-btn${adjustType === t ? ` at-${t === 'stocktake' ? 'stock' : t}` : ''}`}
            >
              {t === 'add' ? '+ Add' : t === 'remove' ? '− Remove' : '⟳ Stocktake'}
            </button>
          ))}
        </div>

        {/* Stock preview */}
        <div className="stock-preview">
          <div>
            <div className="stock-preview-label">Current Stock</div>
            <div className="stock-preview-num">{item.stock}</div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono', marginTop: '4px' }}>
              {item.unit} · Par {item.targetStock}
            </div>
          </div>
          {qty && (
            <div style={{ textAlign: 'right' }}>
              <div className="stock-preview-label">New Stock</div>
              <div className="stock-preview-num" style={{
                color: newStock < item.stock ? 'var(--red)' : newStock > item.stock ? 'var(--green)' : 'var(--text)'
              }}>
                {newStock}
              </div>
              <div style={{ fontSize: '10px', fontFamily: 'JetBrains Mono', marginTop: '4px',
                color: newStock < item.stock ? 'var(--red)' : 'var(--green)' }}>
                {newStock > item.stock ? `+${newStock - item.stock}` : newStock < item.stock ? `-${item.stock - newStock}` : '±0'}
              </div>
            </div>
          )}
        </div>

        {error && <div className="error-box">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <label className="form-label">{adjustType === 'stocktake' ? 'Actual Count' : 'Quantity'} *</label>
            <input
              className="form-input"
              type="number" min="0" value={qty}
              onChange={e => setQty(e.target.value)} required autoFocus
              placeholder={adjustType === 'stocktake' ? 'Enter actual count' : 'Enter quantity'}
            />
          </div>
          <div className="form-row">
            <label className="form-label">Reason / Note</label>
            <input
              className="form-input" value={reason} onChange={e => setReason(e.target.value)}
              placeholder={
                adjustType === 'add' ? 'e.g. Delivery received' :
                adjustType === 'remove' ? 'e.g. Floor distribution' :
                'e.g. Morning stocktake'
              }
            />
          </div>
          <div className="form-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading || !qty}>
              {loading ? 'Saving…' : 'Confirm'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── History Modal ────────────────────────────────────────────────────────────

type Tx = { id: number; quantity: number; type: string; reason: string | null; doneBy: string | null; timestamp: string };

function HistoryModal({ item, onClose }: { item: Item; onClose: () => void }) {
  const [txs, setTxs] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/items/${item.id}`)
      .then(r => r.json())
      .then(d => { setTxs(d.transactions ?? []); setLoading(false); });
  }, [item.id]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" style={{ maxWidth: '560px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="modal-title">{item.name}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono', marginTop: '4px' }}>
              Stock History · Last 20 transactions
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        {loading ? (
          <div className="empty-state"><div className="empty-state-sub mono">Loading…</div></div>
        ) : txs.length === 0 ? (
          <div className="empty-state"><div className="empty-state-sub mono">No transactions yet</div></div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th className="text-right">Qty</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {txs.map(tx => (
                <tr key={tx.id}>
                  <td className="mono" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    {new Date(tx.timestamp).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' })}{' '}
                    {new Date(tx.timestamp).toLocaleTimeString('en-NZ', { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td>
                    <span className={`badge ${tx.type === 'add' ? 'tx-add' : tx.type === 'remove' ? 'tx-remove' : 'tx-stock'}`}>
                      {tx.type === 'add' ? 'Received' : tx.type === 'remove' ? 'Used' : 'Initial Count'}
                    </span>
                  </td>
                  <td className="text-right mono" style={{
                    fontWeight: 700,
                    color: tx.quantity >= 0 ? 'var(--green)' : 'var(--red)'
                  }}>
                    {tx.quantity >= 0 ? '+' : ''}{tx.quantity}
                  </td>
                  <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{tx.reason ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ─── Delete Confirm ───────────────────────────────────────────────────────────

function DeleteConfirm({ item, onConfirm, onClose, loading }: { item: Item; onConfirm: () => void; onClose: () => void; loading: boolean }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" style={{ maxWidth: '360px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: '32px', marginBottom: '14px', opacity: 0.6 }}>🗑</div>
        <div className="modal-title" style={{ marginBottom: '8px' }}>Delete "{item.name}"?</div>
        <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '28px', lineHeight: 1.6 }}>
          This will permanently delete the item and all its stock history. This cannot be undone.
        </div>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? 'Deleting…' : 'Yes, Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function InventoryPage() {
  const [items, setItems]         = useState<Item[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCat, setActiveCat] = useState<number | null>(null);
  const [search, setSearch]       = useState('');
  const [loading, setLoading]     = useState(true);
  const [modal, setModal]         = useState<'new' | 'edit' | 'adjust' | 'history' | 'delete' | null>(null);
  const [selected, setSelected]   = useState<Item | null>(null);
  const [saving, setSaving]       = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [iRes, cRes] = await Promise.all([
      fetch('/api/items').then(r => r.json()),
      fetch('/api/categories').then(r => r.json()),
    ]);
    setItems(Array.isArray(iRes) ? iRes : []);
    setCategories(Array.isArray(cRes) ? cRes : []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const filtered = items.filter(i =>
    (activeCat == null || i.categoryId === activeCat) &&
    (search === '' || i.name.toLowerCase().includes(search.toLowerCase()) || (i.itemCode ?? '').toLowerCase().includes(search.toLowerCase()))
  );

  const openModal = (type: typeof modal, item?: Item) => {
    setSelected(item ?? null); setSaveError(null); setModal(type);
  };
  const closeModal = () => { setModal(null); setSelected(null); setSaveError(null); };

  const handleSaveItem = async (data: Partial<Item>) => {
    setSaving(true); setSaveError(null);
    try {
      const res = await fetch(
        modal === 'new' ? '/api/items' : `/api/items/${selected!.id}`,
        { method: modal === 'new' ? 'POST' : 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to save');
      await fetchAll(); closeModal();
    } catch (e: any) { setSaveError(e.message); }
    finally { setSaving(false); }
  };

  const handleAdjust = async (type: string, qty: number, reason: string) => {
    setSaving(true); setSaveError(null);
    try {
      const res = await fetch(`/api/items/${selected!.id}/adjust`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, quantity: qty, reason }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to adjust');
      await fetchAll(); closeModal();
    } catch (e: any) { setSaveError(e.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/items/${selected!.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      await fetchAll(); closeModal();
    } catch (e: any) { setSaveError(e.message); }
    finally { setSaving(false); }
  };

  // KPI counts
  const green = items.filter(i => i.status === 'green').length;
  const amber = items.filter(i => i.status === 'amber').length;
  const red   = items.filter(i => i.status === 'red').length;

  return (
    <>
      {/* Modals */}
      {(modal === 'new' || modal === 'edit') && (
        <ItemFormModal
          mode={modal} item={selected ?? undefined}
          categories={categories} onSave={handleSaveItem}
          onClose={closeModal} loading={saving} error={saveError}
        />
      )}
      {modal === 'adjust' && selected && (
        <AdjustModal item={selected} onSave={handleAdjust} onClose={closeModal} loading={saving} error={saveError} />
      )}
      {modal === 'history' && selected && (
        <HistoryModal item={selected} onClose={closeModal} />
      )}
      {modal === 'delete' && selected && (
        <DeleteConfirm item={selected} onConfirm={handleDelete} onClose={closeModal} loading={saving} />
      )}

      <div className="page-wrap">

        {/* Page Header */}
        <div className="page-header">
          <div>
            <div className="page-title">INVENTORY</div>
            <div className="page-sub">
              <Link href="/" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>Dashboard</Link>
              {' / '}Manage housekeeping supplies
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <span style={{ fontFamily: 'JetBrains Mono', fontSize: '11px', color: 'var(--text-muted)' }}>
              {items.length} items
            </span>
            <button
              className="btn btn-primary"
              onClick={() => openModal('new')}
            >
              + New Item
            </button>
          </div>
        </div>

        {/* KPI Strip */}
        <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          {[
            { label: 'Total Items',  value: items.length, color: 'kpi-blue' },
            { label: 'Stock OK',     value: green,         color: 'kpi-green' },
            { label: 'Low Stock',    value: amber,         color: 'kpi-amber' },
            { label: 'Reorder Now',  value: red,           color: 'kpi-red' },
          ].map(k => (
            <div key={k.label} className={`kpi-card ${k.color}`}>
              <div className="kpi-label">{k.label}</div>
              <div className="kpi-value">{k.value}</div>
            </div>
          ))}
        </div>

        {/* Search + Filter row */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Search */}
          <div className="search-wrap" style={{ flex: '1', minWidth: '200px', maxWidth: '300px' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              placeholder="Search items or codes…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '14px', padding: '0 2px' }}
              >
                ×
              </button>
            )}
          </div>

          <div className="search-divider" />

          {/* Category filters */}
          <div className="cat-filters">
            <button
              className={`cat-btn${activeCat == null ? ' active' : ''}`}
              onClick={() => setActiveCat(null)}
            >
              All ({items.length})
            </button>
            {categories.map(c => {
              const count = items.filter(i => i.categoryId === c.id).length;
              return (
                <button
                  key={c.id}
                  className={`cat-btn${activeCat === c.id ? ' active' : ''}`}
                  onClick={() => setActiveCat(c.id === activeCat ? null : c.id)}
                >
                  {c.name} ({count})
                </button>
              );
            })}
          </div>
        </div>

        {/* Table */}
        <div className="table-wrap">
          {loading ? (
            <div className="empty-state">
              <div className="empty-state-sub mono" style={{ letterSpacing: '0.1em' }}>LOADING INVENTORY…</div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📦</div>
              {items.length === 0 ? (
                <>
                  <div className="empty-state-title">No data yet</div>
                  <div className="empty-state-sub">
                    <a href="/api/seed" style={{ color: 'var(--blue)', fontWeight: 600 }}>Seed initial data</a> to get started.
                  </div>
                </>
              ) : (
                <>
                  <div className="empty-state-title">No items match</div>
                  <div className="empty-state-sub">Try adjusting your search or filter</div>
                </>
              )}
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '90px', paddingLeft: '20px' }}>Status</th>
                  <th style={{ width: '80px' }}>Code</th>
                  <th style={{ width: '26%' }}>Item</th>
                  <th style={{ width: '14%' }}>Category</th>
                  <th className="text-right" style={{ width: '9%' }}>Stock</th>
                  <th className="text-right" style={{ width: '9%' }}>Par</th>
                  <th className="text-right" style={{ width: '9%' }}>Reorder</th>
                  <th style={{ width: '7%' }}>Unit</th>
                  <th className="text-right" style={{ width: '15%', paddingRight: '20px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(item => (
                  <tr key={item.id} className={item.status === 'red' ? 'row-critical' : ''}>
                    {/* Status */}
                    <td style={{ paddingLeft: '20px' }}>
                      <span className={statusBadgeClass(item.status)}>
                        <span className="status-dot" style={{ background: statusColor(item.status) }} />
                        {statusLabel(item.status)}
                      </span>
                    </td>

                    {/* Code */}
                    <td className="mono" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {item.itemCode ?? '—'}
                    </td>

                    {/* Item name */}
                    <td>
                      <div style={{ fontWeight: 600, fontSize: '13px' }}>{item.name}</div>
                      {item.subCategory && (
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                          {item.subCategory}
                        </div>
                      )}
                    </td>

                    {/* Category */}
                    <td>
                      <span className={catBadgeClass(item.category.name)}>{item.category.name}</span>
                    </td>

                    {/* Stock */}
                    <td className="text-right mono" style={{
                      fontWeight: 700,
                      fontSize: '14px',
                      color: statusColor(item.status),
                    }}>
                      {item.stock}
                    </td>

                    {/* Par */}
                    <td className="text-right mono" style={{ color: 'var(--text-muted)' }}>
                      {item.targetStock}
                    </td>

                    {/* Reorder */}
                    <td className="text-right mono" style={{ color: 'var(--text-subtle)', fontSize: '12px' }}>
                      {item.reorderPoint ?? '—'}
                    </td>

                    {/* Unit */}
                    <td style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono' }}>
                      {item.unit}
                    </td>

                    {/* Actions */}
                    <td className="text-right" style={{ paddingRight: '20px' }}>
                      <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                        <button
                          className="btn btn-sm btn-action-blue"
                          onClick={() => openModal('adjust', item)}
                          title="Adjust stock"
                        >
                          ± Stock
                        </button>
                        <button
                          className="btn btn-sm btn-action-grey"
                          onClick={() => openModal('history', item)}
                          title="View history"
                        >
                          History
                        </button>
                        <button
                          className="btn btn-sm btn-action-grey"
                          onClick={() => openModal('edit', item)}
                          title="Edit item"
                        >
                          Edit
                        </button>
                        <button
                          className="btn btn-sm btn-action-red"
                          onClick={() => openModal('delete', item)}
                          title="Delete"
                        >
                          ×
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Table footer */}
        {!loading && filtered.length > 0 && (
          <div style={{
            marginTop: '10px',
            fontFamily: 'JetBrains Mono',
            fontSize: '10px',
            color: 'var(--text-subtle)',
            letterSpacing: '0.06em',
            display: 'flex',
            justifyContent: 'space-between',
          }}>
            <span>SHOWING {filtered.length} OF {items.length} ITEMS{search ? ` — "${search}"` : ''}</span>
            <span>{red > 0 ? `${red} ITEM${red > 1 ? 'S' : ''} NEED REORDER` : 'ALL ABOVE THRESHOLD'}</span>
          </div>
        )}

      </div>
    </>
  );
}
