import { NextResponse } from 'next/server';
import { applyStocktake } from '@/lib/sheets';

// ─── April 2026 Stocktake Quantities ─────────────────────────────────────────
// All items already have correct codes from /api/reseed.
// This endpoint just sets the physical stock count as-at April 2026.

const STOCKTAKE_APR_2026 = [
  // Vendor dispenser products
  { code: 'PS1001',       qty: 8  }, // Premium Toilet Roll 2Ply — 8 cartons
  { code: 'PS1008',       qty: 11 }, // Premium Facial Tissue Cube — 11 cartons
  { code: 'BW148430',     qty: 1  }, // Xpress® Multifold Hand Towel — 1 carton
  { code: 'BW2306898',    qty: 2  }, // Soft Mini Jumbo Toilet Roll — 2 cartons
  { code: 'BW520501',     qty: 0  }, // Mildly Scented Foam Soap — 0
  { code: 'SUSSTW140',    qty: 0  }, // Wooden Stirrer 140mm — 0
  // Bin liners
  { code: 'BZSINGLET/ME', qty: 15 }, // Ezytie Waste Bag White Medium — 15 cartons
  { code: 'BZ82EHD',      qty: 2  }, // Bin Liner EHD 80-82L — 2 cartons
  { code: 'BZ36BLK/R',    qty: 0  }, // Bin Liner Kitchen Tidy 36L — 0
  // Amenities (counted in cartons/boxes)
  { code: 'AM001',        qty: 20 }, // Shampoo — 20 cartons
  { code: 'AM003',        qty: 15 }, // Body Wash — 15 cartons
  { code: 'AM004',        qty: 30 }, // Soap Bars (Hand Wash) — 30 boxes
  // Beverages
  { code: 'C001',         qty: 180 }, // Coffee Capsules (Arabica) — 180 units
  { code: 'C002',         qty: 12 }, // Decaf Capsules — 12 boxes
  { code: 'C003',         qty: 30 }, // Green Tea — 30 packets
  { code: 'C004',         qty: 20 }, // Peppermint Tea — 20 packets
  { code: 'C005',         qty: 4  }, // Chamomile Tea — 4 packets
  { code: 'C006',         qty: 1  }, // English Breakfast Tea — 1 box
  { code: 'C008',         qty: 3  }, // Hot Chocolate — ~2.5 boxes → 3
  { code: 'C009',         qty: 5  }, // Brown Sugar — 5 packets
  { code: 'C010',         qty: 4  }, // White Sugar — 4 packets
  { code: 'C013',         qty: 5  }, // Anchor Milk Pods — 5 pcs
  // Assets
  { code: 'A002',         qty: 40 }, // Ironing Boards — 40 units
  { code: 'A004',         qty: 12 }, // Coffee Mugs — 12 cartons
];

export async function GET() {
  try {
    const { updated, notFound } = await applyStocktake(
      STOCKTAKE_APR_2026,
      'Apr 2026 Stocktake',
      'System',
    );

    return NextResponse.json({
      success: true,
      message: `Stocktake Apr 2026 — ${updated.length} items set, ${notFound.length} not found.`,
      updated,
      notFound,
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
