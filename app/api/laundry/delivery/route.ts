import { NextRequest, NextResponse } from 'next/server';
import { getSincerityDeliveries, saveSincerityDelivery, initLaundrySheets } from '@/lib/sheets';

export async function GET() {
  try {
    await initLaundrySheets();
    const deliveries = await getSincerityDeliveries(60);
    return NextResponse.json({ deliveries });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await initLaundrySheets();
    const body = await req.json();
    const delivery = await saveSincerityDelivery({
      date:            body.date            ?? new Date().toISOString().slice(0, 10),
      kingSheets:      Number(body.kingSheets)      || 0,
      singleSheets:    Number(body.singleSheets)    || 0,
      pillowSlipsMed:  Number(body.pillowSlipsMed)  || 0,
      pillowSlipsLarge: Number(body.pillowSlipsLarge) || 0,
      bathTowels:      Number(body.bathTowels)      || 0,
      handTowels:      Number(body.handTowels)      || 0,
      faceTowels:      Number(body.faceTowels)      || 0,
      bathMats:        Number(body.bathMats)        || 0,
      duvets:          Number(body.duvets)          || 0,
      notes:           body.notes ?? '',
    });
    return NextResponse.json({ delivery });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
