import { NextResponse } from 'next/server';
import { initNexDoSheets, seedNexDoItems, sheetsClearNexDo } from '@/lib/sheets';

// ── All NexDo items from Radisson Red Housekeeping Equipment file ─────────────
const NEXDO_ITEMS = [
  // ── EQUIPMENT ─────────────────────────────────────────────────────────────
  {
    code: 'EQ001', name: 'BR30/4 Scrubber Dryer (incl 2 Batteries + Charger)',
    cat: 'Equipment', sub: 'Machines', unit: 'Unit',
    stock: 1, target: 1, reorderPt: 0, reorderQty: 1,
    cost: 424, notes: 'Monthly rental $424. Common areas hard floors. Rental until Karcher arrives.',
  },
  {
    code: 'EQ002', name: 'Karcher T10/1 HEPA Tub Vacuum',
    cat: 'Equipment', sub: 'Machines', unit: 'Unit',
    stock: 2, target: 4, reorderPt: 2, reorderQty: 2,
    cost: 440.54, notes: 'Ordered 4, received 2. Bedrooms. Battery powered 36V.',
  },
  {
    code: 'EQ003', name: 'Puzzi 9/1 BP Upholstery Spot Cleaner',
    cat: 'Equipment', sub: 'Machines', unit: 'Unit',
    stock: 1, target: 1, reorderPt: 0, reorderQty: 1,
    cost: 1790.43, notes: 'Incl battery and charger. Housekeeping carpet issues.',
  },
  {
    code: 'EQ004', name: 'KM 70/20 C Outdoor Sweeper',
    cat: 'Equipment', sub: 'Machines', unit: 'Unit',
    stock: 0, target: 1, reorderPt: 0, reorderQty: 1,
    cost: 1358.14, notes: 'Outside footpaths. Delivery status TBC.',
  },

  // ── CHEMICALS ─────────────────────────────────────────────────────────────
  {
    code: 'CH001', name: 'Sure Plant Based Washroom Cleaner 2L',
    cat: 'Chemicals', sub: 'Sure Range', unit: 'Bottle',
    stock: 1, target: 4, reorderPt: 2, reorderQty: 4,
    cost: 134.25, notes: 'Bathroom cleaning. Dilution system dispenses.',
  },
  {
    code: 'CH002', name: 'Sure Plant Based Floor Cleaner 2L',
    cat: 'Chemicals', sub: 'Sure Range', unit: 'Bottle',
    stock: 1, target: 4, reorderPt: 2, reorderQty: 4,
    cost: 134.25, notes: 'Floor cleaning. Dilution system dispenses.',
  },
  {
    code: 'CH003', name: 'Sure Plant Based Surface Cleaner 2L',
    cat: 'Chemicals', sub: 'Sure Range', unit: 'Bottle',
    stock: 1, target: 4, reorderPt: 2, reorderQty: 4,
    cost: 134.25, notes: 'General surfaces. Dilution system dispenses.',
  },
  {
    code: 'CH004', name: 'Sure Plant Based Disinfectant 2L',
    cat: 'Chemicals', sub: 'Sure Range', unit: 'Bottle',
    stock: 1, target: 4, reorderPt: 2, reorderQty: 4,
    cost: 134.25, notes: 'Toilet / disinfection. Dilution system dispenses.',
  },

  // ── TOOLS — Cloths ────────────────────────────────────────────────────────
  {
    code: '25151846', name: 'Greenspeed Original Cloth Blue (PK/10)',
    cat: 'Tools', sub: 'Cloths', unit: 'Pack',
    stock: 25, target: 30, reorderPt: 10, reorderQty: 15,
    cost: 23.72, notes: 'Room cleaning — all areas except toilet. 250 cloths total.',
  },
  {
    code: '25155905', name: 'Greenspeed Original Cloth Red (PK/10)',
    cat: 'Tools', sub: 'Cloths', unit: 'Pack',
    stock: 25, target: 30, reorderPt: 10, reorderQty: 15,
    cost: 23.72, notes: 'Bathroom / toilet areas.',
  },
  {
    code: '25153039', name: 'Greenspeed Original Cloth Green (PK/10)',
    cat: 'Tools', sub: 'Cloths', unit: 'Pack',
    stock: 10, target: 12, reorderPt: 4, reorderQty: 6,
    cost: 23.72, notes: 'Marble cleaning with water only.',
  },
  {
    code: '25138142', name: 'Greenspeed Glass Cleaning Cloth Microfibre Blue',
    cat: 'Tools', sub: 'Cloths', unit: 'Each',
    stock: 100, target: 120, reorderPt: 40, reorderQty: 60,
    cost: 5.15, notes: 'Glass cleaning / mirrors etc.',
  },

  // ── TOOLS — Mops & Handles ────────────────────────────────────────────────
  {
    code: '25138155', name: 'Greenspeed Sprenkler Handle with Reservoir 1.45m',
    cat: 'Tools', sub: 'Mops & Handles', unit: 'Each',
    stock: 10, target: 10, reorderPt: 3, reorderQty: 5,
    cost: 60.65, notes: '2 per floor for 5 floors.',
  },
  {
    code: '25138154', name: 'Greenspeed Flatmop Frame 40cm',
    cat: 'Tools', sub: 'Mops & Handles', unit: 'Each',
    stock: 7, target: 10, reorderPt: 3, reorderQty: 5,
    cost: 31.98, notes: '2 per floor. 3 outstanding delivery.',
  },
  {
    code: '25138119', name: 'Greenspeed Twist Mop Fringe 45cm Blue',
    cat: 'Tools', sub: 'Mops & Handles', unit: 'Each',
    stock: 30, target: 30, reorderPt: 10, reorderQty: 20,
    cost: 12.45, notes: '3 per mop handle. Cycle once used.',
  },
  {
    code: '25138157', name: 'Greenspeed 2 Part Telescopic Handle',
    cat: 'Tools', sub: 'Mops & Handles', unit: 'Each',
    stock: 7, target: 10, reorderPt: 3, reorderQty: 5,
    cost: 30.54, notes: 'Extender for dusting — edges/detailing.',
  },
  {
    code: '25138156', name: 'Greenspeed Fox Duster Handle',
    cat: 'Tools', sub: 'Mops & Handles', unit: 'Each',
    stock: 8, target: 10, reorderPt: 3, reorderQty: 5,
    cost: 15.60, notes: 'Bendable duster handle.',
  },
  {
    code: '25138158', name: 'Greenspeed Fox Duster Sleeve',
    cat: 'Tools', sub: 'Mops & Handles', unit: 'Each',
    stock: 10, target: 15, reorderPt: 5, reorderQty: 10,
    cost: 15.80, notes: 'One per duster handle.',
  },

  // ── TOOLS — Other ─────────────────────────────────────────────────────────
  {
    code: '18861593', name: 'Wonder Sponge Magic Eraser White',
    cat: 'Tools', sub: 'Other', unit: 'Each',
    stock: 50, target: 60, reorderPt: 20, reorderQty: 30,
    cost: 4.38, notes: 'General cleaning.',
  },
  {
    code: 'TBC-WCB', name: 'Oates Window Cleaning Bucket',
    cat: 'Tools', sub: 'Other', unit: 'Each',
    stock: 10, target: 10, reorderPt: 3, reorderQty: 5,
    cost: null, notes: 'Window cleaning.',
  },
  {
    code: '11123213', name: 'Enclosed Toilet Brush Set White',
    cat: 'Tools', sub: 'Other', unit: 'Each',
    stock: 6, target: 10, reorderPt: 3, reorderQty: 5,
    cost: 8.65, notes: 'One per trolley. Do not use room brushes.',
  },

  // ── SAFETY ────────────────────────────────────────────────────────────────
  {
    code: '11129789', name: 'Safety Sign Wet Floor A-Frame 600x290mm',
    cat: 'Safety', sub: 'Signs', unit: 'Each',
    stock: 3, target: 5, reorderPt: 2, reorderQty: 3,
    cost: 11.70, notes: 'Wet areas / spills.',
  },
  {
    code: '25156198', name: 'Safety Sign "Cleaning In Progress" 600x290mm',
    cat: 'Safety', sub: 'Signs', unit: 'Each',
    stock: 1, target: 3, reorderPt: 1, reorderQty: 2,
    cost: 20.40, notes: 'Public bathrooms / common areas.',
  },
];

export async function POST() {
  try {
    await initNexDoSheets();
    await sheetsClearNexDo();
    await seedNexDoItems(NEXDO_ITEMS);
    return NextResponse.json({ success: true, message: `Seeded ${NEXDO_ITEMS.length} NexDo items.` });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

export async function GET() { return POST(); }
