/**
 * GET /api/occupancy/data
 * Fetch occupancy logs (last 90 days by default)
 * Query params:
 *   ?limit=30    (default 90, max 365)
 *   ?fresh=1     (bypass module-level cache — use after upload)
 */

import { getOccupancyLogs, invalidateCache } from '@/lib/sheets';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const limitStr = searchParams.get('limit');
    const limit = limitStr ? Math.min(parseInt(limitStr), 365) : 90;

    // If caller passes ?fresh=1, bust the in-process cache first
    if (searchParams.get('fresh') === '1') {
      invalidateCache();
    }

    const logs = await getOccupancyLogs(limit);

    // Compute summary stats
    const summary = logs.length === 0
      ? { latestDate: '', avgOccupancyPct: 0, avgRevenue: 0, avgRate: 0, totalDays: 0 }
      : {
          latestDate: logs[0]?.date || '',
          avgOccupancyPct: Math.round(logs.reduce((s, o) => s + o.occupancyPct, 0) / logs.length),
          avgRevenue: Math.round((logs.reduce((s, o) => s + (o.roomRevenue ?? 0), 0) / logs.length) * 100) / 100,
          avgRate: Math.round((logs.reduce((s, o) => s + (o.adr ?? 0), 0) / logs.length) * 100) / 100,
          totalDays: logs.length,
        };

    return Response.json(
      { data: logs, summary, count: logs.length },
      // Tell Vercel's edge cache not to cache this response
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    console.error('Occupancy data fetch error:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch data' },
      { status: 500 }
    );
  }
}
