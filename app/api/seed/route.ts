import { NextResponse } from 'next/server';
import { initSheets, computeStatus, batchSeed } from '@/lib/sheets';

const CATEGORIES = ['Linens', 'Consumables', 'Amenities', 'Cleaning Supplies', 'Assets'];

const ITEMS = [
  // LINENS - Bedding
  { code: 'L001', name: 'Duvet Covers',          cat: 'Linens', sub: 'Bedding',       unit: 'Each',   stock: 180, target: 88,   reorderPt: 88,   reorderQty: 50  },
  { code: 'L002', name: 'King Sheets',            cat: 'Linens', sub: 'Bedding',       unit: 'Each',   stock: 280, target: 154,  reorderPt: 154,  reorderQty: 70  },
  { code: 'L003', name: 'Single Sheets',          cat: 'Linens', sub: 'Bedding',       unit: 'Each',   stock: 200, target: 110,  reorderPt: 110,  reorderQty: 50  },
  { code: 'L004', name: 'Pillow Slips (Medium)',  cat: 'Linens', sub: 'Bedding',       unit: 'Each',   stock: 260, target: 132,  reorderPt: 132,  reorderQty: 60  },
  { code: 'L005', name: 'Pillow Slips (Large)',   cat: 'Linens', sub: 'Bedding',       unit: 'Each',   stock: 220, target: 110,  reorderPt: 110,  reorderQty: 50  },
  // LINENS - Towels
  { code: 'L006', name: 'Bath Towels',            cat: 'Linens', sub: 'Towels',        unit: 'Each',   stock: 400, target: 176,  reorderPt: 176,  reorderQty: 100 },
  { code: 'L007', name: 'Hand Towels',            cat: 'Linens', sub: 'Towels',        unit: 'Each',   stock: 300, target: 132,  reorderPt: 132,  reorderQty: 80  },
  { code: 'L008', name: 'Face Towels',            cat: 'Linens', sub: 'Towels',        unit: 'Each',   stock: 200, target: 88,   reorderPt: 88,   reorderQty: 60  },
  { code: 'L009', name: 'Bath Mats',              cat: 'Linens', sub: 'Towels',        unit: 'Each',   stock: 150, target: 66,   reorderPt: 66,   reorderQty: 40  },
  // CONSUMABLES - Beverages
  { code: 'C001', name: 'Coffee Capsules',        cat: 'Consumables', sub: 'Beverages', unit: 'Each', stock: 300, target: 550,  reorderPt: 275,  reorderQty: 300 },
  { code: 'C002', name: 'Decaf Capsules',         cat: 'Consumables', sub: 'Beverages', unit: 'Each', stock: 120, target: 220,  reorderPt: 110,  reorderQty: 150 },
  { code: 'C003', name: 'Green Tea',              cat: 'Consumables', sub: 'Beverages', unit: 'Each', stock: 120, target: 220,  reorderPt: 110,  reorderQty: 150 },
  { code: 'C004', name: 'Peppermint Tea',         cat: 'Consumables', sub: 'Beverages', unit: 'Each', stock: 90,  target: 165,  reorderPt: 83,   reorderQty: 100 },
  { code: 'C005', name: 'Earl Grey',              cat: 'Consumables', sub: 'Beverages', unit: 'Each', stock: 90,  target: 165,  reorderPt: 83,   reorderQty: 100 },
  { code: 'C006', name: 'English Breakfast Tea',  cat: 'Consumables', sub: 'Beverages', unit: 'Each', stock: 120, target: 220,  reorderPt: 110,  reorderQty: 150 },
  { code: 'C007', name: 'Instant Coffee',         cat: 'Consumables', sub: 'Beverages', unit: 'Each', stock: 90,  target: 165,  reorderPt: 83,   reorderQty: 100 },
  { code: 'C008', name: 'Hot Chocolate',          cat: 'Consumables', sub: 'Beverages', unit: 'Each', stock: 120, target: 220,  reorderPt: 110,  reorderQty: 150 },
  // CONSUMABLES - Sundries
  { code: 'C009', name: 'Raw Sugar',              cat: 'Consumables', sub: 'Sundries',  unit: 'Each', stock: 600, target: 1100, reorderPt: 550,  reorderQty: 500 },
  { code: 'C010', name: 'Pure Sugar',             cat: 'Consumables', sub: 'Sundries',  unit: 'Each', stock: 300, target: 550,  reorderPt: 275,  reorderQty: 300 },
  { code: 'C011', name: 'Natural Sweeteners',     cat: 'Consumables', sub: 'Sundries',  unit: 'Each', stock: 300, target: 550,  reorderPt: 275,  reorderQty: 300 },
  { code: 'C012', name: 'Stirring Spoons',        cat: 'Consumables', sub: 'Sundries',  unit: 'Each', stock: 600, target: 1100, reorderPt: 550,  reorderQty: 500 },
  { code: 'C013', name: 'Anchor Milk Pods',       cat: 'Consumables', sub: 'Sundries',  unit: 'Each', stock: 360, target: 660,  reorderPt: 330,  reorderQty: 400 },
  // AMENITIES
  { code: 'AM001', name: 'Shampoo',               cat: 'Amenities', sub: 'Toiletries',   unit: 'Each', stock: 400, target: 385, reorderPt: 193, reorderQty: 200 },
  { code: 'AM002', name: 'Conditioner',           cat: 'Amenities', sub: 'Toiletries',   unit: 'Each', stock: 380, target: 385, reorderPt: 193, reorderQty: 200 },
  { code: 'AM003', name: 'Body Wash',             cat: 'Amenities', sub: 'Toiletries',   unit: 'Each', stock: 450, target: 440, reorderPt: 220, reorderQty: 200 },
  { code: 'AM004', name: 'Soap Bars',             cat: 'Amenities', sub: 'Toiletries',   unit: 'Each', stock: 400, target: 385, reorderPt: 193, reorderQty: 200 },
  { code: 'AM005', name: 'Toilet Paper Rolls',    cat: 'Amenities', sub: 'Toilet Paper', unit: 'Each', stock: 700, target: 660, reorderPt: 330, reorderQty: 300 },
  // CLEANING SUPPLIES
  { code: 'CS001', name: 'All-Purpose Cleaner',   cat: 'Cleaning Supplies', sub: 'Liquids', unit: 'Bottle', stock: 60,  target: 55,  reorderPt: 28, reorderQty: 30 },
  { code: 'CS002', name: 'Glass Cleaner',         cat: 'Cleaning Supplies', sub: 'Liquids', unit: 'Bottle', stock: 35,  target: 33,  reorderPt: 17, reorderQty: 20 },
  { code: 'CS003', name: 'Bathroom Cleaner',      cat: 'Cleaning Supplies', sub: 'Liquids', unit: 'Bottle', stock: 55,  target: 55,  reorderPt: 28, reorderQty: 30 },
  { code: 'CS004', name: 'Disinfectant',          cat: 'Cleaning Supplies', sub: 'Liquids', unit: 'Bottle', stock: 45,  target: 44,  reorderPt: 22, reorderQty: 25 },
  { code: 'CS005', name: 'Garbage Bags (Large)',  cat: 'Cleaning Supplies', sub: 'Bags',    unit: 'Roll',   stock: 120, target: 110, reorderPt: 55, reorderQty: 50 },
  { code: 'CS006', name: 'Garbage Bags (Small)',  cat: 'Cleaning Supplies', sub: 'Bags',    unit: 'Roll',   stock: 170, target: 165, reorderPt: 83, reorderQty: 80 },
  // ASSETS
  { code: 'A001',  name: 'Commercial Vacuums',    cat: 'Assets', sub: 'Equipment',  unit: 'Unit', stock: 8,   target: 11,  reorderPt: 5,   reorderQty: 3   },
  { code: 'A002',  name: 'Ironing Boards',        cat: 'Assets', sub: 'Equipment',  unit: 'Unit', stock: 40,  target: 110, reorderPt: 55,  reorderQty: 70  },
  { code: 'A003',  name: 'Red Glasses',           cat: 'Assets', sub: 'Glassware',  unit: 'Each', stock: 200, target: 660, reorderPt: 330, reorderQty: 460 },
  { code: 'A004',  name: 'Coffee Mugs',           cat: 'Assets', sub: 'Drinkware',  unit: 'Each', stock: 300, target: 440, reorderPt: 220, reorderQty: 200 },
  { code: 'A005',  name: 'Glass Bottles',         cat: 'Assets', sub: 'Glassware',  unit: 'Each', stock: 250, target: 330, reorderPt: 165, reorderQty: 100 },
];

export async function POST() {
  try {
    // Step 1: ensure sheet tabs + headers (3 API calls)
    await initSheets();

    // Step 2: batch write everything in 3 more API calls total
    await batchSeed(CATEGORIES, ITEMS);

    return NextResponse.json({ success: true, message: `Seeded ${ITEMS.length} items across ${CATEGORIES.length} categories into Google Sheets.` });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// Allow GET for easy browser trigger
export async function GET() {
  return POST();
}
