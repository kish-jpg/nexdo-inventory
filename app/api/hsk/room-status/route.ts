/**
 * GET  /api/hsk/room-status?date=YYYY-MM-DD  → fetch room list for a date
 * POST /api/hsk/room-status                  → upload & parse Opera HK All Status TXT
 */

import { getHSKRoomStatusForDate, saveHSKRoomStatusForDate } from '@/lib/sheets';
import type { HSKRoomStatusEntry } from '@/lib/sheets';

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get('date') ?? new Date().toISOString().slice(0, 10);
    const fresh = searchParams.get('fresh') === '1';

    if (fresh) {
      const { invalidateCache } = await import('@/lib/sheets');
      invalidateCache();
    }

    const rooms = await getHSKRoomStatusForDate(date);

    const deps = rooms.filter(r => r.hskStatus === 'DEP' || r.hskStatus === 'OUT');
    const stas = rooms.filter(r => r.hskStatus === 'STA');

    return Response.json({
      date,
      rooms,
      summary: {
        total: rooms.length,
        departures: deps.length,
        stayovers: stas.length,
      },
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('Room status GET error:', err);
    return Response.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 });
  }
}

// ─── POST (upload TXT) ────────────────────────────────────────────────────────

/**
 * Parse Opera "HK All Status" tab-delimited TXT export.
 * The file has a header row, data rows, then a summary footer row starting with BAL_REP.
 * Key columns used: ROOM, RESV_STATUS, GUEST_NAME, ARRIVAL, DEPARTURE, NIGHTS,
 *                   ADULTS, CHILDREN, ROOM_CATEGORY_LABEL, VIP, COMPANY_NAME
 */
export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const dateParam = formData.get('date') as string | null;

    if (!file) return Response.json({ error: 'No file provided' }, { status: 400 });

    const text = await file.text();
    const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');

    // First non-empty line is the header
    const headerLine = lines.find(l => l.trim().startsWith('FLOOR_WO_BREAK') || l.trim().startsWith('ROOM'));
    if (!headerLine) {
      return Response.json({ error: 'Cannot find header row in file' }, { status: 400 });
    }

    const headers = headerLine.split('\t').map(h => h.trim());
    const col = (name: string) => headers.indexOf(name);

    const iROOM       = col('ROOM');
    const iSTATUS     = col('RESV_STATUS');
    const iGUEST      = col('GUEST_NAME');
    const iARRIVAL    = col('ARRIVAL');
    const iDEPARTURE  = col('DEPARTURE');
    const iNIGHTS     = col('NIGHTS');
    const iADULTS     = col('ADULTS');
    const iCHILDREN   = col('CHILDREN');
    const iROOM_TYPE  = col('ROOM_CATEGORY_LABEL');
    const iVIP        = col('VIP');
    const iCOMPANY    = col('COMPANY_NAME');

    if (iROOM === -1 || iSTATUS === -1) {
      return Response.json(
        { error: `Missing required columns. Found: ${headers.slice(0, 10).join(', ')}` },
        { status: 400 }
      );
    }

    // Determine report date from the data (most common arrival/departure date)
    // or use dateParam if provided
    const parsedRooms: Omit<HSKRoomStatusEntry, 'id' | 'timestamp'>[] = [];
    const seenRooms = new Set<string>();

    for (const line of lines) {
      const parts = line.split('\t').map(p => p.trim());
      if (parts.length < 5) continue;

      const room = parts[iROOM] ?? '';
      if (!room || !/^\d{4}$/.test(room)) continue; // must be 4-digit room number
      if (seenRooms.has(room)) continue; // deduplicate (some rooms appear twice for shared reservations)
      seenRooms.add(room);

      // Skip footer rows
      const rawStatus = parts[iSTATUS] ?? '';
      if (!rawStatus || rawStatus === 'RESV_STATUS') continue;

      // Map Opera status → HSK status
      let hskStatus: 'DEP' | 'STA' | 'OUT';
      if (rawStatus === 'CHECKED OUT') {
        hskStatus = 'OUT';
      } else if (rawStatus === 'DUE OUT') {
        hskStatus = 'DEP';
      } else {
        hskStatus = 'STA'; // CHECKED IN = stayover
      }

      const floor = room.slice(0, 2).replace(/^0/, ''); // "07" → "7", "14" → "14"

      // Normalise Opera date format DD-MM-YY or DD-MMM-YY → YYYY-MM-DD
      const parseOperaDate = (raw: string): string => {
        if (!raw) return '';
        // Format: 20-04-26 or 20-APR-26
        const months: Record<string, string> = {
          JAN:'01',FEB:'02',MAR:'03',APR:'04',MAY:'05',JUN:'06',
          JUL:'07',AUG:'08',SEP:'09',OCT:'10',NOV:'11',DEC:'12',
        };
        const parts = raw.split('-');
        if (parts.length !== 3) return raw;
        const [d, m, y] = parts;
        const month = months[m.toUpperCase()] ?? m.padStart(2,'0');
        const year = y.length === 2 ? '20' + y : y;
        return `${year}-${month}-${d.padStart(2,'0')}`;
      };

      parsedRooms.push({
        date: '', // filled below
        room,
        floor,
        hskStatus,
        guestName: (parts[iGUEST] ?? '').replace(/\s+/g, ' ').trim(),
        roomType: parts[iROOM_TYPE] ?? '',
        adults: parseInt(parts[iADULTS] ?? '0') || 0,
        children: parseInt(parts[iCHILDREN] ?? '0') || 0,
        arrival: parseOperaDate(parts[iARRIVAL] ?? ''),
        departure: parseOperaDate(parts[iDEPARTURE] ?? ''),
        nights: parseInt(parts[iNIGHTS] ?? '0') || 0,
        vip: parts[iVIP] ?? '',
        company: parts[iCOMPANY] ?? '',
        resvStatus: rawStatus,
        source: 'Opera-HKStatus',
      });
    }

    if (parsedRooms.length === 0) {
      return Response.json({ error: 'No room data found in file' }, { status: 400 });
    }

    // Determine report date: use param, or today
    const reportDate = dateParam ?? new Date().toISOString().slice(0, 10);
    const roomsWithDate = parsedRooms.map(r => ({ ...r, date: reportDate }));

    const saved = await saveHSKRoomStatusForDate(reportDate, roomsWithDate);

    const deps = roomsWithDate.filter(r => r.hskStatus === 'DEP').length;
    const outs = roomsWithDate.filter(r => r.hskStatus === 'OUT').length;
    const stas = roomsWithDate.filter(r => r.hskStatus === 'STA').length;

    return Response.json({
      success: true,
      message: `Loaded ${saved} rooms for ${reportDate}`,
      date: reportDate,
      summary: { total: saved, departures: deps + outs, stayovers: stas },
    });
  } catch (err) {
    console.error('Room status upload error:', err);
    return Response.json({ error: err instanceof Error ? err.message : 'Upload failed' }, { status: 500 });
  }
}
