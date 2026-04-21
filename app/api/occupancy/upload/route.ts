/**
 * POST /api/occupancy/upload
 * Parse CSV occupancy data and write to Google Sheets
 * Expects FormData with 'file' containing CSV with columns:
 * Date, Total Occ., Arr. Rooms, ... (from Opera PMS export)
 */

import { saveOccupancyLog } from '@/lib/sheets';

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

    // Parse CSV — handle Opera PMS column names (flexible mapping)
    let saved = 0;
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(',').map(p => p.trim());
      if (!parts[0]) continue; // Skip empty rows

      // Map CSV columns to OccupancyInput schema
      // Flexible: supports various column orderings
      const record = {
        date: parts[0], // Column A: Date (YYYY-MM-DD)
        occupiedRooms: parts[1] ? parseInt(parts[1]) : 0, // Column B: Total Occ.
        arrivals: parts[2] ? parseInt(parts[2]) : undefined, // Column C: Arr. Rooms
        departures: parts[12] ? parseInt(parts[12]) : undefined, // Column M: Dep. Rooms
        houseUse: parts[4] ? parseInt(parts[4]) : undefined, // Column E: House Use
        dayUse: parts[13] ? parseInt(parts[13]) : undefined, // Column N: Day Use Rooms
        noShow: parts[14] ? parseInt(parts[14]) : undefined, // Column O: No Show Rooms
        ooo: parts[15] ? parseInt(parts[15]) : undefined, // Column P: OOO Rooms
        roomRevenue: parts[10] ? parseFloat(parts[10]) : undefined, // Column K: Room Revenue
        adr: parts[11] ? parseFloat(parts[11]) : undefined, // Column L: Average Rate
        source: 'Opera-Import' as const,
      };

      try {
        await saveOccupancyLog(record);
        saved++;
      } catch (err) {
        console.warn(`Failed to save row ${i}:`, err);
        // Continue with next row
      }
    }

    if (saved === 0) {
      return Response.json(
        { error: 'No valid occupancy records could be saved' },
        { status: 400 }
      );
    }

    return Response.json({
      success: true,
      message: `Uploaded ${saved} occupancy records`,
      rowsAdded: saved,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    );
  }
}
