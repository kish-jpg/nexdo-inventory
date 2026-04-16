import { NextResponse } from 'next/server';
import { initSheets, clearAllData, computeStatus, batchSeed } from '@/lib/sheets';

// NOTE: Cleaning liquids and commercial vacuums removed — now tracked in /nexdo (NexDo Inventory)
// Last updated: Apr 2026 stocktake — codes and names corrected from vendor data
const CATEGORIES = ['Linens', 'Consumables', 'Amenities', 'Assets'];

const ITEMS = [
  // LINENS - Bedding
  { code: 'L001', name: 'Duvet Covers',                        cat: 'Linens',       sub: 'Bedding',      unit: 'Each',    stock: 180, target: 88,   reorderPt: 88,   reorderQty: 50  },
  { code: 'L002', name: 'King Sheets',                         cat: 'Linens',       sub: 'Bedding',      unit: 'Each',    stock: 280, target: 154,  reorderPt: 154,  reorderQty: 70  },
  { code: 'L003', name: 'Single Sheets',                       cat: 'Linens',       sub: 'Bedding',      unit: 'Each',    stock: 200, target: 110,  reorderPt: 110,  reorderQty: 50  },
  { code: 'L004', name: 'Pillow Slips (Medium)',                cat: 'Linens',       sub: 'Bedding',      unit: 'Each',    stock: 260, target: 132,  reorderPt: 132,  reorderQty: 60  },
  { code: 'L005', name: 'Pillow Slips (Large)',                 cat: 'Linens',       sub: 'Bedding',      unit: 'Each',    stock: 220, target: 110,  reorderPt: 110,  reorderQty: 50  },
  // LINENS - Towels
  { code: 'L006', name: 'Bath Towels',                         cat: 'Linens',       sub: 'Towels',       unit: 'Each',    stock: 400, target: 176,  reorderPt: 176,  reorderQty: 100 },
  { code: 'L007', name: 'Hand Towels',                         cat: 'Linens',       sub: 'Towels',       unit: 'Each',    stock: 300, target: 132,  reorderPt: 132,  reorderQty: 80  },
  { code: 'L008', name: 'Face Towels',                         cat: 'Linens',       sub: 'Towels',       unit: 'Each',    stock: 200, target: 88,   reorderPt: 88,   reorderQty: 60  },
  { code: 'L009', name: 'Bath Mats',                           cat: 'Linens',       sub: 'Towels',       unit: 'Each',    stock: 150, target: 66,   reorderPt: 66,   reorderQty: 40  },
  // CONSUMABLES - Beverages
  { code: 'C001', name: 'Coffee Capsules',                     cat: 'Consumables',  sub: 'Beverages',    unit: 'Each',    stock: 300, target: 550,  reorderPt: 275,  reorderQty: 300 },
  { code: 'C002', name: 'Decaf Capsules',                      cat: 'Consumables',  sub: 'Beverages',    unit: 'Each',    stock: 12,  target: 220,  reorderPt: 110,  reorderQty: 150 },
  { code: 'C003', name: 'Green Tea',                           cat: 'Consumables',  sub: 'Beverages',    unit: 'Each',    stock: 30,  target: 220,  reorderPt: 110,  reorderQty: 150 },
  { code: 'C004', name: 'Peppermint Tea',                      cat: 'Consumables',  sub: 'Beverages',    unit: 'Each',    stock: 20,  target: 165,  reorderPt: 83,   reorderQty: 100 },
  { code: 'C005', name: 'Chamomile Tea',                       cat: 'Consumables',  sub: 'Beverages',    unit: 'Each',    stock: 4,   target: 165,  reorderPt: 83,   reorderQty: 100 },
  { code: 'C006', name: 'English Breakfast Tea',               cat: 'Consumables',  sub: 'Beverages',    unit: 'Each',    stock: 1,   target: 220,  reorderPt: 110,  reorderQty: 150 },
  { code: 'C007', name: 'Instant Coffee',                      cat: 'Consumables',  sub: 'Beverages',    unit: 'Each',    stock: 90,  target: 165,  reorderPt: 83,   reorderQty: 100 },
  { code: 'C008', name: 'Hot Chocolate',                       cat: 'Consumables',  sub: 'Beverages',    unit: 'Each',    stock: 3,   target: 220,  reorderPt: 110,  reorderQty: 150 },
  // CONSUMABLES - Sundries
  { code: 'C009', name: 'Brown Sugar',                         cat: 'Consumables',  sub: 'Sundries',     unit: 'Each',    stock: 5,   target: 1100, reorderPt: 550,  reorderQty: 500 },
  { code: 'C010', name: 'White Sugar',                         cat: 'Consumables',  sub: 'Sundries',     unit: 'Each',    stock: 4,   target: 550,  reorderPt: 275,  reorderQty: 300 },
  { code: 'C011', name: 'Natural Sweeteners',                  cat: 'Consumables',  sub: 'Sundries',     unit: 'Each',    stock: 300, target: 550,  reorderPt: 275,  reorderQty: 300 },
  { code: 'SUSSTW140', name: 'Wooden Stirrer 140mm',           cat: 'Consumables',  sub: 'Sundries',     unit: 'PK/1000', stock: 0,   target: 1100, reorderPt: 550,  reorderQty: 500, cost: 6.52   },
  { code: 'C013', name: 'Anchor Milk Pods',                    cat: 'Consumables',  sub: 'Sundries',     unit: 'Each',    stock: 5,   target: 660,  reorderPt: 330,  reorderQty: 400 },
  // AMENITIES - Toiletries
  { code: 'AM001', name: 'Shampoo',                            cat: 'Amenities',    sub: 'Toiletries',   unit: 'Each',    stock: 34,  target: 385,  reorderPt: 193,  reorderQty: 200 },
  { code: 'AM002', name: 'Conditioner',                        cat: 'Amenities',    sub: 'Toiletries',   unit: 'Each',    stock: 380, target: 385,  reorderPt: 193,  reorderQty: 200 },
  { code: 'AM003', name: 'Body Wash',                          cat: 'Amenities',    sub: 'Toiletries',   unit: 'Each',    stock: 33,  target: 440,  reorderPt: 220,  reorderQty: 200 },
  { code: 'AM004', name: 'Soap Bars',                          cat: 'Amenities',    sub: 'Toiletries',   unit: 'Each',    stock: 30,  target: 385,  reorderPt: 193,  reorderQty: 200 },
  { code: 'PS1001', name: 'Premium Toilet Roll 2Ply 400sh',   cat: 'Amenities',    sub: 'Toilet Paper', unit: 'CT/48',   stock: 12,  target: 660,  reorderPt: 330,  reorderQty: 300, cost: 30.75  },
  { code: 'PS1008', name: 'Premium Facial Tissue Cube 2Ply',  cat: 'Amenities',    sub: 'Toiletries',   unit: 'CT/24',   stock: 11,  target: 0,    reorderPt: null, reorderQty: null, cost: 28.75 },
  // ASSETS - Dispensables (Tork/Essity bathroom dispenser products)
  { code: 'BW148430',  name: 'Xpress® Multifold Hand Towel Slimline', cat: 'Assets', sub: 'Dispensables', unit: 'CT/210',  stock: 1,  target: 1,  reorderPt: 1, reorderQty: 1, cost: 58.50  },
  { code: 'BW2306898', name: 'Soft Mini Jumbo Toilet Roll 2Ply',      cat: 'Assets', sub: 'Dispensables', unit: 'CT/12',   stock: 2,  target: 0,  reorderPt: null, reorderQty: null, cost: 47.50 },
  { code: 'BW520501',  name: 'Mildly Scented Foam Soap S4',           cat: 'Assets', sub: 'Dispensables', unit: 'CT/6',    stock: 0,  target: 0,  reorderPt: null, reorderQty: null, cost: 88.95 },
  // ASSETS - Bin Liners
  { code: 'BZSINGLET/ME', name: 'Ezytie Waste Bag White Medium',         cat: 'Assets', sub: 'Bin Liners', unit: 'CT/2000', stock: 15, target: 0,  reorderPt: null, reorderQty: null, cost: 63.20 },
  { code: 'BZ82EHD',      name: 'Bin Liner Extra Heavy Duty 80-82L',     cat: 'Assets', sub: 'Bin Liners', unit: 'CT/200',  stock: 0,  target: 0,  reorderPt: null, reorderQty: null, cost: 62.70 },
  { code: 'BZ36BLK/R',    name: 'Bin Liner Kitchen Tidy Roll Black 36L', cat: 'Assets', sub: 'Bin Liners', unit: 'CT/100',  stock: 0,  target: 0,  reorderPt: null, reorderQty: null, cost: 53.40 },
  // ASSETS - Equipment & Glassware
  { code: 'A002',  name: 'Ironing Boards',                     cat: 'Assets',       sub: 'Equipment',    unit: 'Unit',    stock: 40,  target: 110,  reorderPt: 55,   reorderQty: 70  },
  { code: 'A003',  name: 'Red Glasses',                        cat: 'Assets',       sub: 'Glassware',    unit: 'Each',    stock: 200, target: 660,  reorderPt: 330,  reorderQty: 460 },
  { code: 'A004',  name: 'Coffee Mugs',                        cat: 'Assets',       sub: 'Drinkware',    unit: 'Each',    stock: 12,  target: 440,  reorderPt: 220,  reorderQty: 200 },
  { code: 'A005',  name: 'Glass Bottles',                      cat: 'Assets',       sub: 'Glassware',    unit: 'Each',    stock: 250, target: 330,  reorderPt: 165,  reorderQty: 100 },
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
