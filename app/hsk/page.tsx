'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

type RosterEntry = {
  id: number; phoneId: number; name: string; role: string;
  active: boolean; notes: string; timestamp: string;
};

type Assignment = {
  id: number; date: string; phoneId: number; housekeeperName: string;
  shift: string; startTime: string; endTime: string; notes: string; timestamp: string;
};

type PerfEntry = {
  id: number; date: string; phoneId: number; housekeeperName: string;
  roomsAssigned: number; departuresDone: number; stayoversDone: number;
  roomsCleaned: number; minutesWorked: number; avgMinsPerRoom: number | null;
  qualityScore: number | null; notes: string; source: string; timestamp: string;
};

type DailyKPI = {
  date: string;
  entries: number;
  totalRoomsAssigned: number;
  totalRoomsCleaned: number;
  totalMinutes: number;
  avgMinsPerRoom: number | null;
  avgQuality: number | null;
  occupiedRooms: number | null;
  occupancyPct: number | null;
  efficiency: number | null; // roomsCleaned / minutesWorked * 60 (rooms/hr)
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function today() { return new Date().toISOString().slice(0, 10); }

function fmtDate(s: string) {
  if (!s) return '—';
  return new Date(s + 'T12:00:00').toLocaleDateString('en-NZ', {
    weekday: 'short', day: 'numeric', month: 'short',
  });
}

function fmtTime(t: string) {
  return t || '—';
}

const Spinner = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
    className="is-spinning-icon" aria-hidden>
    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
  </svg>
);

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function HSKPage() {
  const [tab, setTab] = useState<'board' | 'performance' | 'roster'>('board');

  // Shared
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [phoneCount, setPhoneCount] = useState(15);

  // Board (today's assignments)
  const [boardDate, setBoardDate] = useState(today());
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [boardLoading, setBoardLoading] = useState(false);

  // Room Status (from Opera HK All Status TXT)
  type RoomStatusEntry = {
    id: number; date: string; room: string; floor: string;
    hskStatus: 'DEP' | 'STA' | 'OUT';
    guestName: string; roomType: string; adults: number; children: number;
    arrival: string; departure: string; nights: number; vip: string; company: string;
    resvStatus: string;
  };
  type RoomSummary = { total: number; departures: number; stayovers: number };
  const [roomStatus, setRoomStatus] = useState<RoomStatusEntry[]>([]);
  const [roomSummary, setRoomSummary] = useState<RoomSummary | null>(null);
  const [roomView, setRoomView] = useState<'floor' | 'status'>('status');
  const [roomUploading, setRoomUploading] = useState(false);
  const [roomUploadMsg, setRoomUploadMsg] = useState('');

  // Performance
  const [perfDate, setPerfDate] = useState(today());
  const [perfEntries, setPerfEntries] = useState<PerfEntry[]>([]);
  const [perfLoading, setPerfLoading] = useState(false);
  const [perfKpis, setPerfKpis] = useState<DailyKPI[]>([]);
  const [perfWindow, setPerfWindow] = useState(30);

  // Roster form state
  const [rosterForm, setRosterForm] = useState<{ phoneId: number; name: string; role: string; active: boolean; notes: string }>({
    phoneId: 1, name: '', role: 'Housekeeper', active: true, notes: '',
  });
  const [rosterSaving, setRosterSaving] = useState(false);
  const [rosterError, setRosterError] = useState('');

  // Performance entry form state
  const [perfForm, setPerfForm] = useState({
    phoneId: 1,
    roomsAssigned: 0,
    departuresDone: 0,
    stayoversDone: 0,
    minutesWorked: 0,
    qualityScore: '' as string,
    notes: '',
  });
  const [perfSaving, setPerfSaving] = useState(false);
  const [perfError, setPerfError] = useState('');
  const [perfSuccess, setPerfSuccess] = useState(false);

  // Assignment form state (inline on board)
  const [editingPhone, setEditingPhone] = useState<number | null>(null);
  const [assignForm, setAssignForm] = useState({
    name: '', shift: 'AM', startTime: '08:00', endTime: '16:00', notes: '',
  });
  const [assignSaving, setAssignSaving] = useState(false);

  // ── Loaders ────────────────────────────────────────────────────────────────

  const loadRoster = useCallback(async () => {
    try {
      const res = await fetch('/api/hsk/roster');
      const data = await res.json();
      setRoster(data.roster ?? []);
      setPhoneCount(data.phoneCount ?? 15);
    } catch { /* ignore */ }
  }, []);

  const loadAssignments = useCallback(async () => {
    setBoardLoading(true);
    try {
      const res = await fetch(`/api/hsk/assignments?date=${boardDate}`);
      const data = await res.json();
      setAssignments(data.assignments ?? []);
    } catch { /* ignore */ } finally { setBoardLoading(false); }
  }, [boardDate]);

  const loadRoomStatus = useCallback(async (fresh = false) => {
    try {
      const url = `/api/hsk/room-status?date=${boardDate}${fresh ? '&fresh=1' : ''}`;
      const res = await fetch(url);
      const data = await res.json();
      setRoomStatus(data.rooms ?? []);
      setRoomSummary(data.summary ?? null);
    } catch { /* ignore */ }
  }, [boardDate]);

  const handleRoomUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setRoomUploading(true);
    setRoomUploadMsg('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('date', boardDate);
      const res = await fetch('/api/hsk/room-status', { method: 'POST', body: fd });
      const json = await res.json();
      if (res.ok) {
        setRoomUploadMsg(`✓ ${json.message} — ${json.summary.departures} DEP · ${json.summary.stayovers} STA`);
        await loadRoomStatus(true);
      } else {
        setRoomUploadMsg(`✗ ${json.error}`);
      }
    } catch (err) {
      setRoomUploadMsg(`✗ Upload failed`);
    } finally {
      setRoomUploading(false);
      e.target.value = '';
    }
  }, [boardDate, loadRoomStatus]);

  const loadPerformance = useCallback(async () => {
    setPerfLoading(true);
    try {
      const [entriesRes, kpiRes] = await Promise.all([
        fetch(`/api/hsk/performance?date=${perfDate}`),
        fetch(`/api/hsk/performance?view=kpis&days=${perfWindow}`),
      ]);
      const entries = await entriesRes.json();
      const kpis = await kpiRes.json();
      setPerfEntries(entries.entries ?? []);
      setPerfKpis(kpis.kpis ?? []);
    } catch { /* ignore */ } finally { setPerfLoading(false); }
  }, [perfDate, perfWindow]);

  useEffect(() => { loadRoster(); }, [loadRoster]);
  useEffect(() => { if (tab === 'board') { loadAssignments(); loadRoomStatus(); } }, [tab, loadAssignments, loadRoomStatus]);
  useEffect(() => { if (tab === 'performance') loadPerformance(); }, [tab, loadPerformance]);

  // Roster lookup by phoneId
  const nameByPhone = useMemo(() => {
    const map = new Map<number, string>();
    roster.forEach(r => { if (r.active !== false) map.set(r.phoneId, r.name); });
    return map;
  }, [roster]);

  // Pre-fill roster form when phoneId changes
  useEffect(() => {
    const existing = roster.find(r => r.phoneId === rosterForm.phoneId);
    if (existing) {
      setRosterForm(f => ({ ...f, name: existing.name, role: existing.role || 'Housekeeper', active: existing.active !== false, notes: existing.notes || '' }));
    } else {
      setRosterForm(f => ({ ...f, name: '', role: 'Housekeeper', active: true, notes: '' }));
    }
  }, [rosterForm.phoneId, roster]);

  // Pre-fill perf form if entry exists for date+phone
  useEffect(() => {
    const existing = perfEntries.find(e => e.phoneId === perfForm.phoneId);
    if (existing) {
      setPerfForm(f => ({
        ...f,
        roomsAssigned: existing.roomsAssigned || 0,
        departuresDone: existing.departuresDone || 0,
        stayoversDone: existing.stayoversDone || 0,
        minutesWorked: existing.minutesWorked || 0,
        qualityScore: existing.qualityScore != null ? String(existing.qualityScore) : '',
        notes: existing.notes || '',
      }));
    } else {
      setPerfForm(f => ({ ...f, roomsAssigned: 0, departuresDone: 0, stayoversDone: 0, minutesWorked: 0, qualityScore: '', notes: '' }));
    }
  }, [perfForm.phoneId, perfEntries]);

  // ── Submit handlers ────────────────────────────────────────────────────────

  async function submitRoster(e: React.FormEvent) {
    e.preventDefault();
    setRosterError('');
    if (!rosterForm.name.trim()) { setRosterError('Name is required'); return; }
    setRosterSaving(true);
    try {
      const res = await fetch('/api/hsk/roster', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rosterForm),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      await loadRoster();
    } catch (e: any) { setRosterError(e.message); } finally { setRosterSaving(false); }
  }

  async function submitAssignment(phoneId: number) {
    setAssignSaving(true);
    try {
      const res = await fetch('/api/hsk/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: boardDate, phoneId,
          housekeeperName: assignForm.name || nameByPhone.get(phoneId) || `Phone ${phoneId}`,
          shift: assignForm.shift, startTime: assignForm.startTime,
          endTime: assignForm.endTime, notes: assignForm.notes,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setEditingPhone(null);
      await loadAssignments();
    } catch (e: any) {
      alert(e.message);
    } finally { setAssignSaving(false); }
  }

  async function deleteAssignment(id: number) {
    if (!confirm('Remove this assignment?')) return;
    await fetch(`/api/hsk/assignments?id=${id}`, { method: 'DELETE' });
    await loadAssignments();
  }

  async function submitPerf(e: React.FormEvent) {
    e.preventDefault();
    setPerfError(''); setPerfSuccess(false);
    const name = nameByPhone.get(perfForm.phoneId) || `Phone ${perfForm.phoneId}`;
    setPerfSaving(true);
    try {
      const res = await fetch('/api/hsk/performance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: perfDate,
          phoneId: perfForm.phoneId,
          housekeeperName: name,
          roomsAssigned: perfForm.roomsAssigned,
          departuresDone: perfForm.departuresDone,
          stayoversDone: perfForm.stayoversDone,
          minutesWorked: perfForm.minutesWorked,
          qualityScore: perfForm.qualityScore === '' ? null : Number(perfForm.qualityScore),
          notes: perfForm.notes,
          source: 'Manual',
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setPerfSuccess(true);
      setTimeout(() => setPerfSuccess(false), 2200);
      await loadPerformance();
    } catch (e: any) { setPerfError(e.message); } finally { setPerfSaving(false); }
  }

  async function deletePerf(id: number) {
    if (!confirm('Delete this performance entry?')) return;
    await fetch(`/api/hsk/performance?id=${id}`, { method: 'DELETE' });
    await loadPerformance();
  }

  // ── Derived stats ──────────────────────────────────────────────────────────

  const assignmentByPhone = useMemo(() => {
    const map = new Map<number, Assignment>();
    assignments.forEach(a => map.set(a.phoneId, a));
    return map;
  }, [assignments]);

  const todayKpi = useMemo(() => perfKpis.find(k => k.date === perfDate) ?? null, [perfKpis, perfDate]);

  const totalsForDate = useMemo(() => {
    const total = perfEntries.reduce((s, e) => ({
      roomsAssigned: s.roomsAssigned + (e.roomsAssigned || 0),
      roomsCleaned: s.roomsCleaned + (e.roomsCleaned || 0),
      minutes: s.minutes + (e.minutesWorked || 0),
      qualitySum: s.qualitySum + (e.qualityScore ?? 0),
      qualityCount: s.qualityCount + (e.qualityScore != null ? 1 : 0),
    }), { roomsAssigned: 0, roomsCleaned: 0, minutes: 0, qualitySum: 0, qualityCount: 0 });
    return {
      ...total,
      avgMins: total.roomsCleaned > 0 ? +(total.minutes / total.roomsCleaned).toFixed(1) : null,
      avgQuality: total.qualityCount > 0 ? +(total.qualitySum / total.qualityCount).toFixed(1) : null,
      roomsPerHour: total.minutes > 0 ? +((total.roomsCleaned * 60) / total.minutes).toFixed(2) : null,
    };
  }, [perfEntries]);

  // Phone slots 1..phoneCount
  const phoneSlots = Array.from({ length: phoneCount }, (_, i) => i + 1);

  return (
    <div className="page-wrap">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Housekeeping</h1>
          <p className="page-sub">Phone roster · Daily assignments · Performance tracking</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="tab-bar" role="tablist" aria-label="HSK sections">
        {([
          { id: 'board', label: "Today's Board" },
          { id: 'performance', label: 'Performance' },
          { id: 'roster', label: 'Phone Roster' },
        ] as const).map(t => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className="tab">
            {t.label}
          </button>
        ))}
      </div>

      {/* ── TODAY'S BOARD ──────────────────────────────────────────────────── */}
      {tab === 'board' && (
        <div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20 }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>Date:</span>
            <input type="date" value={boardDate} onChange={e => setBoardDate(e.target.value)}
              className="form-input" style={{ width: 'auto', padding: '6px 10px', fontSize: 13 }} />
            <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)' }}>
              {assignments.length} / {phoneCount} phones assigned
            </span>
            <button className="btn btn-ghost btn-sm" onClick={() => { loadAssignments(); loadRoomStatus(); }} style={{ padding: '5px 12px' }}>
              {boardLoading ? <Spinner /> : 'Refresh'}
            </button>
          </div>

          {/* ── ROOM STATUS BOARD ─────────────────────────────────────────── */}
          <div className="glass-card" style={{ marginBottom: 28, padding: '18px 20px' }}>
            {/* Header row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Room Status</span>

              {/* KPI chips */}
              {roomSummary && (
                <div style={{ display: 'flex', gap: 8, marginLeft: 4 }}>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, fontWeight: 700,
                    padding: '3px 10px', borderRadius: 20, background: 'var(--red-soft)', color: 'var(--red)' }}>
                    DEP {roomSummary.departures}
                  </span>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, fontWeight: 700,
                    padding: '3px 10px', borderRadius: 20, background: 'var(--blue-soft)', color: 'var(--blue)' }}>
                    STA {roomSummary.stayovers}
                  </span>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, fontWeight: 700,
                    padding: '3px 10px', borderRadius: 20, background: 'var(--hover-bg)', color: 'var(--text-muted)' }}>
                    {roomSummary.total} rooms
                  </span>
                </div>
              )}

              {/* View toggle */}
              {roomStatus.length > 0 && (
                <div style={{ display: 'flex', gap: 0, marginLeft: 'auto', borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border)' }}>
                  {(['status', 'floor'] as const).map(v => (
                    <button key={v} onClick={() => setRoomView(v)} style={{
                      padding: '5px 14px', fontSize: 11, fontWeight: 600, border: 'none', cursor: 'pointer',
                      background: roomView === v ? 'var(--red)' : 'transparent',
                      color: roomView === v ? '#fff' : 'var(--text-muted)',
                      fontFamily: 'JetBrains Mono, monospace', textTransform: 'capitalize',
                    }}>
                      {v === 'status' ? 'By Status' : 'By Floor'}
                    </button>
                  ))}
                </div>
              )}

              {/* Upload button */}
              <label style={{ cursor: roomUploading ? 'wait' : 'pointer' }}>
                <input type="file" accept=".txt" style={{ display: 'none' }} onChange={handleRoomUpload} disabled={roomUploading} />
                <span className="btn btn-ghost btn-sm" style={{ padding: '5px 12px', fontSize: 11, pointerEvents: 'none' }}>
                  {roomUploading ? <Spinner /> : '⬆ Upload TXT'}
                </span>
              </label>
            </div>

            {roomUploadMsg && (
              <div style={{
                marginBottom: 14, padding: '8px 12px', borderRadius: 6, fontSize: 12,
                background: roomUploadMsg.startsWith('✓') ? 'var(--green-soft)' : 'var(--red-soft)',
                color: roomUploadMsg.startsWith('✓') ? 'var(--green)' : 'var(--red)',
                fontFamily: 'JetBrains Mono, monospace',
              }}>
                {roomUploadMsg}
              </div>
            )}

            {roomStatus.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '28px 0', color: 'var(--text-muted)', fontSize: 13 }}>
                Upload the Opera HK All Status TXT to populate today&apos;s room board.
              </div>
            ) : (() => {
              // Group rooms
              const groups: { label: string; rooms: typeof roomStatus }[] = [];
              if (roomView === 'status') {
                const deps = roomStatus.filter(r => r.hskStatus === 'DEP' || r.hskStatus === 'OUT');
                const stas = roomStatus.filter(r => r.hskStatus === 'STA');
                if (deps.length) groups.push({ label: `Departures (${deps.length})`, rooms: deps });
                if (stas.length) groups.push({ label: `Stayovers (${stas.length})`, rooms: stas });
              } else {
                const floorMap = new Map<string, typeof roomStatus>();
                roomStatus.forEach(r => {
                  const f = r.floor.padStart(2, '0');
                  if (!floorMap.has(f)) floorMap.set(f, []);
                  floorMap.get(f)!.push(r);
                });
                [...floorMap.entries()].sort(([a],[b]) => a.localeCompare(b)).forEach(([floor, rooms]) => {
                  groups.push({ label: `Floor ${parseInt(floor)} (${rooms.length} rooms)`, rooms });
                });
              }

              return (
                <div>
                  {groups.map(group => (
                    <div key={group.label} style={{ marginBottom: 20 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase',
                        letterSpacing: '0.08em', fontFamily: 'JetBrains Mono, monospace', marginBottom: 8 }}>
                        {group.label}
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8 }}>
                        {group.rooms.map(room => {
                          const isDep = room.hskStatus === 'DEP' || room.hskStatus === 'OUT';
                          return (
                            <div key={room.room} style={{
                              padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)',
                              background: isDep ? 'var(--red-soft)' : 'var(--hover-bg)',
                              borderLeftWidth: 3,
                              borderLeftColor: isDep ? 'var(--red)' : 'var(--blue)',
                            }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
                                  {room.room}
                                </span>
                                <span style={{
                                  fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 3,
                                  background: isDep ? 'var(--red)' : 'var(--blue)',
                                  color: '#fff', fontFamily: 'JetBrains Mono, monospace',
                                }}>
                                  {isDep ? 'DEP' : 'STA'}
                                </span>
                              </div>
                              <div style={{ fontSize: 11, color: 'var(--text)', fontWeight: 500, marginBottom: 2,
                                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {room.guestName || '—'}
                              </div>
                              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
                                  {room.roomType}
                                </span>
                                {room.vip && (
                                  <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--gold)',
                                    fontFamily: 'JetBrains Mono, monospace' }}>
                                    ★ {room.vip}
                                  </span>
                                )}
                                <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
                                  {room.adults}A{room.children > 0 ? `+${room.children}C` : ''}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>

          {/* ── PHONE ASSIGNMENTS ─────────────────────────────────────────── */}

          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12,
          }}>
            {phoneSlots.map(phoneId => {
              const assignment = assignmentByPhone.get(phoneId);
              const rosterName = nameByPhone.get(phoneId);
              const isEditing = editingPhone === phoneId;
              const rosterEntry = roster.find(r => r.phoneId === phoneId);
              const isSupervisor = rosterEntry?.role === 'Supervisor';

              return (
                <div key={phoneId} className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
                  <div style={{
                    padding: '10px 14px',
                    background: assignment ? 'var(--green-soft)' : 'var(--hover-bg)',
                    borderBottom: '1px solid var(--border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{
                        fontFamily: 'JetBrains Mono, monospace', fontSize: 11, fontWeight: 700,
                        padding: '3px 8px', borderRadius: 4,
                        background: isSupervisor ? 'var(--blue-soft)' : 'var(--bg-sub)',
                        color: isSupervisor ? 'var(--blue)' : 'var(--text-muted)',
                      }}>
                        📱 {String(phoneId).padStart(2, '0')}
                      </span>
                      {isSupervisor && (
                        <span style={{ fontSize: 10, color: 'var(--blue)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                          Supervisor
                        </span>
                      )}
                    </div>
                    {assignment && !isEditing && (
                      <button className="btn btn-ghost btn-sm" onClick={() => deleteAssignment(assignment.id)}
                        style={{ padding: '2px 8px', fontSize: 11, color: 'var(--red)' }}>
                        Remove
                      </button>
                    )}
                  </div>

                  <div style={{ padding: 14 }}>
                    {isEditing ? (
                      <div>
                        <input className="form-input" placeholder="Housekeeper name"
                          value={assignForm.name || rosterName || ''}
                          onChange={e => setAssignForm(f => ({ ...f, name: e.target.value }))}
                          style={{ marginBottom: 8, fontSize: 13 }} />
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
                          <select className="form-input" value={assignForm.shift}
                            onChange={e => setAssignForm(f => ({ ...f, shift: e.target.value }))}
                            style={{ fontSize: 12, padding: '6px 8px' }}>
                            <option>AM</option><option>PM</option><option>Split</option><option>Night</option>
                          </select>
                          <input className="form-input" type="text" placeholder="Notes"
                            value={assignForm.notes}
                            onChange={e => setAssignForm(f => ({ ...f, notes: e.target.value }))}
                            style={{ fontSize: 12, padding: '6px 8px' }} />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 10 }}>
                          <input className="form-input" type="time" value={assignForm.startTime}
                            onChange={e => setAssignForm(f => ({ ...f, startTime: e.target.value }))}
                            style={{ fontSize: 12, padding: '6px 8px' }} />
                          <input className="form-input" type="time" value={assignForm.endTime}
                            onChange={e => setAssignForm(f => ({ ...f, endTime: e.target.value }))}
                            style={{ fontSize: 12, padding: '6px 8px' }} />
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-primary btn-sm" onClick={() => submitAssignment(phoneId)}
                            disabled={assignSaving} style={{ flex: 1, justifyContent: 'center' }}>
                            {assignSaving && <Spinner />}Save
                          </button>
                          <button className="btn btn-ghost btn-sm" onClick={() => setEditingPhone(null)}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : assignment ? (
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
                          {assignment.housekeeperName}
                        </div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4, flexWrap: 'wrap' }}>
                          <span style={{
                            fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 3,
                            background: 'var(--blue-soft)', color: 'var(--blue)',
                            fontFamily: 'JetBrains Mono, monospace',
                          }}>
                            {assignment.shift || 'AM'}
                          </span>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
                            {fmtTime(assignment.startTime)} – {fmtTime(assignment.endTime)}
                          </span>
                        </div>
                        {assignment.notes && (
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                            {assignment.notes}
                          </div>
                        )}
                        <button className="btn btn-ghost btn-sm" onClick={() => {
                          setAssignForm({
                            name: assignment.housekeeperName,
                            shift: assignment.shift || 'AM',
                            startTime: assignment.startTime || '08:00',
                            endTime: assignment.endTime || '16:00',
                            notes: assignment.notes || '',
                          });
                          setEditingPhone(phoneId);
                        }} style={{ marginTop: 8, fontSize: 11, padding: '3px 8px' }}>
                          Edit
                        </button>
                      </div>
                    ) : (
                      <div>
                        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>
                          {rosterName || 'Unassigned'}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-subtle)', marginBottom: 8 }}>
                          No assignment for today
                        </div>
                        <button className="btn btn-primary btn-sm" onClick={() => {
                          setAssignForm({
                            name: rosterName || '',
                            shift: isSupervisor ? 'AM' : 'AM',
                            startTime: '08:00', endTime: '16:00', notes: '',
                          });
                          setEditingPhone(phoneId);
                        }} style={{ width: '100%', justifyContent: 'center', fontSize: 11, padding: '5px 8px' }}>
                          + Assign
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── PERFORMANCE ────────────────────────────────────────────────────── */}
      {tab === 'performance' && (
        <div>
          {/* Window + date controls */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>Window:</span>
            {[7, 14, 30, 60, 90].map(d => (
              <button key={d} onClick={() => setPerfWindow(d)}
                className={`cat-btn${perfWindow === d ? ' active' : ''}`}>{d} days</button>
            ))}
            <span style={{ marginLeft: 16, fontSize: 12, color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>Date:</span>
            <input type="date" value={perfDate} onChange={e => setPerfDate(e.target.value)}
              className="form-input" style={{ width: 'auto', padding: '6px 10px', fontSize: 13 }} />
            <button className="btn btn-ghost btn-sm" onClick={loadPerformance} style={{ marginLeft: 'auto', padding: '5px 12px' }}>
              {perfLoading ? <Spinner /> : 'Refresh'}
            </button>
          </div>

          {/* KPI cards for selected date */}
          <div className="kpi-grid stagger-in" style={{ marginBottom: 20 }}>
            <div className="kpi-card kpi-blue">
              <div className="kpi-label">Rooms Cleaned</div>
              <div className="kpi-value">{totalsForDate.roomsCleaned}</div>
              <div className="kpi-trend">
                {totalsForDate.roomsAssigned > 0 ? `of ${totalsForDate.roomsAssigned} assigned` : `${perfEntries.length} entries`}
              </div>
            </div>
            <div className="kpi-card kpi-amber">
              <div className="kpi-label">Avg Mins / Room</div>
              <div className="kpi-value">{totalsForDate.avgMins !== null ? totalsForDate.avgMins : '—'}</div>
              <div className="kpi-trend">{Math.round(totalsForDate.minutes / 60)} hrs worked</div>
            </div>
            <div className="kpi-card kpi-green">
              <div className="kpi-label">Rooms / Hour</div>
              <div className="kpi-value">{totalsForDate.roomsPerHour !== null ? totalsForDate.roomsPerHour : '—'}</div>
              <div className="kpi-trend">team efficiency</div>
            </div>
            <div className="kpi-card kpi-red">
              <div className="kpi-label">Avg Quality</div>
              <div className="kpi-value">{totalsForDate.avgQuality !== null ? totalsForDate.avgQuality : '—'}</div>
              <div className="kpi-trend">out of 10</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 20, alignItems: 'start' }}>
            {/* Entry form */}
            <form onSubmit={submitPerf}>
              <div className="glass-card">
                <div className="card-header">
                  <span className="card-title">Log Performance — {fmtDate(perfDate)}</span>
                </div>
                <div className="card-body">
                  <div className="form-row">
                    <label className="form-label">Phone</label>
                    <select className="form-input" value={perfForm.phoneId}
                      onChange={e => setPerfForm(f => ({ ...f, phoneId: Number(e.target.value) }))}>
                      {phoneSlots.map(pid => (
                        <option key={pid} value={pid}>
                          📱 {String(pid).padStart(2, '0')} — {nameByPhone.get(pid) || '(unassigned)'}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div className="form-row">
                      <label className="form-label">Rooms Assigned</label>
                      <input className="form-input" type="number" min={0} max={50}
                        value={perfForm.roomsAssigned}
                        onChange={e => setPerfForm(f => ({ ...f, roomsAssigned: Number(e.target.value) || 0 }))}
                        style={{ fontFamily: 'JetBrains Mono, monospace' }} />
                    </div>
                    <div className="form-row">
                      <label className="form-label">Minutes Worked</label>
                      <input className="form-input" type="number" min={0} max={720}
                        value={perfForm.minutesWorked}
                        onChange={e => setPerfForm(f => ({ ...f, minutesWorked: Number(e.target.value) || 0 }))}
                        style={{ fontFamily: 'JetBrains Mono, monospace' }} />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div className="form-row">
                      <label className="form-label">Departures</label>
                      <input className="form-input" type="number" min={0} max={30}
                        value={perfForm.departuresDone}
                        onChange={e => setPerfForm(f => ({ ...f, departuresDone: Number(e.target.value) || 0 }))}
                        style={{ fontFamily: 'JetBrains Mono, monospace' }} />
                    </div>
                    <div className="form-row">
                      <label className="form-label">Stayovers</label>
                      <input className="form-input" type="number" min={0} max={30}
                        value={perfForm.stayoversDone}
                        onChange={e => setPerfForm(f => ({ ...f, stayoversDone: Number(e.target.value) || 0 }))}
                        style={{ fontFamily: 'JetBrains Mono, monospace' }} />
                    </div>
                  </div>
                  <div className="form-row">
                    <label className="form-label">Quality Score (0–10, optional)</label>
                    <input className="form-input" type="number" min={0} max={10} step={0.5}
                      value={perfForm.qualityScore}
                      onChange={e => setPerfForm(f => ({ ...f, qualityScore: e.target.value }))}
                      placeholder="e.g. 8.5"
                      style={{ fontFamily: 'JetBrains Mono, monospace' }} />
                  </div>
                  <div className="form-row">
                    <label className="form-label">Notes</label>
                    <input className="form-input" value={perfForm.notes}
                      onChange={e => setPerfForm(f => ({ ...f, notes: e.target.value }))}
                      placeholder="e.g. late start, extra deep cleans" />
                  </div>
                  {perfError && <div className="error-box" role="alert">{perfError}</div>}
                  {perfSuccess && (
                    <div role="status" style={{ background: 'var(--green-soft)', border: '1px solid rgba(34,197,94,.25)', borderRadius: 7, padding: '10px 14px', fontSize: 12, color: 'var(--green)', marginBottom: 12 }}>
                      ✓ Performance saved
                    </div>
                  )}
                  <button type="submit" className="btn btn-primary" disabled={perfSaving} style={{ width: '100%', justifyContent: 'center' }}>
                    {perfSaving && <Spinner />}{perfSaving ? 'Saving…' : 'Save Performance'}
                  </button>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 10, textAlign: 'center' }}>
                    Rooms cleaned = Departures + Stayovers. Re-entering for same date/phone updates.
                  </p>
                </div>
              </div>
            </form>

            {/* Entries table */}
            <div>
              <div className="table-wrap" style={{ marginBottom: 20 }}>
                <div className="card-header" style={{ background: 'var(--card-bg)', borderBottom: '1px solid var(--border)', padding: '14px 18px' }}>
                  <span className="card-title">Entries for {fmtDate(perfDate)}</span>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--text-muted)' }}>
                    {perfEntries.length} entries
                  </span>
                </div>
                {perfLoading ? (
                  <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}><Spinner /></div>
                ) : perfEntries.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-state-title">No entries yet</div>
                    <div className="empty-state-sub">Log performance for this date using the form</div>
                  </div>
                ) : (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Phone</th>
                        <th>Housekeeper</th>
                        <th className="text-right">Assigned</th>
                        <th className="text-right">Dep</th>
                        <th className="text-right">Stay</th>
                        <th className="text-right">Total</th>
                        <th className="text-right">Mins</th>
                        <th className="text-right">Min/Rm</th>
                        <th className="text-right">Quality</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {perfEntries.map(e => (
                        <tr key={e.id}>
                          <td className="mono" style={{ fontWeight: 600 }}>📱 {String(e.phoneId).padStart(2, '0')}</td>
                          <td style={{ fontSize: 12 }}>{e.housekeeperName}</td>
                          <td className="text-right mono">{e.roomsAssigned || '—'}</td>
                          <td className="text-right mono">{e.departuresDone || '—'}</td>
                          <td className="text-right mono">{e.stayoversDone || '—'}</td>
                          <td className="text-right mono" style={{ fontWeight: 600 }}>{e.roomsCleaned || '—'}</td>
                          <td className="text-right mono" style={{ color: 'var(--text-muted)' }}>{e.minutesWorked || '—'}</td>
                          <td className="text-right mono">{e.avgMinsPerRoom ?? '—'}</td>
                          <td className="text-right mono">
                            {e.qualityScore != null ? (
                              <span style={{
                                color: e.qualityScore >= 8 ? 'var(--green)' : e.qualityScore >= 6 ? 'var(--amber)' : 'var(--red)',
                                fontWeight: 600,
                              }}>{e.qualityScore}</span>
                            ) : '—'}
                          </td>
                          <td>
                            <button className="btn btn-ghost btn-sm" onClick={() => deletePerf(e.id)}
                              style={{ padding: '2px 8px', fontSize: 10, color: 'var(--red)' }}>
                              ✕
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Daily trend */}
              <div className="table-wrap">
                <div className="card-header" style={{ background: 'var(--card-bg)', borderBottom: '1px solid var(--border)', padding: '14px 18px' }}>
                  <span className="card-title">Daily trend — last {perfWindow} days</span>
                </div>
                {perfKpis.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-state-sub">No KPI history yet</div>
                  </div>
                ) : (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th className="text-right">Staff</th>
                        <th className="text-right">Rooms</th>
                        <th className="text-right">Occ%</th>
                        <th className="text-right">Min/Rm</th>
                        <th className="text-right">Rm/Hr</th>
                        <th className="text-right">Quality</th>
                      </tr>
                    </thead>
                    <tbody>
                      {perfKpis.map(k => (
                        <tr key={k.date} className={k.date === perfDate ? 'row-critical' : ''}>
                          <td style={{ fontWeight: 500 }}>{fmtDate(k.date)}</td>
                          <td className="text-right mono">{k.entries}</td>
                          <td className="text-right mono" style={{ fontWeight: 600 }}>{k.totalRoomsCleaned}</td>
                          <td className="text-right mono" style={{ color: 'var(--text-muted)' }}>
                            {k.occupancyPct !== null ? `${k.occupancyPct}%` : '—'}
                          </td>
                          <td className="text-right mono">{k.avgMinsPerRoom ?? '—'}</td>
                          <td className="text-right mono">{k.efficiency ?? '—'}</td>
                          <td className="text-right mono">
                            {k.avgQuality != null ? (
                              <span style={{
                                color: k.avgQuality >= 8 ? 'var(--green)' : k.avgQuality >= 6 ? 'var(--amber)' : 'var(--red)',
                                fontWeight: 600,
                              }}>{k.avgQuality}</span>
                            ) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── ROSTER ─────────────────────────────────────────────────────────── */}
      {tab === 'roster' && (
        <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 20, alignItems: 'start' }}>
          {/* Form */}
          <form onSubmit={submitRoster}>
            <div className="glass-card">
              <div className="card-header">
                <span className="card-title">Edit Phone Roster</span>
              </div>
              <div className="card-body">
                <div className="form-row">
                  <label className="form-label">Phone ID (1–{phoneCount})</label>
                  <select className="form-input" value={rosterForm.phoneId}
                    onChange={e => setRosterForm(f => ({ ...f, phoneId: Number(e.target.value) }))}>
                    {phoneSlots.map(pid => (
                      <option key={pid} value={pid}>📱 Phone {String(pid).padStart(2, '0')}</option>
                    ))}
                  </select>
                </div>
                <div className="form-row">
                  <label className="form-label">Name</label>
                  <input className="form-input" value={rosterForm.name}
                    onChange={e => setRosterForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Housekeeper name" />
                </div>
                <div className="form-row">
                  <label className="form-label">Role</label>
                  <select className="form-input" value={rosterForm.role}
                    onChange={e => setRosterForm(f => ({ ...f, role: e.target.value }))}>
                    <option>Housekeeper</option>
                    <option>Supervisor</option>
                    <option>Room Attendant</option>
                    <option>Public Area</option>
                    <option>Houseman</option>
                  </select>
                </div>
                <div className="form-row">
                  <label className="form-label">Active</label>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13, cursor: 'pointer' }}>
                      <input type="radio" checked={rosterForm.active} onChange={() => setRosterForm(f => ({ ...f, active: true }))} />
                      <span style={{ color: 'var(--green)', fontWeight: 500 }}>Active</span>
                    </label>
                    <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13, cursor: 'pointer' }}>
                      <input type="radio" checked={!rosterForm.active} onChange={() => setRosterForm(f => ({ ...f, active: false }))} />
                      <span style={{ color: 'var(--text-muted)' }}>Inactive</span>
                    </label>
                  </div>
                </div>
                <div className="form-row">
                  <label className="form-label">Notes</label>
                  <input className="form-input" value={rosterForm.notes}
                    onChange={e => setRosterForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder="Optional" />
                </div>
                {rosterError && <div className="error-box" role="alert">{rosterError}</div>}
                <button type="submit" className="btn btn-primary" disabled={rosterSaving}
                  style={{ width: '100%', justifyContent: 'center' }}>
                  {rosterSaving && <Spinner />}{rosterSaving ? 'Saving…' : 'Save to Roster'}
                </button>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 10, textAlign: 'center' }}>
                  Each phone ID (1–{phoneCount}) maps to one active housekeeper.
                </p>
              </div>
            </div>
          </form>

          {/* Roster table */}
          <div className="table-wrap">
            <div className="card-header" style={{ background: 'var(--card-bg)', borderBottom: '1px solid var(--border)', padding: '14px 18px' }}>
              <span className="card-title">Phone Roster</span>
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--text-muted)' }}>
                {roster.filter(r => r.active !== false).length} / {phoneCount} active
              </span>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Phone</th>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {phoneSlots.map(pid => {
                  const entry = roster.find(r => r.phoneId === pid);
                  return (
                    <tr key={pid}>
                      <td className="mono" style={{ fontWeight: 600 }}>📱 {String(pid).padStart(2, '0')}</td>
                      <td style={{ fontWeight: 500 }}>
                        {entry?.name || <span style={{ color: 'var(--text-subtle)' }}>—</span>}
                      </td>
                      <td>
                        {entry?.role ? (
                          <span style={{
                            display: 'inline-block', padding: '2px 7px', borderRadius: 4,
                            fontSize: 10, fontFamily: 'JetBrains Mono, monospace', fontWeight: 600,
                            textTransform: 'uppercase', letterSpacing: '0.06em',
                            background: entry.role === 'Supervisor' ? 'var(--blue-soft)' : 'var(--hover-bg)',
                            color: entry.role === 'Supervisor' ? 'var(--blue)' : 'var(--text-muted)',
                          }}>{entry.role}</span>
                        ) : <span style={{ color: 'var(--text-subtle)' }}>—</span>}
                      </td>
                      <td>
                        {entry ? (
                          <span style={{
                            fontSize: 11, fontWeight: 600,
                            color: entry.active !== false ? 'var(--green)' : 'var(--text-muted)',
                          }}>
                            {entry.active !== false ? '● Active' : '○ Inactive'}
                          </span>
                        ) : (
                          <span style={{ fontSize: 11, color: 'var(--text-subtle)' }}>unassigned</span>
                        )}
                      </td>
                      <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{entry?.notes || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
