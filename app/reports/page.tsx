'use client';

import { useState, useEffect, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

type OccupancyLog = {
  id: number; date: string; occupiedRooms: number;
  totalRooms: number; notes: string; occupancyPct: number;
};

type ConsumptionItem = {
  id: number; name: string; category: string;
  totalUsed: number; dailyRate: number; daysRemaining: number | null;
  stock: number; perRoom?: number | null;
  unitCost?: number | null; totalCost?: number; costPerRoom?: number | null;
  status: string;
};

type ReportData = {
  windowDays: number; avgOccupancy: number | null;
  totalOccupiedRoomNights: number; daysWithOccupancyData: number;
  radissonConsumption: ConsumptionItem[];
  nexdoConsumption: ConsumptionItem[];
  nexdoTotalCost: number; nexdoCostPerRoom: number | null;
  urgent: ConsumptionItem[];
};

const TOTAL_ROOMS = 322;

function today() { return new Date().toISOString().slice(0, 10); }

function fmtDate(s: string) {
  if (!s) return '—';
  return new Date(s + 'T12:00:00').toLocaleDateString('en-NZ', { weekday: 'short', day: 'numeric', month: 'short' });
}

function daysColor(d: number | null) {
  if (d === null) return 'var(--text-muted)';
  if (d < 3)  return 'var(--red)';
  if (d < 7)  return 'var(--amber)';
  if (d < 14) return 'var(--orange)';
  return 'var(--green)';
}

function daysLabel(d: number | null) {
  if (d === null) return '—';
  if (d === 0) return 'OUT';
  return `${d}d`;
}

const Spinner = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
    className="is-spinning-icon" aria-hidden>
    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
  </svg>
);

// ─── Occupancy bar mini-chart ─────────────────────────────────────────────────

function OccupancyBar({ pct }: { pct: number }) {
  const color = pct >= 80 ? 'var(--green)' : pct >= 50 ? 'var(--amber)' : 'var(--red)';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div className="bar-track" style={{ flex: 1, height: 6 }}>
        <div className="bar-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="mono" style={{ fontSize: 11, color, fontWeight: 600, minWidth: 32, textAlign: 'right' }}>{pct}%</span>
    </div>
  );
}

// ─── Days-remaining pill ──────────────────────────────────────────────────────

