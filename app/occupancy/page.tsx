'use client';

import { useEffect, useState } from 'react';

type OccupancyLog = {
  id: number;
  date: string;
  occupiedRooms: number;
  totalRooms: number;
  occupancyPct: number;
  arrivals?: number;
  departures?: number;
  stayovers?: number;
  roomRevenue?: number | null;
  adr?: number | null;
  notes: string;
  source?: string;
};

type Summary = {
  latestDate: string;
  avgOccupancyPct: number;
  avgRevenue: number;
  avgRate: number;
  totalDays: number;
};

export default function OccupancyPage() {
  const [data, setData] = useState<OccupancyLog[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState('');
  const [loading, setLoading] = useState(true);

  // Load occupancy data — pass fresh=1 to bypass server-side cache
  async function loadData(fresh = false) {
    try {
      setLoading(true);
      const url = fresh ? '/api/occupancy/data?fresh=1' : '/api/occupancy/data';
      const res = await fetch(url);
      const json = await res.json();
      if (json.data) {
        setData(json.data); // Already sorted by API (newest first)
        setSummary(json.summary);
      }
    } catch (err) {
      console.error('Failed to load occupancy data:', err);
    } finally {
      setLoading(false);
    }
  }

  // Handle CSV upload
  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      setUploadMsg('');

      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/occupancy/upload', {
        method: 'POST',
        body: formData,
      });

      const json = await res.json();
      if (res.ok) {
        setUploadMsg(`✓ ${json.message}`);
        // Use fresh=1 to bust any cached data from before the upload
        await loadData(true);
      } else {
        setUploadMsg(`✗ ${json.error}`);
      }
    } catch (err) {
      setUploadMsg(`✗ Upload failed: ${err}`);
    } finally {
      setUploading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const sortedData = [...data].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div style={{ padding: '2rem' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: '600', marginBottom: '0.5rem', color: 'var(--text)' }}>
          Hotel Occupancy Tracker
        </h1>
        <p style={{ color: 'var(--text-muted)' }}>
          Daily occupancy data, revenue trends, and forecasts
        </p>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
          marginBottom: '2rem',
        }}>
          <SummaryCard label="Latest Date" value={summary.latestDate || '—'} />
          <SummaryCard label="Avg Occupancy" value={`${summary.avgOccupancyPct}%`} />
          <SummaryCard label="Avg Daily Revenue" value={`NZ$${summary.avgRevenue.toLocaleString('en-NZ', { maximumFractionDigits: 0 })}`} />
          <SummaryCard label="Avg ADR" value={`NZ$${summary.avgRate.toFixed(0)}`} />
          <SummaryCard label="Days Tracked" value={summary.totalDays.toString()} />
        </div>
      )}

      {/* Upload Section */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--card-border)',
        borderRadius: '0.5rem',
        padding: '1.5rem',
        marginBottom: '2rem',
      }}>
        <h2 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '1rem', color: 'var(--text)' }}>
          Import Occupancy Data
        </h2>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
          Upload a CSV export from your Opera PMS or hotel management system. The system will map key columns: Date, Total Occupied Rooms, Arrivals, Average Daily Rate, Room Revenue, and Departures.
        </p>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
        }}>
          <label style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.75rem 1rem',
            background: 'var(--red)',
            color: 'white',
            borderRadius: '0.375rem',
            cursor: uploading ? 'not-allowed' : 'pointer',
            opacity: uploading ? 0.6 : 1,
            fontSize: '0.875rem',
            fontWeight: '500',
          }}>
            {uploading ? 'Uploading...' : '📁 Choose CSV File'}
            <input
              type="file"
              accept=".csv"
              onChange={handleUpload}
              disabled={uploading}
              style={{ display: 'none' }}
            />
          </label>
          {uploadMsg && (
            <span style={{
              fontSize: '0.875rem',
              color: uploadMsg.startsWith('✓') ? '#22c55e' : 'var(--red)',
            }}>
              {uploadMsg}
            </span>
          )}
        </div>
      </div>

      {/* Data Table */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--card-border)',
        borderRadius: '0.5rem',
        padding: '1.5rem',
        overflowX: 'auto',
      }}>
        <h2 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '1rem', color: 'var(--text)' }}>
          Occupancy Records {data.length > 0 && `(${data.length})`}
        </h2>

        {loading ? (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>Loading...</p>
        ) : sortedData.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>No occupancy data yet. Upload a CSV file to get started.</p>
        ) : (
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '0.875rem',
          }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={{ textAlign: 'left', padding: '0.75rem 0.5rem', color: 'var(--text-muted)', fontWeight: '500' }}>Date</th>
                <th style={{ textAlign: 'center', padding: '0.75rem 0.5rem', color: 'var(--text-muted)', fontWeight: '500' }}>Rooms</th>
                <th style={{ textAlign: 'center', padding: '0.75rem 0.5rem', color: 'var(--text-muted)', fontWeight: '500' }}>Occ. %</th>
                <th style={{ textAlign: 'center', padding: '0.75rem 0.5rem', color: 'var(--text-muted)', fontWeight: '500' }}>Arr.</th>
                <th style={{ textAlign: 'center', padding: '0.75rem 0.5rem', color: 'var(--text-muted)', fontWeight: '500' }}>Dep.</th>
                <th style={{ textAlign: 'right', padding: '0.75rem 0.5rem', color: 'var(--text-muted)', fontWeight: '500' }}>Revenue</th>
                <th style={{ textAlign: 'right', padding: '0.75rem 0.5rem', color: 'var(--text-muted)', fontWeight: '500' }}>ADR</th>
              </tr>
            </thead>
            <tbody>
              {sortedData.map((row) => (
                <tr key={row.date} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '0.75rem 0.5rem', color: 'var(--text)', fontFamily: 'JetBrains Mono' }}>{row.date}</td>
                  <td style={{ textAlign: 'center', padding: '0.75rem 0.5rem', color: 'var(--text)' }}>{row.occupiedRooms}/{row.totalRooms}</td>
                  <td style={{ textAlign: 'center', padding: '0.75rem 0.5rem', color: 'var(--text)', fontWeight: '500' }}>{row.occupancyPct}%</td>
                  <td style={{ textAlign: 'center', padding: '0.75rem 0.5rem', color: 'var(--text)' }}>{row.arrivals ?? '—'}</td>
                  <td style={{ textAlign: 'center', padding: '0.75rem 0.5rem', color: 'var(--text)' }}>{row.departures ?? '—'}</td>
                  <td style={{ textAlign: 'right', padding: '0.75rem 0.5rem', color: 'var(--gold)', fontWeight: '500' }}>
                    {row.roomRevenue ? `NZ$${row.roomRevenue.toLocaleString('en-NZ', { maximumFractionDigits: 0 })}` : '—'}
                  </td>
                  <td style={{ textAlign: 'right', padding: '0.75rem 0.5rem', color: 'var(--text)' }}>
                    {row.adr ? `NZ$${row.adr.toFixed(0)}` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Footer Note */}
      <div style={{ marginTop: '2rem', padding: '1rem', background: 'rgba(201, 169, 110, 0.05)', borderLeft: '3px solid var(--gold)', borderRadius: '0.25rem' }}>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: 0 }}>
          💡 <strong>Tip:</strong> Currently accepting manual CSV uploads. A future update will add automatic daily pulls from your Opera PMS system.
        </p>
      </div>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--card-border)',
      borderRadius: '0.5rem',
      padding: '1.25rem',
    }}>
      <p style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
        {label}
      </p>
      <p style={{ fontSize: '1.5rem', fontWeight: '600', color: 'var(--text)' }}>
        {value}
      </p>
    </div>
  );
}
