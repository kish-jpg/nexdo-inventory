import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { pin } = await req.json();
    if (!pin) return NextResponse.json({ error: 'PIN required' }, { status: 400 });

    const adminPin    = process.env.ADMIN_PIN;
    const nexdoPin    = process.env.NEXDO_PIN;
    const radissonPin = process.env.RADISSON_PIN;

    if (!adminPin || !nexdoPin || !radissonPin) {
      return NextResponse.json({ error: 'Auth not configured — set ADMIN_PIN, NEXDO_PIN, RADISSON_PIN in environment.' }, { status: 500 });
    }

    if (pin === adminPin)    return NextResponse.json({ role: 'admin' });
    if (pin === nexdoPin)    return NextResponse.json({ role: 'nexdo' });
    if (pin === radissonPin) return NextResponse.json({ role: 'radisson' });

    return NextResponse.json({ error: 'Incorrect PIN' }, { status: 401 });
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }
}
