import { NextResponse } from 'next/server';
import { initSheets, clearAllData, computeStatus, batchSeed } from '@/lib/sheets';

// NOTE: Cleaning liquids and commercial vacuums removed — now tracked in /nexdo (NexDo Inventory)
// Last updated: Apr 2026 — Astro items added (bedding, amenity kits, equipment), supplier fields populated
const CATEGORIES = ['Linens', 'Consumables', 'Amenities', 'Assets'];

const ITEMS = [
  // ── LINENS - Bedding ─────────────────────────────────────────────────────────
  { code: 'L001',             name: 'Duvet Covers',                          cat: 'Linens',       sub: 'Bedding',       unit: 'Each',     stock: 180, target: 88,   reorderPt: 88,   reorderQty: 50,  supplier: 'Astro'    },
  { code: 'L002',             name: 'King Sheets',                           cat: 'Linens',       sub: 'Bedding',       unit: 'Each',     stock: 280, target: 154,  reorderPt: 154,  reorderQty: 70,  supplier: 'Sincerity' },
  { code: 'L003',             name: 'Single Sheets',                         cat: 'Linens',       sub: 'Bedding',       unit: 'Each',     stock: 200, target: 110,  reorderPt: 110,  reorderQty: 50,  supplier: 'Sincerity' },
  { code: 'L004',             name: 'Pillow Slips (Medium)',                  cat: 'Linens',       sub: 'Bedding',       unit: 'Each',     stock: 260, target: 132,  reorderPt: 132,  reorderQty: 60,  supplier: 'Sincerity' },
  { code: 'L005',             name: 'Pillow Slips (Large)',                   cat: 'Linens',       sub: 'Bedding',       unit: 'Each',     stock: 220, target: 110,  reorderPt: 110,  reorderQty: 50,  supplier: 'Sincerity' },
  // Duvet Inners (from Astro — go to Sincerity for laundry)
  { code: 'JCTT-DUVET-K-GDF', name: 'Duvet Inner King (Down/Feather)',       cat: 'Linens',       sub: 'Bedding',       unit: 'Each',     stock: 260, target: 110,  reorderPt: 55,   reorderQty: 30,  supplier: 'Astro'    },
  { code: 'JCTT-DUVET-K-SYN', name: 'Duvet Inner King (Synthetic)',          cat: 'Linens',       sub: 'Bedding',       unit: 'Each',     stock: 20,  target: 20,   reorderPt: 10,   reorderQty: 10,  supplier: 'Astro'    },
  { code: 'JCTT-DUVET-T-GDF', name: 'Duvet Inner Twin (Down/Feather)',       cat: 'Linens',       sub: 'Bedding',       unit: 'Each',     stock: 174, target: 88,   reorderPt: 44,   reorderQty: 30,  supplier: 'Astro'    },
  { code: 'JCTT-DUVET-T-SYN', name: 'Duvet Inner Twin (Synthetic)',          cat: 'Linens',       sub: 'Bedding',       unit: 'Each',     stock: 20,  target: 20,   reorderPt: 10,   reorderQty: 10,  supplier: 'Astro'    },
  // Mattress & Pillow Protectors (from Astro)
  { code: 'JCTT-MATPRO-KING', name: 'Mattress Protector King',               cat: 'Linens',       sub: 'Bedding',       unit: 'Each',     stock: 350, target: 110,  reorderPt: 55,   reorderQty: 30,  supplier: 'Astro'    },
  { code: 'JCTT-MATPRO-TWIN', name: 'Mattress Protector Twin',               cat: 'Linens',       sub: 'Bedding',       unit: 'Each',     stock: 175, target: 88,   reorderPt: 44,   reorderQty: 30,  supplier: 'Astro'    },
  { code: 'JCTT-PPROT-BIG',   name: 'Pillow Protector Large',                cat: 'Linens',       sub: 'Bedding',       unit: 'Each',     stock: 700, target: 220,  reorderPt: 110,  reorderQty: 100, supplier: 'Astro'    },
  { code: 'JCTT-PPROT-MED',   name: 'Pillow Protector Medium',               cat: 'Linens',       sub: 'Bedding',       unit: 'Each',     stock: 700, target: 176,  reorderPt: 88,   reorderQty: 100, supplier: 'Astro'    },
  // Pillows (from Astro)
  { code: 'JCTT-WH-PILLOW-BIG', name: 'Pillow Big 1000g (Synthetic)',        cat: 'Linens',       sub: 'Pillows',       unit: 'Each',     stock: 700, target: 220,  reorderPt: 110,  reorderQty: 50,  supplier: 'Astro'    },
  { code: 'JCTT-WH-PILLOW-MED', name: 'Pillow Medium 700g (Synthetic)',      cat: 'Linens',       sub: 'Pillows',       unit: 'Each',     stock: 700, target: 176,  reorderPt: 88,   reorderQty: 50,  supplier: 'Astro'    },
  // Robes (from Astro — go to Sincerity for laundry)
  { code: 'JCTT-ROBE-AC',     name: 'Bathrobe Adult Kimono 100% Cotton',     cat: 'Linens',       sub: 'Robes',         unit: 'Each',     stock: 300, target: 110,  reorderPt: 55,   reorderQty: 30,  supplier: 'Astro'    },
  // ── LINENS - Towels ──────────────────────────────────────────────────────────
  { code: 'L006',             name: 'Bath Towels',                           cat: 'Linens',       sub: 'Towels',        unit: 'Each',     stock: 400, target: 176,  reorderPt: 176,  reorderQty: 100, supplier: 'Sincerity' },
  { code: 'L007',             name: 'Hand Towels',                           cat: 'Linens',       sub: 'Towels',        unit: 'Each',     stock: 300, target: 132,  reorderPt: 132,  reorderQty: 80,  supplier: 'Sincerity' },
  { code: 'L008',             name: 'Face Towels',                           cat: 'Linens',       sub: 'Towels',        unit: 'Each',     stock: 200, target: 88,   reorderPt: 88,   reorderQty: 60,  supplier: 'Sincerity' },
  { code: 'L009',             name: 'Bath Mats',                             cat: 'Linens',       sub: 'Towels',        unit: 'Each',     stock: 150, target: 66,   reorderPt: 66,   reorderQty: 40,  supplier: 'Sincerity' },
  // ── CONSUMABLES - Beverages ──────────────────────────────────────────────────
  { code: 'C001', name: 'Coffee Capsules (Arabica)',                         cat: 'Consumables',  sub: 'Beverages',     unit: 'Each',     stock: 300, target: 550,  reorderPt: 275,  reorderQty: 300, supplier: 'Astro'    },
  { code: 'C002', name: 'Decaf Capsules',                                   cat: 'Consumables',  sub: 'Beverages',     unit: 'Each',     stock: 12,  target: 220,  reorderPt: 110,  reorderQty: 150, supplier: 'Astro'    },
  { code: 'C003', name: 'Green Tea',                                        cat: 'Consumables',  sub: 'Beverages',     unit: 'Each',     stock: 30,  target: 220,  reorderPt: 110,  reorderQty: 150, supplier: 'Astro'    },
  { code: 'C004', name: 'Peppermint Tea',                                   cat: 'Consumables',  sub: 'Beverages',     unit: 'Each',     stock: 20,  target: 165,  reorderPt: 83,   reorderQty: 100  },
  { code: 'C005', name: 'Chamomile Tea',                                    cat: 'Consumables',  sub: 'Beverages',     unit: 'Each',     stock: 4,   target: 165,  reorderPt: 83,   reorderQty: 100, supplier: 'Astro'    },
  { code: 'C006', name: 'English Breakfast Tea',                            cat: 'Consumables',  sub: 'Beverages',     unit: 'Each',     stock: 1,   target: 220,  reorderPt: 110,  reorderQty: 150, supplier: 'Astro'    },
  { code: 'DIEG500', name: 'Earl Grey Tea',                                 cat: 'Consumables',  sub: 'Beverages',     unit: 'Each',     stock: 0,   target: 165,  reorderPt: 83,   reorderQty: 100, supplier: 'Astro'    },
  { code: 'C007', name: 'Instant Coffee',                                   cat: 'Consumables',  sub: 'Beverages',     unit: 'Each',     stock: 90,  target: 165,  reorderPt: 83,   reorderQty: 100, supplier: 'Astro'    },
  { code: 'C008', name: 'Hot Chocolate',                                    cat: 'Consumables',  sub: 'Beverages',     unit: 'Each',     stock: 3,   target: 220,  reorderPt: 110,  reorderQty: 150, supplier: 'Astro'    },
  // ── CONSUMABLES - Sundries ───────────────────────────────────────────────────
  { code: 'C009',      name: 'Brown Sugar',                                 cat: 'Consumables',  sub: 'Sundries',      unit: 'Each',     stock: 5,   target: 1100, reorderPt: 550,  reorderQty: 500, supplier: 'Astro'    },
  { code: 'C010',      name: 'White Sugar',                                 cat: 'Consumables',  sub: 'Sundries',      unit: 'Each',     stock: 4,   target: 550,  reorderPt: 275,  reorderQty: 300, supplier: 'Astro'    },
  { code: 'C011',      name: 'Natural Sweeteners',                          cat: 'Consumables',  sub: 'Sundries',      unit: 'Each',     stock: 300, target: 550,  reorderPt: 275,  reorderQty: 300  },
  { code: 'SUSSTW140', name: 'Wooden Stirrer 140mm',                        cat: 'Consumables',  sub: 'Sundries',      unit: 'PK/1000',  stock: 0,   target: 1100, reorderPt: 550,  reorderQty: 500, cost: 6.52           },
  { code: 'C013',      name: 'Anchor Milk Pods',                            cat: 'Consumables',  sub: 'Sundries',      unit: 'Each',     stock: 5,   target: 660,  reorderPt: 330,  reorderQty: 400, supplier: 'Anchor'   },
  // ── AMENITIES - Toiletries (Radisson Red branded dispensers — Astro) ─────────
  { code: 'AM001', name: 'Shampoo (Dispenser 380ml)',                       cat: 'Amenities',    sub: 'Toiletries',    unit: 'Each',     stock: 34,  target: 385,  reorderPt: 193,  reorderQty: 200, supplier: 'Astro'    },
  { code: 'AM002', name: 'Conditioner (Dispenser 380ml)',                   cat: 'Amenities',    sub: 'Toiletries',    unit: 'Each',     stock: 380, target: 385,  reorderPt: 193,  reorderQty: 200, supplier: 'Astro'    },
  { code: 'AM003', name: 'Body Wash (Dispenser 380ml)',                     cat: 'Amenities',    sub: 'Toiletries',    unit: 'Each',     stock: 33,  target: 440,  reorderPt: 220,  reorderQty: 200, supplier: 'Astro'    },
  { code: 'AM004', name: 'Soap Bars',                                       cat: 'Amenities',    sub: 'Toiletries',    unit: 'Each',     stock: 30,  target: 385,  reorderPt: 193,  reorderQty: 200  },
  { code: 'RADR-HWA380-E', name: 'Handwash (Dispenser 380ml)',             cat: 'Amenities',    sub: 'Toiletries',    unit: 'Each',     stock: 65,  target: 385,  reorderPt: 193,  reorderQty: 200, supplier: 'Astro'    },
  { code: 'RADR-BLT380-E', name: 'Hand & Body Lotion (Dispenser 380ml)',   cat: 'Amenities',    sub: 'Toiletries',    unit: 'Each',     stock: 45,  target: 385,  reorderPt: 193,  reorderQty: 200, supplier: 'Astro'    },
  // AMENITIES - Amenity Kits (Radisson Red branded — Astro)
  { code: 'RADR-DENK11-E', name: 'Dental Kits',                            cat: 'Amenities',    sub: 'Amenity Kits',  unit: 'CT/500',   stock: 5,   target: 0,    reorderPt: null, reorderQty: null, supplier: 'Astro'   },
  { code: 'RADR-HAIR11-E', name: 'Shower Caps',                            cat: 'Amenities',    sub: 'Amenity Kits',  unit: 'CT/500',   stock: 5,   target: 0,    reorderPt: null, reorderQty: null, supplier: 'Astro'   },
  { code: 'RADR-HAIR12-E', name: 'Combs',                                  cat: 'Amenities',    sub: 'Amenity Kits',  unit: 'CT/500',   stock: 1,   target: 0,    reorderPt: null, reorderQty: null, supplier: 'Astro'   },
  { code: 'RADR-SEWK11-E', name: 'Sewing Kits',                            cat: 'Amenities',    sub: 'Amenity Kits',  unit: 'CT/500',   stock: 3,   target: 0,    reorderPt: null, reorderQty: null, supplier: 'Astro'   },
  { code: 'RADR-SHVK11-E', name: 'Shaving Kits',                           cat: 'Amenities',    sub: 'Amenity Kits',  unit: 'CT/100',   stock: 4,   target: 0,    reorderPt: null, reorderQty: null, supplier: 'Astro'   },
  { code: 'RADR-VANK11-E', name: 'Vanity Kits',                            cat: 'Amenities',    sub: 'Amenity Kits',  unit: 'CT/500',   stock: 5,   target: 0,    reorderPt: null, reorderQty: null, supplier: 'Astro'   },
  { code: 'RADR-BATH11-E', name: 'Bath Salts',                             cat: 'Amenities',    sub: 'Amenity Kits',  unit: 'CT/100',   stock: 4,   target: 0,    reorderPt: null, reorderQty: null, supplier: 'Astro'   },
  { code: 'RADR-LNDY01-E', name: 'Laundry Bags (Recycled Plastic)',        cat: 'Amenities',    sub: 'Amenity Kits',  unit: 'CT/1000',  stock: 4,   target: 0,    reorderPt: null, reorderQty: null, supplier: 'Astro'   },
  { code: 'RADR-PENS01-U', name: 'Retractable Pens (Recycled)',             cat: 'Amenities',    sub: 'Amenity Kits',  unit: 'CT/500',   stock: 10,  target: 0,    reorderPt: null, reorderQty: null, supplier: 'Astro'   },
  { code: 'RADR-PENC01-U', name: 'Pencils',                                cat: 'Amenities',    sub: 'Amenity Kits',  unit: 'CT/1000',  stock: 1,   target: 0,    reorderPt: null, reorderQty: null, supplier: 'Astro'   },
  { code: 'RADR-SHOE11-E', name: 'Shoe Shine Sponges',                     cat: 'Amenities',    sub: 'Amenity Kits',  unit: 'CT/300',   stock: 8,   target: 0,    reorderPt: null, reorderQty: null, supplier: 'Astro'   },
  { code: 'RADR-SHOE12-E', name: 'Velour Slippers',                        cat: 'Amenities',    sub: 'Amenity Kits',  unit: 'CT/100',   stock: 45,  target: 0,    reorderPt: null, reorderQty: null, supplier: 'Astro'   },
  // AMENITIES - Toilet Paper
  { code: 'PS1001', name: 'Premium Toilet Roll 2Ply 400sh',                cat: 'Amenities',    sub: 'Toilet Paper',  unit: 'CT/48',    stock: 12,  target: 660,  reorderPt: 330,  reorderQty: 300, cost: 30.75, supplier: 'BUNZL' },
  { code: 'PS1008', name: 'Premium Facial Tissue Cube 2Ply',               cat: 'Amenities',    sub: 'Toiletries',    unit: 'CT/24',    stock: 11,  target: 0,    reorderPt: null, reorderQty: null, cost: 28.75, supplier: 'BUNZL' },
  // ── ASSETS - Dispensables (Tork/Essity bathroom dispensers — BUNZL) ──────────
  { code: 'BW148430',  name: 'Xpress® Multifold Hand Towel Slimline',      cat: 'Assets',       sub: 'Dispensables',  unit: 'CT/210',   stock: 1,   target: 1,    reorderPt: 1,    reorderQty: 1,   cost: 58.50, supplier: 'BUNZL' },
  { code: 'BW2306898', name: 'Soft Mini Jumbo Toilet Roll 2Ply',           cat: 'Assets',       sub: 'Dispensables',  unit: 'CT/12',    stock: 2,   target: 0,    reorderPt: null, reorderQty: null, cost: 47.50, supplier: 'BUNZL' },
  { code: 'BW520501',  name: 'Mildly Scented Foam Soap S4',                cat: 'Assets',       sub: 'Dispensables',  unit: 'CT/6',     stock: 0,   target: 0,    reorderPt: null, reorderQty: null, cost: 88.95, supplier: 'BUNZL' },
  // ── ASSETS - Bin Liners (BUNZL) ─────────────────────────────────────────────
  { code: 'BZSINGLET/ME', name: 'Ezytie Waste Bag White Medium',           cat: 'Assets',       sub: 'Bin Liners',    unit: 'CT/2000',  stock: 15,  target: 0,    reorderPt: null, reorderQty: null, cost: 63.20, supplier: 'BUNZL' },
  { code: 'BZ82EHD',      name: 'Bin Liner Extra Heavy Duty 80-82L',       cat: 'Assets',       sub: 'Bin Liners',    unit: 'CT/200',   stock: 0,   target: 0,    reorderPt: null, reorderQty: null, cost: 62.70, supplier: 'BUNZL' },
  { code: 'BZ36BLK/R',    name: 'Bin Liner Kitchen Tidy Roll Black 36L',   cat: 'Assets',       sub: 'Bin Liners',    unit: 'CT/100',   stock: 0,   target: 0,    reorderPt: null, reorderQty: null, cost: 53.40, supplier: 'BUNZL' },
  // ── ASSETS - Equipment (Astro) ───────────────────────────────────────────────
  { code: 'A002',                name: 'Ironing Boards',                   cat: 'Assets',       sub: 'Equipment',     unit: 'Unit',     stock: 40,  target: 110,  reorderPt: 55,   reorderQty: 70,  supplier: 'Astro'    },
  { code: 'JVD-822919-MB-ST-AS', name: 'Hairdryer 2000W Matt Black',       cat: 'Assets',       sub: 'Equipment',     unit: 'Each',     stock: 354, target: 110,  reorderPt: 55,   reorderQty: 20,  supplier: 'Astro'    },
  { code: 'JVD-8661518-AS',      name: 'Steam Iron 1400W',                 cat: 'Assets',       sub: 'Equipment',     unit: 'Each',     stock: 335, target: 110,  reorderPt: 55,   reorderQty: 20,  supplier: 'Astro'    },
  { code: 'JVD-8661827-MB-AS',   name: 'Kettle 0.6L 800W Matt Black',      cat: 'Assets',       sub: 'Equipment',     unit: 'Each',     stock: 335, target: 110,  reorderPt: 55,   reorderQty: 20,  supplier: 'Astro'    },
  // ── ASSETS - Glassware & Drinkware (Astro) ───────────────────────────────────
  { code: '364-021',    name: 'Stolzle Elements Tumbler 465ml Red',        cat: 'Assets',       sub: 'Glassware',     unit: 'Each',     stock: 200, target: 660,  reorderPt: 330,  reorderQty: 460, supplier: 'Astro'    },
  { code: '200227',     name: 'Pasabahce Serenity Toughened Glass 355ml',  cat: 'Assets',       sub: 'Glassware',     unit: 'Each',     stock: 0,   target: 110,  reorderPt: 55,   reorderQty: 50,  supplier: 'Astro'    },
  { code: '127104',     name: 'Coffee Mug 330ml (Red Interior)',           cat: 'Assets',       sub: 'Drinkware',     unit: 'Each',     stock: 12,  target: 440,  reorderPt: 220,  reorderQty: 200, supplier: 'Astro'    },
  { code: 'A040101000', name: 'Glass Carafe 1L (Radisson Red)',            cat: 'Assets',       sub: 'Glassware',     unit: 'Each',     stock: 250, target: 330,  reorderPt: 165,  reorderQty: 100, supplier: 'Astro'    },
];

export async function POST() {
  try {
    // 1. Ensure sheet tabs + headers exist
    await initSheets();
    // 2. Wipe all existing data rows
    await clearAllData();
    // 3. Re-seed cleanly
    await batchSeed(CATEGORIES, ITEMS);
    return NextResponse.json({
      success: true,
      message: `Cleared and re-seeded ${ITEMS.length} items across ${CATEGORIES.length} categories.`,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function GET() {
  return POST();
}
