"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, Filler);

// ─── Types ────────────────────────────────────────────────────────────────────

type CategoryHealth = { name: string; count: number; stockPct: number };

type ReorderItem = {
  id: number; name: string; category: string;
  stock: number; targetStock: number;
  reorderPoint: number | null; reorderQty: number | null;
  status: string; shortage: number;
};

type Transaction = {
  id: number; quantity: number; type: string; reason: string | null;
  timestamp: string; item: { name: string; category: { name: string } };
};

type DashboardData = {
  kpis: { total: number; green: number; amber: number; red: number; needsReorder: number };
  categoryHealth: CategoryHealth[];
  reorderList: ReorderItem[];
  recentTransactions: Transaction[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function barClass(pct: number) {
  if (pct >= 80) return 'bar-green';
  if (pct >= 50) return 'bar-amber';
  return 'bar-red';
}

function barColor(pct: number) {
  if (pct >= 80) return 'var(--green)';
  if (pct >= 50) return 'var(--amber)';
  return 'var(--red)';
}

function txBadgeClass(type: string) {
  if (type === 'add') return 'badge tx-add';
  if (type === 'remove') return 'badge tx-remove';
  return 'badge tx-stock';
}

// ─── Chart config ─────────────────────────────────────────────────────────────

const DEMAND_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const demandData = {
  labels: DEMAND_LABELS,
  datasets: [
    {
      label: 'Departures',
      data: [49, 49, 48, 26, 18, 23, 16],
      backgroundColor: '#E31937',
      borderRadius: 5,
      yAxisID: 'y',
    },
    {
      label: 'Occupied Rooms',
      data: [95, 82, 47, 40, 35, 31, 34],
      type: 'line' as const,
      borderColor: '#3B82F6',
      backgroundColor: 'rgba(59,130,246,0.08)',
      borderWidth: 2,
      fill: true,
      tension: 0.3,
      pointRadius: 3,
      pointBackgroundColor: '#3B82F6',
      yAxisID: 'y1',
    },
  ],
};

const demandOptions = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: 'index' as const, intersect: false },
  plugins: {
    legend: {
      position: 'top' as const,
      labels: {
        color: '#6b6b7b',
        font: { size: 11, family: 'JetBrains Mono' },
        boxWidth: 10,
        padding: 16,
      },
    },
    tooltip: {
      backgroundColor: 'rgba(10,10,10,0.92)',
      borderColor: 'rgba(255,255,255,0.08)',
      borderWidth: 1,
      titleColor: '#f0f0f0',
      bodyColor: '#9ca3af',
      titleFont: { family: 'JetBrains Mono', size: 11 },
      bodyFont: { family: 'JetBrains Mono', size: 11 },
      padding: 10,
    },
  },
  scales: {
    x: {
      grid: { display: false },
      border: { display: false },
      ticks: { color: '#6b6b7b', font: { size: 10, family: 'JetBrains Mono' } },
    },
    y: {
      position: 'left' as const,
      grid: { color: 'rgba(255,255,255,0.05)' },
      border: { display: false },
      ticks: { color: '#6b6b7b', font: { size: 10, family: 'JetBrains Mono' } },
    },
    y1: {
      position: 'right' as const,
      grid: { display: false },
      border: { display: false },
      ticks: { color: '#6b6b7b', font: { size: 10, family: 'JetBrains Mono' } },
    },
  },
};

