/**
 * POST /api/occupancy/upload
 * Parse CSV and batch-write all rows to Google Sheets in ONE API call.
 */

import { batchSaveOccupancyLogs, getOccupancyLogs, invalidateCache, initOccupancySheet } from '@/lib/sheets';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return Response.json({ error: 'No file provided' }, { status: 400 });
    }

    // Ensure sheet exists with correct headers
    await initOccupancySheet();

    const text = await file.text();
    const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim());

    if (lines.length < 2) {
      return Response.json(
        { error: 'CSV must contain at least a header row and one data row' },
        { status: 400 }
      );
    }

    const parseNum = (v: string | undefined) => {
      if (!v || v === '') return undefined;
      const n = parseFloat(v.replace('%', ''));
      return isNaN(n) ? undefined : n;
    };

    const records = [];
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(',').map(p => p.trim().replace(/^"|"$/g, ''));
      if (!parts[0] || parts[0].toLowerCase() === 'date') continue;

      records.push({
        date:         parts[0],
        occupiedRooms: parseInt(parts[1]) || 0,
        arrivals:     parseNum(parts[2]),
        houseUse:     parseNum(parts[4]),
        roomRevenue:  parseNum(parts[10]),
        adr:          parseNum(parts[11]),
        departures:   parseNum(parts[12]),
        dayUse:       parseNum(parts[13]),
        noShow:       parseNum(parts[14]),
        ooo:          parseNum(parts[15]),
        source:       'Opera-Import' as const,
      });
    }

    if (records.length === 0) {
      return Response.json({ error: 'No valid rows found in CSV' }, { status: 400 });
    }

    // Batch write — single API call
    const saved = await batchSaveOccupancyLogs(records);

    // Verify: read sheet back fresh to confirm actual row count
    invalidateCache();
    const verification = await getOccupancyLogs(365);

    return Response.json({
      success: true,
      message: `Uploaded ${saved} occupancy records`,
      rowsAdded: saved,
      rowsParsed: records.length,
      skipped: records.length - saved,
      // Debug: what does the sheet actually contain now?
      sheetRowCount: verification.length,
      sheetDates: verification.slice(0, 5).map(r => r.date),
    });
  } catch (error) {
    console.error('Upload error:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    );
  }
}
