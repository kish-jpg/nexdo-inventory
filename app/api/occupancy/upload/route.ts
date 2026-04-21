/**
 * POST /api/occupancy/upload
 * Parse CSV and batch-write all rows to Google Sheets in ONE API call.
 * Columns: Date, Total Occ., Arr. Rooms, Comp. Rooms, House Use,
 *          Deduct Indiv., Non-Ded. Indiv., Deduct Group, Non-Ded. Group,
 *          Occ.%, Room Revenue, Average Rate, Dep. Rooms, Day Use Rooms,
 *          No Show Rooms, OOO Rooms, Adl. & Chl.
 */

import { batchSaveOccupancyLogs } from '@/lib/sheets';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return Response.json({ error: 'No file provided' }, { status: 400 });
    }

    const text = await file.text();
    // Handle both \r\n (Windows) and \n line endings
    const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim());

    if (lines.length < 2) {
      return Response.json(
        { error: 'CSV must contain at least a header row and one data row' },
        { status: 400 }
      );
    }

    // Parse every data row (skip header line[0])
    const records = [];
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(',').map(p => p.trim().replace(/^"|"$/g, ''));
      if (!parts[0] || parts[0].toLowerCase() === 'date') continue; // skip empty / extra headers

      // Strip trailing % from Occ.% column (col 9) if present
      const parseNum = (v: string | undefined) => {
        if (!v || v === '') return undefined;
        const n = parseFloat(v.replace('%', ''));
        return isNaN(n) ? undefined : n;
      };

      records.push({
        date:         parts[0],                        // Col A: Date
        occupiedRooms: parseInt(parts[1]) || 0,        // Col B: Total Occ.
        arrivals:     parseNum(parts[2]),              // Col C: Arr. Rooms
        // Col D: Comp. Rooms (ignored)
        houseUse:     parseNum(parts[4]),              // Col E: House Use
        // Cols F-I: deduct/non-ded groups (ignored for now)
        // Col J: Occ.% (ignored — we recompute from occupiedRooms/322)
        roomRevenue:  parseNum(parts[10]),             // Col K: Room Revenue
        adr:          parseNum(parts[11]),             // Col L: Average Rate
        departures:   parseNum(parts[12]),             // Col M: Dep. Rooms
        dayUse:       parseNum(parts[13]),             // Col N: Day Use Rooms
        noShow:       parseNum(parts[14]),             // Col O: No Show Rooms
        ooo:          parseNum(parts[15]),             // Col P: OOO Rooms
        source:       'Opera-Import' as const,
      });
    }

    if (records.length === 0) {
      return Response.json({ error: 'No valid rows found in CSV' }, { status: 400 });
    }

    // Single batch write — all rows in one Sheets API call
    const saved = await batchSaveOccupancyLogs(records);

    return Response.json({
      success: true,
      message: `Uploaded ${saved} occupancy records`,
      rowsAdded: saved,
      rowsParsed: records.length,
      skipped: records.length - saved,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    );
  }
}
