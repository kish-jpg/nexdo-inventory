'use client';

import { useState, useEffect, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

type LaundryLog = {
  id: number; date: string;
  kingDep: number; kingRegular: number; kingDay3: number;
  twinDep: number; twinRegular: number; twinDay3: number;
  notes: string; timestamp: string;
};

type SincerityDelivery = {
  id: number; date: string;
  kingSheets: number; singleSheets: number;
  pillowSlipsMed: number; pillowSlipsLarge: number;
  bathTowels: number; handTowels: number; faceTowels: number;
  bathMats: number; duvets: number; notes: string; timestamp: string;
};

type ReconRow = {
  name: string; sent: number; received: number; atLaundry: number;
  inHotel: number; total: number; par: number; status: string;
};

// ─── Recipe ───────────────────────────────────────────────────────────────────

function calcSent(
  kingDep: number, kingReg: number, kingD3: number,
  twinDep: number, twinReg: number, twinD3: number,
): Record<string, number> {
  const fk = kingDep + kingD3;
  const ft = twinDep + twinD3;
  const all = fk + kingReg + ft + twinReg;
  return {
    'King Sheets':           fk * 3,
    'Single Sheets':         ft * 6,
    'Pillow Slips (Medium)': (fk + ft) * 2,
    'Pillow Slips (Large)':  (fk + ft) * 2,
    'Bath Towels':           all * 2,
    'Hand Towels':           all * 2,
    'Face Towels':           all * 2,
    'Bath Mats':             all,
  };
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function fmtDate(d: string) {
  if (!d) return '—';
  const dt = new Date(d + 'T12:00:00');
  return dt.toLocaleDateString('en-NZ', { weekday: 'short', day: 'numeric', month: 'short' });
}

// ─── Spinner ─────────────────────────────────────────────────────────────────

const Spinner = () => (
  <svg
    width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
    className="is-spinning-icon"
    aria-hidden
  >
    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
  </svg>
);

// ─── Number Input ─────────────────────────────────────────────────────────────

function NumInput({ label, value, onChange, sub }: {
  label: string; value: number; onChange: (v: number) => void; sub?: string;
}) {
  return (
    <div>
      <label className="form-label">
        {label}
        {sub && <span style={{ color: 'var(--text-subtle)', marginLeft: 4, textTransform: 'none', letterSpacing: 0 }}>{sub}</span>}
      </label>
      <div className="num-input">
        <button
          type="button"
          onClick={() => onChange(Math.max(0, value - 1))}
          aria-label={`Decrement ${label}`}
          className="num-input__btn num-input__btn--left"
        >−</button>
        <input
          type="number" min={0} value={value}
          onChange={e => onChange(Math.max(0, parseInt(e.target.value) || 0))}
          aria-label={label}
          className="form-input num-input__field"
        />
        <button
          type="button"
          onClick={() => onChange(value + 1)}
          aria-label={`Increment ${label}`}
          className="num-input__btn num-input__btn--right"
        >+</button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function LaundryPage() {
  const [tab, setTab] = useState<'log' | 'delivery' | 'recon'>('log');

  // ── Log Cleans state
  const [logDate, setLogDate]           = useState(today());
  const [kingDep, setKingDep]           = useState(0);
  const [kingReg, setKingReg]           = useState(0);
  const [kingD3, setKingD3]             = useState(0);
  const [twinDep, setTwinDep]           = useState(0);
  const [twinReg, setTwinReg]           = useState(0);
  const [twinD3, setTwinD3]             = useState(0);
  const [logNotes, setLogNotes]         = useState('');
  const [logSaving, setLogSaving]       = useState(false);
  const [logSuccess, setLogSuccess]     = useState(false);
  const [logError, setLogError]         = useState('');
  const [logs, setLogs]                 = useState<LaundryLog[]>([]);
  const [logsLoading, setLogsLoading]   = useState(true);

  // ── Delivery state
  const [delDate, setDelDate]         = useState(today());
  const [delItems, setDelItems]       = useState({
    kingSheets: 0, singleSheets: 0, pillowSlipsMed: 0, pillowSlipsLarge: 0,
    bathTowels: 0, handTowels: 0, faceTowels: 0, bathMats: 0, duvets: 0,
  });
  const [delNotes, setDelNotes]       = useState('');
  const [delSaving, setDelSaving]     = useState(false);
  const [delSuccess, setDelSuccess]   = useState(false);
  const [delError, setDelError]       = useState('');
  const [deliveries, setDeliveries]   = useState<SincerityDelivery[]>([]);
  const [delLoading, setDelLoading]   = useState(true);

  // ── Reconciliation state
  const [recon, setRecon]             = useState<{ rows: ReconRow[]; recentLogs: LaundryLog[]; recentDeliveries: SincerityDelivery[] } | null>(null);
  const [reconLoading, setReconLoading] = useState(false);

  // ── Load data
  const loadLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const res = await fetch('/api/laundry');
      const data = await res.json();
      setLogs(data.logs ?? []);
    } catch {/* ignore */} finally { setLogsLoading(false); }
  }, []);

  const loadDeliveries = useCallback(async () => {
    setDelLoading(true);
    try {
      const res = await fetch('/api/laundry/delivery');
      const data = await res.json();
      setDeliveries(data.deliveries ?? []);
    } catch {/* ignore */} finally { setDelLoading(false); }
  }, []);

  const loadRecon = useCallback(async () => {
    setReconLoading(true);
    try {
      const res = await fetch('/api/laundry/reconciliation');
      const data = await res.json();
      setRecon(data);
    } catch {/* ignore */} finally { setReconLoading(false); }
  }, []);

  useEffect(() => { loadLogs(); }, [loadLogs]);
  useEffect(() => { if (tab === 'delivery') loadDeliveries(); }, [tab, loadDeliveries]);
  useEffect(() => { if (tab === 'recon') loadRecon(); }, [tab, loadRecon]);

  // ── Derived: calculated items to send today
  const sent = calcSent(kingDep, kingReg, kingD3, twinDep, twinReg, twinD3);
  const totalRooms = kingDep + kingReg + kingD3 + twinDep + twinReg + twinD3;

  // ── Derived: find today's logged items (if any)
  const todayLog = logs.find(log => log.date === today());
  const todayItems = todayLog
    ? calcSent(todayLog.kingDep, todayLog.kingRegular, todayLog.kingDay3, todayLog.twinDep, todayLog.twinRegular, todayLog.twinDay3)
    : null;
  const todayTotalRooms = todayLog
    ? todayLog.kingDep + todayLog.kingRegular + todayLog.kingDay3 + todayLog.twinDep + todayLog.twinRegular + todayLog.twinDay3
    : 0;

  // ── Submit log
  async function submitLog(e: React.FormEvent) {
    e.preventDefault();
    if (totalRooms === 0) { setLogError('Enter at least one room count.'); return; }
    setLogSaving(true); setLogError('');
    try {
      const res = await fetch('/api/laundry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: logDate, kingDep, kingRegular: kingReg, kingDay3: kingD3, twinDep, twinRegular: twinReg, twinDay3: twinD3, notes: logNotes }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setLogSuccess(true);
      setTimeout(() => setLogSuccess(false), 3000);
      setKingDep(0); setKingReg(0); setKingD3(0);
      setTwinDep(0); setTwinReg(0); setTwinD3(0); setLogNotes('');
      await loadLogs();
    } catch (e: any) { setLogError(e.message); }
    finally { setLogSaving(false); }
  }

  // ── Submit delivery
  async function submitDelivery(e: React.FormEvent) {
    e.preventDefault();
    const total = Object.values(delItems).reduce((a, b) => a + b, 0);
    if (total === 0) { setDelError('Enter at least one item count.'); return; }
    setDelSaving(true); setDelError('');
    try {
      const res = await fetch('/api/laundry/delivery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: delDate, ...delItems, notes: delNotes }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setDelSuccess(true);
      setTimeout(() => setDelSuccess(false), 3000);
      setDelItems({ kingSheets: 0, singleSheets: 0, pillowSlipsMed: 0, pillowSlipsLarge: 0, bathTowels: 0, handTowels: 0, faceTowels: 0, bathMats: 0, duvets: 0 });
      setDelNotes('');
      await loadDeliveries();
    } catch (e: any) { setDelError(e.message); }
    finally { setDelSaving(false); }
  }

  const setDel = (key: keyof typeof delItems) => (v: number) => setDelItems(prev => ({ ...prev, [key]: v }));

  // ── Recon KPIs
  const reconKpis = recon ? {
    totalSent:     recon.rows.reduce((a, r) => a + r.sent, 0),
    totalReceived: recon.rows.reduce((a, r) => a + r.received, 0),
    atLaundry:     recon.rows.reduce((a, r) => a + r.atLaundry, 0),
    alerts:        recon.rows.filter(r => r.status === 'red').length,
  } : null;

  return (
    <div className="page-wrap">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Laundry</h1>
          <p className="page-sub">Sincerity Laundry — daily log & reconciliation</p>
        </div>
        <div className="status-indicator" style={{ color: 'var(--text-muted)' }}>
          <div className="pulse-dot" />
          Active
        </div>
      </div>

      {/* Tabs */}
      <div className="tab-bar" role="tablist" aria-label="Laundry sections">
        {([
          { id: 'log',      label: 'Log Cleans' },
          { id: 'delivery', label: 'Log Delivery' },
          { id: 'recon',    label: 'Reconciliation' },
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

      {/* ── TAB: LOG CLEANS ───────────────────────────────────────────────────── */}
      {tab === 'log' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>

          {/* Form */}
          <form onSubmit={submitLog}>
            <div className="glass-card" style={{ marginBottom: 16 }}>
              <div className="card-header">
                <span className="card-title">Daily Clean Count</span>
                <input
                  type="date" value={logDate} onChange={e => setLogDate(e.target.value)}
                  className="form-input" style={{ width: 'auto', padding: '4px 10px', fontSize: 12 }}
                />
              </div>
              <div className="card-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                {/* King */}
                <div>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'var(--blue)', marginBottom: 14 }}>King Rooms</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <NumInput label="Departures" value={kingDep} onChange={setKingDep} />
                    <NumInput label="In-House Regular" value={kingReg} onChange={setKingReg} sub="(terry only)" />
                    <NumInput label="In-House Day 3" value={kingD3} onChange={setKingD3} sub="(full change)" />
                  </div>
                </div>
                {/* Twin */}
                <div>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'var(--amber)', marginBottom: 14 }}>Twin Rooms</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <NumInput label="Departures" value={twinDep} onChange={setTwinDep} />
                    <NumInput label="In-House Regular" value={twinReg} onChange={setTwinReg} sub="(terry only)" />
                    <NumInput label="In-House Day 3" value={twinD3} onChange={setTwinD3} sub="(full change)" />
                  </div>
                </div>
              </div>
              <div style={{ padding: '0 20px 20px' }}>
                <div className="form-row">
                  <label className="form-label">Notes (optional)</label>
                  <input className="form-input" placeholder="Any notes..." value={logNotes} onChange={e => setLogNotes(e.target.value)} />
                </div>
                {logError && <div className="error-box">{logError}</div>}
                {logSuccess && <div style={{ background: 'var(--green-soft)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 7, padding: '10px 14px', fontSize: 12, color: 'var(--green)', marginBottom: 12 }}>✓ Log saved successfully</div>}
                <div className="form-actions" style={{ paddingTop: 0, borderTop: 'none', margin: 0 }}>
                  <button type="submit" className="btn btn-primary" disabled={logSaving || totalRooms === 0} style={{ width: '100%', justifyContent: 'center' }}>
                    {logSaving ? <Spinner /> : null}
                    {logSaving ? 'Saving…' : `Save Log — ${totalRooms} rooms`}
                  </button>
                </div>
              </div>
            </div>
          </form>

          {/* Calculated items preview */}
          <div>
            <div className="glass-card" style={{ marginBottom: 16 }}>
              <div className="card-header">
                <span className="card-title">Items Going to Sincerity</span>
                {todayTotalRooms > 0 && <span className="badge badge-blue">{todayTotalRooms} rooms (today)</span>}
              </div>
              <div className="card-body" style={{ padding: 0 }}>
                {!todayItems ? (
                  <div className="empty-state" style={{ padding: '32px 24px' }}>
                    <div className="empty-state-title">Enter room counts</div>
                    <div className="empty-state-sub">Calculated quantities will appear here</div>
                  </div>
                ) : (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th className="text-right mono">Qty</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(todayItems).filter(([, qty]) => qty > 0).map(([name, qty]) => (
                        <tr key={name}>
                          <td style={{ fontSize: 13 }}>{name}</td>
                          <td className="text-right mono" style={{ color: 'var(--blue)', fontWeight: 600 }}>{qty}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Recipe reference */}
            <div className="glass-card">
              <div className="card-header"><span className="card-title">Linen Recipe</span></div>
              <div className="card-body" style={{ padding: 0 }}>
                <table className="data-table" style={{ fontSize: 12 }}>
                  <thead><tr><th>Item</th><th className="text-right">King Dep/D3</th><th className="text-right">Twin Dep/D3</th><th className="text-right">Regular</th></tr></thead>
                  <tbody>
                    {[
                      { name: 'King Sheets',           k: 3, t: 0, r: 0 },
                      { name: 'Single Sheets',         k: 0, t: 6, r: 0 },
                      { name: 'Pillow Slips (Med)',     k: 2, t: 2, r: 0 },
                      { name: 'Pillow Slips (Large)',   k: 2, t: 2, r: 0 },
                      { name: 'Bath Towels',            k: 2, t: 2, r: 2 },
                      { name: 'Hand Towels',            k: 2, t: 2, r: 2 },
                      { name: 'Face Towels',            k: 2, t: 2, r: 2 },
                      { name: 'Bath Mats',              k: 1, t: 1, r: 1 },
                    ].map(row => (
                      <tr key={row.name}>
                        <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{row.name}</td>
                        <td className="text-right mono" style={{ color: row.k ? 'var(--text)' : 'var(--text-subtle)', fontSize: 12 }}>{row.k || '—'}</td>
                        <td className="text-right mono" style={{ color: row.t ? 'var(--text)' : 'var(--text-subtle)', fontSize: 12 }}>{row.t || '—'}</td>
                        <td className="text-right mono" style={{ color: row.r ? 'var(--text)' : 'var(--text-subtle)', fontSize: 12 }}>{row.r || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Log history — full width */}
          <div style={{ gridColumn: '1 / -1' }}>
            <div className="table-wrap">
              <div className="card-header" style={{ background: 'var(--card-bg)', borderBottom: '1px solid var(--border)', padding: '14px 18px' }}>
                <span className="card-title">Recent Logs</span>
                <button className="btn btn-ghost btn-sm" onClick={loadLogs} style={{ padding: '4px 10px' }}>Refresh</button>
              </div>
              {logsLoading ? (
                <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}><Spinner /></div>
              ) : logs.length === 0 ? (
                <div className="empty-state"><div className="empty-state-title">No logs yet</div><div className="empty-state-sub">Submit your first clean count above</div></div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th className="text-right">King Dep</th>
                      <th className="text-right">King Reg</th>
                      <th className="text-right">King D3</th>
                      <th className="text-right">Twin Dep</th>
                      <th className="text-right">Twin Reg</th>
                      <th className="text-right">Twin D3</th>
                      <th className="text-right">Total Rooms</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map(log => {
                      const total = log.kingDep + log.kingRegular + log.kingDay3 + log.twinDep + log.twinRegular + log.twinDay3;
                      return (
                        <tr key={log.id}>
                          <td style={{ fontWeight: 500 }}>{fmtDate(log.date)}</td>
                          <td className="text-right mono">{log.kingDep || '—'}</td>
                          <td className="text-right mono">{log.kingRegular || '—'}</td>
                          <td className="text-right mono">{log.kingDay3 || '—'}</td>
                          <td className="text-right mono">{log.twinDep || '—'}</td>
                          <td className="text-right mono">{log.twinRegular || '—'}</td>
                          <td className="text-right mono">{log.twinDay3 || '—'}</td>
                          <td className="text-right mono" style={{ color: 'var(--blue)', fontWeight: 600 }}>{total}</td>
                          <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{log.notes || '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: LOG DELIVERY ─────────────────────────────────────────────────── */}
      {tab === 'delivery' && (
        <div style={{ display: 'grid', gridTemplateColumns: '420px 1fr', gap: 20, alignItems: 'start' }}>

          <form onSubmit={submitDelivery}>
            <div className="glass-card">
              <div className="card-header">
                <span className="card-title">Sincerity Return</span>
                <input
                  type="date" value={delDate} onChange={e => setDelDate(e.target.value)}
                  className="form-input" style={{ width: 'auto', padding: '4px 10px', fontSize: 12 }}
                />
              </div>
              <div className="card-body">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                  <NumInput label="King Sheets"         value={delItems.kingSheets}      onChange={setDel('kingSheets')} />
                  <NumInput label="Single Sheets"       value={delItems.singleSheets}    onChange={setDel('singleSheets')} />
                  <NumInput label="Pillow Slips (Med)"  value={delItems.pillowSlipsMed}  onChange={setDel('pillowSlipsMed')} />
                  <NumInput label="Pillow Slips (Lge)"  value={delItems.pillowSlipsLarge} onChange={setDel('pillowSlipsLarge')} />
                  <NumInput label="Bath Towels"         value={delItems.bathTowels}      onChange={setDel('bathTowels')} />
                  <NumInput label="Hand Towels"         value={delItems.handTowels}      onChange={setDel('handTowels')} />
                  <NumInput label="Face Towels"         value={delItems.faceTowels}      onChange={setDel('faceTowels')} />
                  <NumInput label="Bath Mats"           value={delItems.bathMats}        onChange={setDel('bathMats')} />
                  <NumInput label="Duvet Covers"        value={delItems.duvets}          onChange={setDel('duvets')} />
                </div>
                <div className="form-row">
                  <label className="form-label">Notes</label>
                  <input className="form-input" placeholder="Delivery notes, issues..." value={delNotes} onChange={e => setDelNotes(e.target.value)} />
                </div>
                {delError && <div className="error-box">{delError}</div>}
                {delSuccess && <div style={{ background: 'var(--green-soft)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 7, padding: '10px 14px', fontSize: 12, color: 'var(--green)', marginBottom: 12 }}>✓ Delivery logged</div>}
                <button type="submit" className="btn btn-primary" disabled={delSaving} style={{ width: '100%', justifyContent: 'center' }}>
                  {delSaving ? <Spinner /> : null}{delSaving ? 'Saving…' : 'Log Delivery'}
                </button>
              </div>
            </div>
          </form>

          {/* Delivery history */}
          <div className="table-wrap">
            <div className="card-header" style={{ background: 'var(--card-bg)', borderBottom: '1px solid var(--border)', padding: '14px 18px' }}>
              <span className="card-title">Delivery History</span>
              <button className="btn btn-ghost btn-sm" onClick={loadDeliveries} style={{ padding: '4px 10px' }}>Refresh</button>
            </div>
            {delLoading ? (
              <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}><Spinner /></div>
            ) : deliveries.length === 0 ? (
              <div className="empty-state"><div className="empty-state-title">No deliveries yet</div><div className="empty-state-sub">Log your first Sincerity return above</div></div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th className="text-right">K.Sheets</th>
                      <th className="text-right">S.Sheets</th>
                      <th className="text-right">P.Slips M</th>
                      <th className="text-right">P.Slips L</th>
                      <th className="text-right">Bath</th>
                      <th className="text-right">Hand</th>
                      <th className="text-right">Face</th>
                      <th className="text-right">Mats</th>
                      <th className="text-right">Duvets</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deliveries.map(d => (
                      <tr key={d.id}>
                        <td style={{ fontWeight: 500, whiteSpace: 'nowrap' }}>{fmtDate(d.date)}</td>
                        <td className="text-right mono">{d.kingSheets || '—'}</td>
                        <td className="text-right mono">{d.singleSheets || '—'}</td>
                        <td className="text-right mono">{d.pillowSlipsMed || '—'}</td>
                        <td className="text-right mono">{d.pillowSlipsLarge || '—'}</td>
                        <td className="text-right mono">{d.bathTowels || '—'}</td>
                        <td className="text-right mono">{d.handTowels || '—'}</td>
                        <td className="text-right mono">{d.faceTowels || '—'}</td>
                        <td className="text-right mono">{d.bathMats || '—'}</td>
                        <td className="text-right mono">{d.duvets || '—'}</td>
                        <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{d.notes || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB: RECONCILIATION ───────────────────────────────────────────────── */}
      {tab === 'recon' && (
        <div>
          {reconLoading && (
            <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}><Spinner /></div>
          )}
          {!reconLoading && !recon && (
            <div className="empty-state"><div className="empty-state-title">No data yet</div><div className="empty-state-sub">Start logging cleans and deliveries</div></div>
          )}
          {!reconLoading && recon && (
            <>
              {/* KPIs */}
              <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: 24 }}>
                <div className="kpi-card kpi-blue">
                  <div className="kpi-label">Total Sent</div>
                  <div className="kpi-value">{reconKpis!.totalSent.toLocaleString()}</div>
                  <div className="kpi-trend">items to Sincerity (all time)</div>
                </div>
                <div className="kpi-card kpi-green">
                  <div className="kpi-label">Total Received</div>
                  <div className="kpi-value">{reconKpis!.totalReceived.toLocaleString()}</div>
                  <div className="kpi-trend">items returned (all time)</div>
                </div>
                <div className="kpi-card kpi-amber">
                  <div className="kpi-label">At Laundry</div>
                  <div className="kpi-value">{reconKpis!.atLaundry.toLocaleString()}</div>
                  <div className="kpi-trend">items not yet returned</div>
                </div>
                <div className="kpi-card kpi-red">
                  <div className="kpi-label">Alerts</div>
                  <div className="kpi-value">{reconKpis!.alerts}</div>
                  <div className="kpi-trend">items below par level</div>
                </div>
              </div>

              {/* Reconciliation table */}
              <div className="table-wrap" style={{ marginBottom: 24 }}>
                <div className="card-header" style={{ background: 'var(--card-bg)', borderBottom: '1px solid var(--border)', padding: '14px 18px' }}>
                  <span className="card-title">Linen Position — All Time</span>
                  <button className="btn btn-ghost btn-sm" onClick={loadRecon} style={{ padding: '4px 10px' }}>Refresh</button>
                </div>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th className="text-right">Sent</th>
                      <th className="text-right">Received</th>
                      <th className="text-right">At Laundry</th>
                      <th className="text-right">In Hotel</th>
                      <th className="text-right">Total</th>
                      <th className="text-right">Par</th>
                      <th className="text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recon.rows.map(row => (
                      <tr key={row.name} className={row.status === 'red' ? 'row-critical' : ''}>
                        <td style={{ fontWeight: 500 }}>{row.name}</td>
                        <td className="text-right mono" style={{ color: 'var(--text-muted)' }}>{row.sent}</td>
                        <td className="text-right mono" style={{ color: 'var(--green)' }}>{row.received}</td>
                        <td className="text-right mono" style={{ color: 'var(--amber)' }}>{row.atLaundry}</td>
                        <td className="text-right mono">{row.inHotel}</td>
                        <td className="text-right mono" style={{ fontWeight: 600 }}>{row.total}</td>
                        <td className="text-right mono" style={{ color: 'var(--text-muted)' }}>{row.par}</td>
                        <td className="text-right">
                          <span className={`badge badge-${row.status === 'green' ? 'green' : row.status === 'amber' ? 'amber' : 'red'}`}>
                            <span className="status-dot" style={{ background: row.status === 'green' ? 'var(--green)' : row.status === 'amber' ? 'var(--amber)' : 'var(--red)' }} />
                            {row.status === 'green' ? 'OK' : row.status === 'amber' ? 'Low' : 'Critical'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Recent activity side by side */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="table-wrap">
                  <div className="card-header" style={{ background: 'var(--card-bg)', borderBottom: '1px solid var(--border)', padding: '14px 18px' }}>
                    <span className="card-title">Recent Clean Logs</span>
                  </div>
                  {recon.recentLogs.length === 0 ? (
                    <div className="empty-state" style={{ padding: '28px 24px' }}><div className="empty-state-sub">No logs yet</div></div>
                  ) : (
                    <table className="data-table">
                      <thead><tr><th>Date</th><th className="text-right">King</th><th className="text-right">Twin</th><th className="text-right">Rooms</th></tr></thead>
                      <tbody>
                        {recon.recentLogs.map(l => {
                          const totalK = l.kingDep + l.kingRegular + l.kingDay3;
                          const totalT = l.twinDep + l.twinRegular + l.twinDay3;
                          return (
                            <tr key={l.id}>
                              <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(l.date)}</td>
                              <td className="text-right mono">{totalK}</td>
                              <td className="text-right mono">{totalT}</td>
                              <td className="text-right mono" style={{ color: 'var(--blue)', fontWeight: 600 }}>{totalK + totalT}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
                <div className="table-wrap">
                  <div className="card-header" style={{ background: 'var(--card-bg)', borderBottom: '1px solid var(--border)', padding: '14px 18px' }}>
                    <span className="card-title">Recent Deliveries</span>
                  </div>
                  {recon.recentDeliveries.length === 0 ? (
                    <div className="empty-state" style={{ padding: '28px 24px' }}><div className="empty-state-sub">No deliveries yet</div></div>
                  ) : (
                    <table className="data-table">
                      <thead><tr><th>Date</th><th className="text-right">Sheets</th><th className="text-right">Terrys</th><th>Notes</th></tr></thead>
                      <tbody>
                        {recon.recentDeliveries.map(d => (
                          <tr key={d.id}>
                            <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(d.date)}</td>
                            <td className="text-right mono">{d.kingSheets + d.singleSheets + d.pillowSlipsMed + d.pillowSlipsLarge}</td>
                            <td className="text-right mono">{d.bathTowels + d.handTowels + d.faceTowels + d.bathMats}</td>
                            <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{d.notes || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