// ─── Component ─────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleDateString('en-NZ', { year: 'numeric', month: 'short', day: 'numeric' }) +
        ' · ' +
        now.toLocaleTimeString('en-NZ', { hour: '2-digit', minute: '2-digit', hour12: false })
      );
    };
    updateTime();
    const int = setInterval(updateTime, 60000);
    return () => clearInterval(int);
  }, []);

  const fetchDashboard = async () => {
    try {
      const res = await fetch('/api/dashboard');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load');
      setData(json);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDashboard(); }, []);
  useEffect(() => {
    const int = setInterval(fetchDashboard, 60000);
    return () => clearInterval(int);
  }, []);

  const kpis = data?.kpis;
  const reorderList = data?.reorderList ?? [];
  const categoryHealth = data?.categoryHealth ?? [];
  const recentTxs = data?.recentTransactions ?? [];

  return (
    <div className="page-wrap">

      {/* Page Header */}
      <div className="page-header">
        <div>
          <div className="page-title">DASHBOARD</div>
          <div className="page-sub">Radisson RED Auckland · Sincerity Laundry — Order by 09:00</div>
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
            style={{
              background: 'none', border: '1px solid var(--border)',
              color: 'var(--text-muted)', borderRadius: '6px',
              padding: '5px 10px', cursor: 'pointer', fontSize: '13px',
              transition: 'all 0.15s',
            }}
            title="Refresh"
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

      {/* Loading */}
      {loading && (
        <div className="empty-state">
          <div className="empty-state-icon">⋯</div>
          <div className="empty-state-sub mono" style={{ letterSpacing: '0.1em' }}>LOADING LIVE DATA</div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="error-box" style={{ marginBottom: '24px' }}>
          ⚠ {error} —{' '}
          <a href="/api/seed" style={{ color: 'var(--blue)', fontWeight: 600 }}>Seed data</a> to get started.
        </div>
      )}

      {/* Content */}
      {!loading && kpis && (
        <>
          {/* KPI Strip */}
          <div className="kpi-grid">
            {[
              { label: 'Items Tracked', value: kpis.total,        color: 'kpi-blue' },
              { label: 'Stock OK',      value: kpis.green,        color: 'kpi-green' },
              { label: 'Low Stock',     value: kpis.amber,        color: 'kpi-amber' },
              { label: 'Reorder Now',   value: kpis.red,          color: 'kpi-red' },
            ].map(k => (
              <div key={k.label} className={`kpi-card ${k.color}`}>
                <div className="kpi-label">{k.label}</div>
                <div className="kpi-value">{k.value}</div>
              </div>
            ))}
          </div>

          {/* Row 1: Category Health + Reorder List */}
          <div className="two-col" style={{ marginBottom: '16px' }}>

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

            {/* Reorder List */}
            <div className="glass-card">
              <div className="card-header">
                <span className="card-title">Reorder List</span>
                {reorderList.length > 0 && (
                  <span className="badge badge-red">{reorderList.length} items</span>
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
                        <td className="text-right mono" style={{ color: 'var(--blue)', fontWeight: 600, paddingRight: '20px' }}>
                          {item.reorderQty ?? (item.targetStock - item.stock)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {reorderList.length > 0 && (
                <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)' }}>
                  <Link href="/inventory" style={{ fontSize: '11px', color: 'var(--blue)', textDecoration: 'none', fontWeight: 600, fontFamily: 'JetBrains Mono' }}>
                    VIEW ALL IN INVENTORY →
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Row 2: Demand Chart + Recent Activity */}
          <div className="two-col">

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
                            {tx.type}
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
        </>
      )}

      {/* Empty state — no data yet */}
      {!loading && !error && !kpis?.total && (
        <div className="glass-card" style={{ textAlign: 'center', padding: '56px 24px' }}>
          <div className="empty-state-icon">📦</div>
          <div className="empty-state-title">No inventory data yet</div>
          <div className="empty-state-sub" style={{ marginBottom: '24px' }}>
            Seed the database with Radisson inventory data to get started.
          </div>
          <a
            href="/api/seed"
            className="btn btn-primary"
            style={{ textDecoration: 'none', display: 'inline-flex' }}
          >
            Seed Inventory Data
          </a>
        </div>
      )}

      {/* Footer */}
      <div style={{
        marginTop: '32px',
        paddingTop: '16px',
        borderTop: '1px solid var(--border)',
        fontFamily: 'JetBrains Mono',
        fontSize: '10px',
        color: 'var(--text-subtle)',
        letterSpacing: '0.06em',
        display: 'flex',
        justifyContent: 'space-between',
      }}>
        <span>NEXDO HOSPITALITY · RADISSON RED AUCKLAND</span>
        <span>{currentTime}</span>
      </div>
    </div>
  );
}
