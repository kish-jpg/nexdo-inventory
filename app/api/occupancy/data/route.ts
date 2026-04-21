/**
 * GET /api/occupancy/data
 * Fetch occupancy data, optionally filtered by date range
 * Query params: ?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 */

import { getOccupancy, getOccupancySummary } from '@/lib/sheets';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    let data;
    if (startDate && endDate) {
      data = await getOccupancy({ start: startDate, end: endDate });
    } else {
      data = await getOccupancy();
    }

    const summary = await getOccupancySummary();

    return Response.json({
      data,
      summary,
      count: data.length,
    });
  } catch (error) {
    console.error('Occupancy data fetch error:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch data' },
      { status: 500 }
    );
  }
}
