/**
 * POST /api/hsk/performance/import
 *
 * Accepts a HotelKit "Work Group Report" Excel (.xlsx) file upload.
 * Parses every row, aggregates per-staff-per-day metrics, and upserts
 * into the HSKPerformance Google Sheet.
 *
 * Aggregation rules:
 *   - Only rows where "Assigned to" matches "Housekeeping N" are processed.
 *   - Cleaning rows (Routine name = "Cleaning"):
 *       done = status IN {Cleaning done, Inspection pending, Inspection done,
 *                         Inspection in progress, Inspection paused, Rework needed}
 *       departuresDone  = done cleaning rows with type containing "Departure"
 *       stayoversDone   = done cleaning rows with type containing "Stayover"
 *       minutesWorked   = sum of Duration (parsed to minutes) for done cleaning rows
 *       creditsEarned   = sum of Credits for done cleaning rows
 *       failCount       = rows with status = "Failed"
 *       reworkCount     = sum of "Rework count" column across all rows
 *   - Inspection rows (Routine name = "Inspection"):
 *       inspectionsDone = rows with status = "Inspection done"
 *   - qualityScore computed as:
 *       roomsCleaned > 0  →  ((roomsCleaned - failCount - reworkCount) / roomsCleaned) * 100
 *       else null
 *   - roomsAssigned = all cleaning rows for that person on that day
 *   - Work day is an Excel date serial; converted to YYYY-MM-DD.
 */

import { saveHSKPerformance } from '@/lib/sheets';

// ─── helpers ─────────────────────────────────────────────────────────────────

/** Excel date serial (e.g. 46113) → "2026-04-01" */
function serialToDate(serial: number): string {
  const ms = Math.round((serial - 25569) * 86400 * 1000);
  return new Date(ms).toISOString().slice(0, 10);
}

/** "50min" | "1h 20min" | "0min" → minutes as integer */
function parseDuration(s: string): number {
  if (!s) return 0;
  let mins = 0;
  const h = s.match(/(\d+)h/);
  const m = s.match(/(\d+)min/);
  if (h) mins += parseInt(h[1]) * 60;
  if (m) mins += parseInt(m[1]);
  return mins;
}

const DONE_STATUSES = new Set([
  'Cleaning done',
  'Inspection pending',
  'Inspection done',
  'Inspection in progress',
  'Inspection paused',
  'Rework needed',
]);

