/**
 * POST /api/occupancy/upload
 * Parse CSV occupancy data and batch-write to Google Sheets
 * Expects FormData with 'file' containing CSV
 */

import { appendOccupancyRows } from '@/lib/sheets';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return Response.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    const text = await file.text();
    const lines = text.split('\n').filter(l => l.trim());

    if (lines.length < 2) {
      return Response.json(
        { error: 'CSV must contain at least header and one data row' },
        { status: 400 }
      );
    }

    // Skip header row, parse data rows
    const rows: (string | number | null)[][] = [];
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(',').map(p => p.trim());
      if (parts.length < 17) continue; // Must have all columns

      // Parse values, keeping nulls for empty cells
      const row = [
        parts[0],  // date
        parts[1] ? parseInt(parts[1]) : null,  // totalOcc
        parts[2] ? parseInt(parts[2]) : null,  // arrRooms
        parts[3] ? parseInt(parts[3]) : null,  // compRooms
        parts[4] ? parseInt(parts[4]) : null,  // houseUse
        parts[5] ? parseInt(parts[5]) : null,  // deductIndiv
        parts[6] ? parseInt(parts[6]) : null,  // nonDedIndiv
        parts[7] ? parseInt(parts[7]) : null,  // deductGroup
        parts[8] ? parseInt(parts[8]) : null,  // nonDedGroup
        parts[9] ? parseFloat(parts[9].replace('%', '')) : null,  // occPercent
        parts[10] ? parseFloat(parts[10]) : null,  // roomRevenue
        parts[11] ? parseFloat(parts[11]) : null,  // avgRate
        parts[12] ? parseInt(parts[12]) : null,  // depRooms
        parts[13] ? parseInt(parts[13]) : null,  // dayUseRooms
        parts[14] ? parseInt(parts[14]) : null,  // noShowRooms
        parts[15] ? parseInt(parts[15]) : null,  // oooRooms
        parts[16] ? parseInt(parts[16]) : null,  // adlChildren
      ];

      rows.push(row);
    }

    if (rows.length === 0) {
      return Response.json(
        { error: 'No valid data rows found in CSV' },
        { status: 400 }
      );
    }

    // Batch write to Sheets
    await appendOccupancyRows(rows);

    return Response.json({
      success: true,
      message: `Uploaded ${rows.length} occupancy records`,
      rowsAdded: rows.length,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    );
  }
}