function DaysPill({ days }: { days: number | null }) {
  const color = daysColor(days);
  const label = daysLabel(days);
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 4,
      background: days !== null && days < 7 ? (days < 3 ? 'var(--red-soft)' : 'var(--amber-soft)') : 'var(--hover-bg)',
      color, fontFamily: 'JetBrains Mono, monospace', fontSize: 11, fontWeight: 700,
    }}>{label}</span>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const [tab, setTab] = useState<'occupancy' | 'consumption' | 'nexdo-cost'>('occupancy');

  // Occupancy tab
  const [occDate, setOccDate]         = useState(today());
  const [occRooms, setOccRooms]       = useState<number>(0);
  const [occNotes, setOccNotes]       = useState('');
  const [occSaving, setOccSaving]     = useState(false);
  const [occSuccess, setOccSuccess]   = useState(false);
  const [occError, setOccError]       = useState('');
  const [occLogs, setOccLogs]         = useState<OccupancyLog[]>([]);
  const [occLoading, setOccLoading]   = useState(true);

  // Consumption tab
  const [window, setWindow]           = useState(30);
  const [report, setReport]           = useState<ReportData | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [catFilter, setCatFilter]     = useState<'all' | 'linens' | 'nexdo'>('all');

  const loadOccupancy = useCallback(async () => {
    setOccLoading(true);
    try {
      const res = await fetch('/api/reports/occupancy');
      const data = await res.json();
      setOccLogs(data.logs ?? []);
    } catch {/* ignore */} finally { setOccLoading(false); }
  }, []);

  const loadReport = useCallback(async () => {
    setReportLoading(true);
    try {
      const res = await fetch(`/api/reports/consumption?days=${window}`);
      const data = await res.json();
      setReport(data);
    } catch {/* ignore */} finally { setReportLoading(false); }
  }, [window]);

  useEffect(() => { loadOccupancy(); }, [loadOccupancy]);
  useEffect(() => { if (tab === 'consumption' || tab === 'nexdo-cost') loadReport(); }, [tab, loadReport]);

  // Pre-fill today's occupancy if already logged
  useEffect(() => {
    const existing = occLogs.find(l => l.date === occDate);
    if (existing) setOccRooms(existing.occupiedRooms);
    else setOccRooms(0);
  }, [occDate, occLogs]);

  async function submitOccupancy(e: React.FormEvent) {
    e.preventDefault();
    if (occRooms <= 0) { setOccError('Enter rooms occupied (1–322).'); return; }
    setOccSaving(true); setOccError('');
    try {
      const res = await fetch('/api/reports/occupancy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: occDate, occupiedRooms: occRooms, notes: occNotes }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setOccSuccess(true); setTimeout(() => setOccSuccess(false), 2500);
      setOccNotes('');
      await loadOccupancy();
    } catch (e: any) { setOccError(e.message); }
    finally { setOccSaving(false); }
  }

  // Derived: last 7 / 30 day avg occupancy from logs
  const last7  = occLogs.slice(0, 7);
  const last30 = occLogs.slice(0, 30);
  const avg7  = last7.length  ? Math.round(last7.reduce((s, l)  => s + l.occupancyPct, 0) / last7.length)  : null;
  const avg30 = last30.length ? Math.round(last30.reduce((s, l) => s + l.occupancyPct, 0) / last30.length) : null;

  // Filtered consumption items
  const allConsumption = report ? [
    ...report.radissonConsumption.map(i => ({ ...i, source: 'Radisson' })),
    ...report.nexdoConsumption.map(i => ({ ...i, source: 'NexDo' })),
  ] : [];
  const filteredConsumption = allConsumption.filter(i => {
    if (catFilter === 'linens') return i.source === 'Radisson';
    if (catFilter === 'nexdo')  return i.source === 'NexDo';
    return true;
  }).sort((a, b) => (a.daysRemaining ?? 9999) - (b.daysRemaining ?? 9999));

  return (
    <div className="page-wrap">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Reports</h1>
          <p className="page-sub">Occupancy · Consumption · NexDo Cost Analysis</p>
        </div>
        {report && (
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            {report.avgOccupancy !== null && (
              <div style={{ textAlign: 'right' }}>
                <div className="mono" style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{window}d avg occupancy</div>
                <div className="mono" style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>{report.avgOccupancy}%</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="tab-bar" role="tablist" aria-label="Report sections">
        {([
          { id: 'occupancy',   label: 'Occupancy Log' },
          { id: 'consumption', label: 'Consumption & Forecast' },
          { id: 'nexdo-cost',  label: 'NexDo Cost Report' },
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

      {/* ── OCCUPANCY LOG ─────────────────────────────────────────────────────── */}
      {tab === 'occupancy' && (
        <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 20, alignItems: 'start' }}>

          {/* Input form */}
          <div>
            {/* 7 / 30 day KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div className="kpi-card kpi-blue" style={{ padding: 16 }}>
                <div className="kpi-label">7-Day Avg</div>
                <div className="kpi-value" style={{ fontSize: 28 }}>{avg7 !== null ? `${avg7}%` : '—'}</div>
                <div className="kpi-trend">{last7.length} days logged</div>
              </div>
              <div className="kpi-card kpi-green" style={{ padding: 16 }}>
                <div className="kpi-label">30-Day Avg</div>
                <div className="kpi-value" style={{ fontSize: 28 }}>{avg30 !== null ? `${avg30}%` : '—'}</div>
                <div className="kpi-trend">{last30.length} days logged</div>
              </div>
            </div>

            <form onSubmit={submitOccupancy}>
              <div className="glass-card">
                <div className="card-header">
                  <span className="card-title">Log Occupancy</span>
                  <input type="date" value={occDate} onChange={e => setOccDate(e.target.value)}
                    className="form-input" style={{ width: 'auto', padding: '4px 10px', fontSize: 12 }} />
                </div>
                <div className="card-body">
                  <div className="form-row">
                    <label className="form-label">Rooms Occupied <span style={{ color: 'var(--text-subtle)', textTransform: 'none', letterSpacing: 0 }}>out of {TOTAL_ROOMS}</span></label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <input
                        className="form-input" type="number" min={0} max={322}
                        value={occRooms} onChange={e => setOccRooms(Math.min(322, Math.max(0, parseInt(e.target.value) || 0)))}
                        style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, fontSize: 20, textAlign: 'center', flex: 1 }}
                      />
                      <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 22, fontWeight: 700, color: occRooms > 0 ? (occRooms / 322 >= 0.8 ? 'var(--green)' : 'var(--amber)') : 'var(--text-muted)', minWidth: 52 }}>
                        {occRooms > 0 ? `${Math.round((occRooms / 322) * 100)}%` : '—'}
                      </div>
                    </div>
                    <div className="bar-track" style={{ marginTop: 8, height: 6 }}>
                      <div className="bar-fill" style={{ width: `${(occRooms / 322) * 100}%`, background: occRooms / 322 >= 0.8 ? 'var(--green)' : occRooms / 322 >= 0.5 ? 'var(--amber)' : 'var(--red)', transition: 'width 0.2s ease' }} />
                    </div>
                  </div>
                  <div className="form-row">
                    <label className="form-label">Notes (optional)</label>
                    <input className="form-input" placeholder="e.g. event in house, school holidays..." value={occNotes} onChange={e => setOccNotes(e.target.value)} />
                  </div>
                  {occError && <div className="error-box" role="alert">{occError}</div>}
                  {occSuccess && <div role="status" style={{ background: 'var(--green-soft)', border: '1px solid rgba(34,197,94,.25)', borderRadius: 7, padding: '10px 14px', fontSize: 12, color: 'var(--green)', marginBottom: 12 }}>✓ Occupancy logged</div>}
                  <button type="submit" className="btn btn-primary" disabled={occSaving} style={{ width: '100%', justifyContent: 'center' }}>
                    {occSaving && <Spinner />}{occSaving ? 'Saving…' : 'Save Occupancy'}
                  </button>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 10, textAlign: 'center' }}>
                    Logging the same date updates the existing entry.
                  </p>
                </div>
              </div>
            </form>
          </div>

          {/* History table */}
          <div className="table-wrap">
            <div className="card-header" style={{ background: 'var(--card-bg)', borderBottom: '1px solid var(--border)', padding: '14px 18px' }}>
              <span className="card-title">Occupancy History — last 90 days</span>
              <button className="btn btn-ghost btn-sm" onClick={loadOccupancy} style={{ padding: '4px 10px' }}>Refresh</button>
            </div>
            {occLoading ? (
              <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}><Spinner /></div>
            ) : occLogs.length === 0 ? (
              <div className="empty-state"><div className="empty-state-title">No occupancy data yet</div><div className="empty-state-sub">Log today's rooms to get started</div></div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th className="text-right">Rooms</th>
                    <th className="text-right">Total</th>
                    <th>Occupancy</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {occLogs.map(log => (
                    <tr key={log.id}>
                      <td style={{ fontWeight: 500 }}>{fmtDate(log.date)}</td>
                      <td className="text-right mono" style={{ fontWeight: 600 }}>{log.occupiedRooms}</td>
                      <td className="text-right mono" style={{ color: 'var(--text-muted)' }}>{log.totalRooms}</td>
                      <td style={{ minWidth: 160 }}><OccupancyBar pct={log.occupancyPct} /></td>
                      <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{log.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── CONSUMPTION & FORECAST ────────────────────────────────────────────── */}
      {tab === 'consumption' && (
        <div>
          {/* Controls */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 20, alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>Window:</span>
            {[7, 14, 30, 60].map(d => (
              <button key={d} onClick={() => { setWindow(d); }}
                className={`cat-btn${window === d ? ' active' : ''}`}>{d} days</button>
            ))}
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
              {(['all', 'linens', 'nexdo'] as const).map(f => (
                <button key={f} onClick={() => setCatFilter(f)}
                  className={`cat-btn${catFilter === f ? ' active' : ''}`} style={{ textTransform: 'capitalize' }}>
                  {f === 'all' ? 'All Items' : f === 'linens' ? 'Linens' : 'NexDo'}
                </button>
              ))}
            </div>
            <button className="btn btn-ghost btn-sm" onClick={loadReport} style={{ padding: '5px 12px' }}>
              {reportLoading ? <Spinner /> : 'Refresh'}
            </button>
          </div>

          {reportLoading && !report && (
            <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}><Spinner /></div>
          )}

          {report && (
            <>
              {/* Summary KPIs */}
              <div className="kpi-grid stagger-in" style={{ marginBottom: 20 }}>
                <div className="kpi-card kpi-blue">
                  <div className="kpi-label">Avg Occupancy</div>
                  <div className="kpi-value">{report.avgOccupancy !== null ? `${report.avgOccupancy}%` : '—'}</div>
                  <div className="kpi-trend">{report.daysWithOccupancyData} days of data ({window}d window)</div>
                </div>
                <div className="kpi-card kpi-amber">
                  <div className="kpi-label">Room-Nights</div>
                  <div className="kpi-value">{report.totalOccupiedRoomNights.toLocaleString()}</div>
                  <div className="kpi-trend">occupied room-nights logged</div>
                </div>
                <div className="kpi-card kpi-red">
                  <div className="kpi-label">Urgent</div>
                  <div className="kpi-value">{report.urgent.length}</div>
                  <div className="kpi-trend">items &lt; 7 days of stock left</div>
                </div>
                <div className="kpi-card kpi-green">
                  <div className="kpi-label">NexDo Spend</div>
                  <div className="kpi-value" style={{ fontSize: 28 }}>${report.nexdoTotalCost.toFixed(0)}</div>
                  <div className="kpi-trend">{report.nexdoCostPerRoom !== null ? `$${report.nexdoCostPerRoom} / occupied room` : 'log occupancy for cost/room'}</div>
                </div>
              </div>

              {/* Urgent alerts */}
              {report.urgent.length > 0 && (
                <div style={{ background: 'var(--red-soft)', border: '1px solid rgba(227,25,55,0.2)', borderRadius: 10, padding: '14px 18px', marginBottom: 20 }}>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--red)', marginBottom: 10 }}>⚠ Running Low — Order Soon</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {report.urgent.map(i => (
                      <div key={i.id} style={{ background: 'var(--bg-sub)', border: '1px solid rgba(227,25,55,0.3)', borderRadius: 6, padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{i.name}</span>
                        <DaysPill days={i.daysRemaining} />
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{i.stock} left</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Main consumption table */}
              <div className="table-wrap">
                <div className="card-header" style={{ background: 'var(--card-bg)', borderBottom: '1px solid var(--border)', padding: '14px 18px' }}>
                  <span className="card-title">Consumption Rates — last {window} days</span>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--text-muted)' }}>
                    {report.avgOccupancy === null ? '⚠ Log occupancy to see per-room metrics' : `${report.avgOccupancy}% avg occupancy`}
                  </span>
                </div>
                {filteredConsumption.length === 0 ? (
                  <div className="empty-state"><div className="empty-state-sub">No usage recorded in this window yet. Adjust stock to track consumption.</div></div>
                ) : (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th>Source</th>
                        <th className="text-right">Used ({window}d)</th>
                        <th className="text-right">Per Day</th>
                        <th className="text-right">Per Room</th>
                        <th className="text-right">Stock Left</th>
                        <th className="text-right">Days Left</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredConsumption.map((item: any) => (
                        <tr key={`${item.source}-${item.id}`} className={item.daysRemaining !== null && item.daysRemaining < 3 ? 'row-critical' : ''}>
                          <td style={{ fontWeight: 500 }}>{item.name}</td>
                          <td>
                            <span style={{ display: 'inline-block', padding: '2px 7px', borderRadius: 4, fontSize: 10, fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', background: item.source === 'NexDo' ? 'rgba(14,165,233,0.12)' : 'var(--blue-soft)', color: item.source === 'NexDo' ? '#0ea5e9' : 'var(--blue)' }}>
                              {item.source}
                            </span>
                          </td>
                          <td className="text-right mono">{item.totalUsed > 0 ? item.totalUsed : <span style={{ color: 'var(--text-subtle)' }}>—</span>}</td>
                          <td className="text-right mono" style={{ color: 'var(--text-muted)' }}>{item.dailyRate > 0 ? item.dailyRate : <span style={{ color: 'var(--text-subtle)' }}>—</span>}</td>
                          <td className="text-right mono" style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                            {item.perRoom != null ? item.perRoom : (item.costPerRoom != null ? `$${item.costPerRoom}` : '—')}
                          </td>
                          <td className="text-right mono" style={{ fontWeight: 600 }}>{item.stock}</td>
                          <td className="text-right"><DaysPill days={item.daysRemaining} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {report.avgOccupancy === null && (
                <div style={{ marginTop: 16, padding: '12px 16px', background: 'var(--amber-soft)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 8, fontSize: 12, color: 'var(--amber)' }}>
                  💡 <strong>Tip:</strong> Go to the Occupancy Log tab and enter your daily rooms occupied to unlock per-room consumption metrics and the NexDo cost-per-room calculation.
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── NEXDO COST REPORT ─────────────────────────────────────────────────── */}
      {tab === 'nexdo-cost' && (
        <div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 20, alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>Period:</span>
            {[7, 14, 30, 60].map(d => (
              <button key={d} onClick={() => setWindow(d)}
                className={`cat-btn${window === d ? ' active' : ''}`}>{d} days</button>
            ))}
            <button className="btn btn-ghost btn-sm" onClick={loadReport} style={{ marginLeft: 'auto', padding: '5px 12px' }}>
              {reportLoading ? <Spinner /> : 'Refresh'}
            </button>
          </div>

          {reportLoading && !report && (
            <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}><Spinner /></div>
          )}

          {report && (
            <>
              {/* Cost KPIs */}
              <div className="kpi-grid stagger-in" style={{ marginBottom: 20 }}>
                <div className="kpi-card kpi-red">
                  <div className="kpi-label">Total NexDo Spend</div>
                  <div className="kpi-value" style={{ fontSize: 28 }}>${report.nexdoTotalCost.toFixed(2)}</div>
                  <div className="kpi-trend">consumables used in {window} days</div>
                </div>
                <div className="kpi-card kpi-amber">
                  <div className="kpi-label">Cost / Occupied Room</div>
                  <div className="kpi-value" style={{ fontSize: 28 }}>{report.nexdoCostPerRoom !== null ? `$${report.nexdoCostPerRoom}` : '—'}</div>
                  <div className="kpi-trend">{report.nexdoCostPerRoom === null ? 'log occupancy to calculate' : 'NexDo cleaning cost per room'}</div>
                </div>
                <div className="kpi-card kpi-blue">
                  <div className="kpi-label">Room-Nights</div>
                  <div className="kpi-value">{report.totalOccupiedRoomNights.toLocaleString()}</div>
                  <div className="kpi-trend">in {window}-day window</div>
                </div>
                <div className="kpi-card kpi-green">
                  <div className="kpi-label">Avg Occupancy</div>
                  <div className="kpi-value">{report.avgOccupancy !== null ? `${report.avgOccupancy}%` : '—'}</div>
                  <div className="kpi-trend">{report.daysWithOccupancyData} days logged</div>
                </div>
              </div>

              {/* Cost breakdown by item */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {/* By category */}
                <div className="glass-card">
                  <div className="card-header"><span className="card-title">Cost by Category</span></div>
                  <div className="card-body" style={{ padding: 0 }}>
                    {['Equipment', 'Chemicals', 'Tools', 'Safety'].map(cat => {
                      const catItems = report.nexdoConsumption.filter(i => i.category === cat && (i.totalCost ?? 0) > 0);
                      const total = catItems.reduce((s, i) => s + (i.totalCost ?? 0), 0);
                      if (total === 0) return null;
                      return (
                        <div key={cat} style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                            <span style={{ fontWeight: 500, fontSize: 13 }}>{cat}</span>
                            <span className="mono" style={{ fontWeight: 700, color: 'var(--text)' }}>${total.toFixed(2)}</span>
                          </div>
                          <div className="bar-track" style={{ height: 5 }}>
                            <div className="bar-fill bar-green" style={{ width: `${(total / Math.max(report.nexdoTotalCost, 1)) * 100}%` }} />
                          </div>
                        </div>
                      );
                    })}
                    {report.nexdoTotalCost === 0 && (
                      <div className="empty-state" style={{ padding: '28px 20px' }}>
                        <div className="empty-state-sub">No NexDo consumption recorded yet. Use "Adjust Stock → Used" to track usage.</div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Item-level cost table */}
                <div className="table-wrap" style={{ boxShadow: 'none', border: '1px solid var(--card-border)', borderRadius: 'var(--radius)' }}>
                  <div className="card-header" style={{ background: 'var(--card-bg)', borderBottom: '1px solid var(--border)', padding: '14px 18px' }}>
                    <span className="card-title">Item-Level Spend</span>
                  </div>
                  <table className="data-table">
                    <thead><tr><th>Item</th><th className="text-right">Used</th><th className="text-right">Unit $</th><th className="text-right">Total $</th><th className="text-right">$/Room</th></tr></thead>
                    <tbody>
                      {report.nexdoConsumption
                        .filter(i => i.totalUsed > 0)
                        .sort((a, b) => (b.totalCost ?? 0) - (a.totalCost ?? 0))
                        .map(item => (
                          <tr key={item.id}>
                            <td style={{ fontSize: 12, fontWeight: 500 }}>{item.name}</td>
                            <td className="text-right mono" style={{ fontSize: 12 }}>{item.totalUsed}</td>
                            <td className="text-right mono" style={{ fontSize: 12, color: 'var(--text-muted)' }}>{item.unitCost ? `$${item.unitCost}` : '—'}</td>
                            <td className="text-right mono" style={{ fontWeight: 600 }}>${(item.totalCost ?? 0).toFixed(2)}</td>
                            <td className="text-right mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.costPerRoom != null ? `$${item.costPerRoom}` : '—'}</td>
                          </tr>
                        ))}
                      {report.nexdoConsumption.filter(i => i.totalUsed > 0).length === 0 && (
                        <tr><td colSpan={5} style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)', fontSize: 12 }}>No usage recorded yet</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {report.nexdoCostPerRoom !== null && (
                <div style={{ marginTop: 16, padding: '14px 18px', background: 'var(--blue-soft)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 8, fontSize: 13 }}>
                  <strong style={{ color: 'var(--blue)' }}>Billing Summary:</strong>
                  <span style={{ color: 'var(--text)', marginLeft: 8 }}>
                    NexDo cleaning cost for {window} days = <strong>${report.nexdoTotalCost.toFixed(2)}</strong> across <strong>{report.totalOccupiedRoomNights.toLocaleString()}</strong> occupied room-nights = <strong>${report.nexdoCostPerRoom}/roo