// ─── POST ────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) {
      return Response.json({ error: 'No file provided' }, { status: 400 });
    }

    // Read file as ArrayBuffer then parse with xlsx (dynamic import for edge compat)
    const buffer = await file.arrayBuffer();
    const XLSX = await import('xlsx');
    const wb = XLSX.read(Buffer.from(buffer), { type: 'buffer' });

    const sheetName = wb.SheetNames[0];
    if (!sheetName) {
      return Response.json({ error: 'Excel file has no sheets' }, { status: 400 });
    }

    const ws = wb.Sheets[sheetName];
    // header:1 → array-of-arrays; defval:'' fills empty cells
    type XLRow = (string | number)[];
    const rows: XLRow[] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as XLRow[];

    if (rows.length < 2) {
      return Response.json({ error: 'File appears empty' }, { status: 400 });
    }

    // Map header names → column indexes
    const headers: string[] = (rows[0] as string[]).map(h => String(h).trim());
    const col = (name: string) => headers.indexOf(name);

    const iWorkDay   = col('Work day');
    const iRoom      = col('Room/Common area');
    const iRoutine   = col('Routine name');
    const iAssigned  = col('Assigned to');
    const iStatus    = col('Work status');
    const iCredits   = col('Credits');
    const iType      = col('Cleaning/Inspection type');
    const iRework    = col('Rework count');
    const iDuration  = col('Duration');

    if (iWorkDay === -1 || iAssigned === -1 || iStatus === -1) {
      return Response.json({
        error: `Missing required columns. Found: ${headers.slice(0, 10).join(', ')}`,
      }, { status: 400 });
    }

    // ─── Aggregate per (workDay serial, assignedTo) ──────────────────────────

    type StaffKey = string; // `${workDay}__${assignedTo}`
    interface Agg {
      workDay: number;
      assignedTo: string;
      phoneId: number;
      // cleaning
      totalCleaningRows: number;
      depsDone: number;
      staysDone: number;
      totalMins: number;
      credits: number;
      fails: number;
      reworks: number;
      // inspections
      inspDone: number;
    }

    const map = new Map<StaffKey, Agg>();

    for (const rawRow of rows.slice(1)) {
      const r = rawRow as XLRow;

      const workDay   = r[iWorkDay];
      const assignedTo = String(r[iAssigned] ?? '').trim();
      const routine   = String(r[iRoutine] ?? '').trim();
      const status    = String(r[iStatus]   ?? '').trim();
      const type      = String(r[iType]     ?? '').trim();
      const duration  = String(r[iDuration] ?? '').trim();
      const credits   = parseInt(String(r[iCredits] ?? '0')) || 0;
      const rework    = parseInt(String(r[iRework]  ?? '0')) || 0;

      // Only process "Housekeeping N" staff
      if (!assignedTo || !/^Housekeeping \d+$/.test(assignedTo)) continue;
      if (typeof workDay !== 'number' || workDay < 40000) continue; // not a valid Excel date

      const phoneId = parseInt(assignedTo.replace('Housekeeping ', ''));
      const key: StaffKey = `${workDay}__${assignedTo}`;

      if (!map.has(key)) {
        map.set(key, {
          workDay, assignedTo, phoneId,
          totalCleaningRows: 0,
          depsDone: 0, staysDone: 0, totalMins: 0, credits: 0,
          fails: 0, reworks: 0,
          inspDone: 0,
        });
      }
      const agg = map.get(key)!;

      if (routine === 'Cleaning') {
        agg.totalCleaningRows++;
        if (status === 'Failed') agg.fails++;
        agg.reworks += rework;
        if (DONE_STATUSES.has(status)) {
          if (type.includes('Departure')) agg.depsDone++;
          else if (type.includes('Stayover')) agg.staysDone++;
          agg.totalMins += parseDuration(duration);
          agg.credits += credits;
        }
      } else if (routine === 'Inspection') {
        if (status === 'Inspection done') agg.inspDone++;
      }
    }

    if (map.size === 0) {
      return Response.json({ error: 'No Housekeeping staff rows found in file' }, { status: 400 });
    }

    // ─── Upsert each aggregated entry into Google Sheets ────────────────────

    const results: Array<{ date: string; phoneId: number; name: string; ok: boolean; error?: string }> = [];

    for (const agg of map.values()) {
      const date = serialToDate(agg.workDay);
      const roomsCleaned = agg.depsDone + agg.staysDone;
      const qualityScore = roomsCleaned > 0
        ? +((((roomsCleaned - agg.fails - agg.reworks) / roomsCleaned) * 100).toFixed(1))
        : null;

      try {
        await saveHSKPerformance({
          date,
          phoneId: agg.phoneId,
          housekeeperName: agg.assignedTo,
          roomsAssigned: agg.totalCleaningRows,
          departuresDone: agg.depsDone,
          stayoversDone: agg.staysDone,
          minutesWorked: agg.totalMins,
          qualityScore,
          failCount: agg.fails,
          reworkCount: agg.reworks,
          creditsEarned: agg.credits,
          inspectionsDone: agg.inspDone,
          source: 'HotelKit',
        });
        results.push({ date, phoneId: agg.phoneId, name: agg.assignedTo, ok: true });
      } catch (err) {
        results.push({
          date, phoneId: agg.phoneId, name: agg.assignedTo, ok: false,
          error: err instanceof Error ? err.message : 'Save failed',
        });
      }
    }

    const saved = results.filter(r => r.ok).length;
    const failed = results.filter(r => !r.ok);
    const uniqueDates = [...new Set(results.map(r => r.date))].sort();

    return Response.json({
      success: true,
      message: `Imported ${saved} staff-day records across ${uniqueDates.length} day(s)`,
      saved,
      failed: failed.length,
      dates: uniqueDates,
      errors: failed.length > 0 ? failed : undefined,
    });
  } catch (err) {
    console.error('HotelKit import error:', err);
    return Response.json(
      { error: err instanceof Error ? err.message : 'Import failed' },
      { status: 500 }
    );
  }
}
