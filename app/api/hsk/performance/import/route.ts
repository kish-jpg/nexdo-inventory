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

import ExcelJS from 'exceljs';
import { saveHSKPerformance } from '@/lib/sheets';

// ─── helpers ─────────────────────────────────────────────────────────────────

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

/** Safely extract a cell value as string */
function cellStr(cell: ExcelJS.Cell): string {
  const v = cell?.value;
  if (v === null || v === undefined) return '';
  if (typeof v === 'object' && 'richText' in (v as object)) {
    return (v as ExcelJS.CellRichTextValue).richText.map(r => r.text).join('');
  }
  return String(v).trim();
}

/** Safely extract a cell value as number */
function cellNum(cell: ExcelJS.Cell): number {
  const v = cell?.value;
  if (v === null || v === undefined) return 0;
  if (v instanceof Date) return 0; // dates handled by cellDate
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return isNaN(n) ? 0 : n;
}

/**
 * Extract a YYYY-MM-DD date string from a Work day cell.
 * exceljs returns Date objects for date-formatted cells.
 * Falls back to serial-number conversion for legacy files.
 */
function cellDate(cell: ExcelJS.Cell): string | null {
  const v = cell?.value;
  if (v === null || v === undefined) return null;
  if (v instanceof Date) {
    // exceljs Date objects are in UTC; slice to YYYY-MM-DD
    return v.toISOString().slice(0, 10);
  }
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  if (!isNaN(n) && n > 40000) {
    // Excel serial to date
    return new Date(Math.round((n - 25569) * 86400 * 1000)).toISOString().slice(0, 10);
  }
  return null;
}

const DONE_STATUSES = new Set([
  'Cleaning done',
  'Inspection pending',
  'Inspection done',
  'Inspection in progress',
  'Inspection paused',
  'Rework needed',
]);

// ─── Column index map (built from header row) ────────────────────────────────

type ColMap = Record<string, number>;

function buildColMap(headerRow: ExcelJS.Row): ColMap {
  const map: ColMap = {};
  headerRow.eachCell((cell, colNumber) => {
    const key = cellStr(cell);
    if (key) map[key] = colNumber;
  });
  return map;
}

// ─── POST ────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) {
      return Response.json({ error: 'No file provided' }, { status: 400 });
    }

    const arrayBuf = await file.arrayBuffer();
    const wb = new ExcelJS.Workbook();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await wb.xlsx.load(Buffer.from(arrayBuf) as any);

    const ws = wb.worksheets[0];
    if (!ws) {
      return Response.json({ error: 'Excel file has no sheets' }, { status: 400 });
    }

    // First row is the header
    const headerRow = ws.getRow(1);
    const cols = buildColMap(headerRow);

    const iWorkDay  = cols['Work day'];
    const iRoutine  = cols['Routine name'];
    const iAssigned = cols['Assigned to'];
    const iStatus   = cols['Work status'];
    const iCredits  = cols['Credits'];
    const iType     = cols['Cleaning/Inspection type'];
    const iRework   = cols['Rework count'];
    const iDuration = cols['Duration'];

    if (!iWorkDay || !iAssigned || !iStatus) {
      const found = Object.keys(cols).slice(0, 10).join(', ');
      return Response.json(
        { error: `Missing required columns. Found: ${found}` },
        { status: 400 }
      );
    }

    // ─── Aggregate per (workDay serial, assignedTo) ──────────────────────────

    type StaffKey = string; // `${date}__${assignedTo}`
    interface Agg {
      date: string;
      assignedTo: string;
      phoneId: number;
      totalCleaningRows: number;
      depsDone: number;
      staysDone: number;
      totalMins: number;
      credits: number;
      fails: number;
      reworks: number;
      inspDone: number;
    }

    const map = new Map<StaffKey, Agg>();

    ws.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // skip header

      const date       = cellDate(row.getCell(iWorkDay));
      const assignedTo = cellStr(row.getCell(iAssigned));
      const routine    = cellStr(row.getCell(iRoutine));
      const status     = cellStr(row.getCell(iStatus));
      const type       = cellStr(row.getCell(iType));
      const duration   = cellStr(row.getCell(iDuration));
      const credits    = cellNum(row.getCell(iCredits));
      const rework     = cellNum(row.getCell(iRework));

      // Only process "Housekeeping N" staff on a valid date
      if (!date) return;
      if (!assignedTo || !/^Housekeeping \d+$/.test(assignedTo)) return;

      const phoneId = parseInt(assignedTo.replace('Housekeeping ', ''));
      const key: StaffKey = `${date}__${assignedTo}`;

      if (!map.has(key)) {
        map.set(key, {
          date, assignedTo, phoneId,
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
    });

    if (map.size === 0) {
      return Response.json({ error: 'No Housekeeping staff rows found in file' }, { status: 400 });
    }

    // ─── Upsert each aggregated entry into Google Sheets ────────────────────

    const results: Array<{ date: string; phoneId: number; name: string; ok: boolean; error?: string }> = [];

    for (const agg of map.values()) {
      const date = agg.date;
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
