import { NextResponse } from 'next/server';
import {
  getItems, getCategories, createItem, updateItem, adjustStock,
} from '@/lib/sheets';

// ─── April 2026 Stocktake Data ────────────────────────────────────────────────
//
// Two types of entries:
//   UPDATE  — existing item gets new code / name / unit / price + stocktake qty
//   NEW     — new item to be created with stocktake qty
//   QTY     — existing item (unchanged code), just set stocktake stock level

type StocktakeEntry =
  | { op: 'update'; currentCode: string; newCode: string; name: string; unit: string; cost: number; qty: number; sub?: string }
  | { op: 'new';    newCode: string; name: string; unit: string; cost: number; qty: number; cat: string; sub: string }
  | { op: 'qty';    currentCode: string; qty: number };

const STOCKTAKE: StocktakeEntry[] = [
  // ── UPDATES: fix code + name + price + set April count ──────────────────────

  // Stirring Spoons → Wooden Stirrer 140mm  (C012 → SUSSTW140)
  { op: 'update', currentCode: 'C012',  newCode: 'SUSSTW140',    name: 'Wooden Stirrer 140mm',                      unit: 'PK/1000', cost: 6.52,  qty: 0 },

  // Toilet Paper Rolls → Premium Toilet Roll  (AM005 → PS1001)
  { op: 'update', currentCode: 'AM005', newCode: 'PS1001',       name: 'Premium Toilet Roll 2Ply 400sh',            unit: 'CT/48',   cost: 30.75, qty: 12 },

  // Earl Grey → Chamomile Tea  (C005 stays, name updates)
  { op: 'update', currentCode: 'C005',  newCode: 'C005',         name: 'Chamomile Tea',                             unit: 'Each',    cost: 0,     qty: 4 },

  // Garbage Bags Large → Bin Liner EHD 80-82L  (CS005 → BZ82EHD)
  { op: 'update', currentCode: 'CS005', newCode: 'BZ82EHD',      name: 'Bin Liner Extra Heavy Duty Flat Pack 80-82L', unit: 'CT/200', cost: 62.70, qty: 0 },

  // Garbage Bags Small → Bin Liner Kitchen Tidy 36L  (CS006 → BZ36BLK/R)
  { op: 'update', currentCode: 'CS006', newCode: 'BZ36BLK/R',    name: 'Bin Liner Kitchen Tidy Roll Black 36L',     unit: 'CT/100',  cost: 53.40, qty: 0 },

  // ── QTY ONLY: set April stocktake quantities for existing items ───────────────

  // Guest Toiletries (counted in cartons)
  { op: 'qty', currentCode: 'AM001', qty: 34  },  // Shampoo – 34 cartons
  { op: 'qty', currentCode: 'AM003', qty: 33  },  // Body Wash – 33 cartons
  { op: 'qty', currentCode: 'AM004', qty: 30  },  // Soap Bars (Hand Wash) – 30 boxes

  // Beverages
  { op: 'qty', currentCode: 'C002',  qty: 12  },  // Decaf Capsules – 12 boxes
  { op: 'qty', currentCode: 'C003',  qty: 30  },  // Green Tea – 30 packets
  { op: 'qty', currentCode: 'C004',  qty: 20  },  // Peppermint Tea – 20 packets
  { op: 'qty', currentCode: 'C006',  qty: 1   },  // English Breakfast Tea – 1 box
  { op: 'qty', currentCode: 'C008',  qty: 3   },  // Hot Chocolate – 2.5 boxes → 3
  { op: 'qty', currentCode: 'C009',  qty: 5   },  // Brown Sugar – 5 packets
  { op: 'qty', currentCode: 'C010',  qty: 4   },  // White Sugar – 4 packets
  { op: 'qty', currentCode: 'C013',  qty: 5   },  // Anchor Milk Pods – 5 pcs

  // Assets
  { op: 'qty', currentCode: 'A004',  qty: 12  },  // Coffee Mugs – 12 cartons
  { op: 'qty', currentCode: 'A002',  qty: 40  },  // Ironing Boards – keep current

  // ── NEW ITEMS: create and set April stocktake quantity ────────────────────────

  // Premium Facial Tissue (Amenities – Toiletries)
  { op: 'new', newCode: 'PS1008',       name: 'Premium Facial Tissue Cube 2Ply 90sh',      unit: 'CT/24',   cost: 28.75, qty: 11, cat: 'Amenities', sub: 'Toiletries'   },

  // Dispenser products (Assets – Dispensables)
  { op: 'new', newCode: 'BW148430',     name: 'Xpress® Multifold Hand Towel Slimline',     unit: 'CT/210',  cost: 58.50, qty: 1,  cat: 'Assets',    sub: 'Dispensables' },
  { op: 'new', newCode: 'BW2306898',    name: 'Soft Mini Jumbo Toilet Roll 2Ply',          unit: 'CT/12',   cost: 47.50, qty: 2,  cat: 'Assets',    sub: 'Dispensables' },
  { op: 'new', newCode: 'BW520501',     name: 'Mildly Scented Foam Soap S4',               unit: 'CT/6',    cost: 88.95, qty: 0,  cat: 'Assets',    sub: 'Dispensables' },

  // Bin liners (Assets – Bin Liners)
  { op: 'new', newCode: 'BZSINGLET/ME', name: 'Ezytie Waste Bag White Medium',             unit: 'CT/2000', cost: 63.20, qty: 15, cat: 'Assets',    sub: 'Bin Liners'   },
];

// ─── Route Handler ────────────────────────────────────────────────────────────

export async function GET() {
  const results: { code: string; name: string; op: string; qty: number; status: string; note?: string }[] = [];

  try {
    // 1. Load current items and category map
    const [items, categories] = await Promise.all([getItems(), getCategories()]);

    const byCode = new Map(items.filter(i => i.itemCode).map(i => [i.itemCode!, i]));
    const catByName = new Map(categories.map(c => [c.name.toLowerCase(), c.id]));

    let i = 0;
    for (const entry of STOCKTAKE) {
      // Small delay every 5 items to stay within Sheets write quota
      if (i > 0 && i % 5 === 0) await new Promise(r => setTimeout(r, 3000));
      i++;
      try {
        if (entry.op === 'qty') {
          // ── Just update stock
          const item = byCode.get(entry.currentCode);
          if (!item) { results.push({ code: entry.currentCode, name: '?', op: 'qty', qty: entry.qty, status: 'not_found' }); continue; }
          await adjustStock(item.id, 'stocktake', entry.qty, 'Apr 2026 Stocktake', 'System');
          results.push({ code: entry.currentCode, name: item.name, op: 'qty', qty: entry.qty, status: 'ok' });

        } else if (entry.op === 'update') {
          // ── Update code / name / unit / cost + set stock
          const item = byCode.get(entry.currentCode);
          if (!item) { results.push({ code: entry.currentCode, name: entry.name, op: 'update', qty: entry.qty, status: 'not_found' }); continue; }
          await updateItem(item.id, {
            itemCode: entry.newCode,
            name: entry.name,
            unit: entry.unit,
            ...(entry.cost > 0 ? { unitCost: entry.cost } : {}),
          });
          await adjustStock(item.id, 'stocktake', entry.qty, 'Apr 2026 Stocktake', 'System');
          results.push({ code: entry.newCode, name: entry.name, op: 'update', qty: entry.qty, status: 'ok' });

        } else if (entry.op === 'new') {
          // ── Create new item then set stock
          const catId = catByName.get(entry.cat.toLowerCase());
          if (!catId) { results.push({ code: entry.newCode, name: entry.name, op: 'new', qty: entry.qty, status: 'cat_not_found', note: entry.cat }); continue; }

          // Skip if already exists (idempotent re-run)
          if (byCode.has(entry.newCode)) {
            const existing = byCode.get(entry.newCode)!;
            await adjustStock(existing.id, 'stocktake', entry.qty, 'Apr 2026 Stocktake', 'System');
            results.push({ code: entry.newCode, name: entry.name, op: 'new(existing)', qty: entry.qty, status: 'ok' });
            continue;
          }

          const created = await createItem({
            itemCode: entry.newCode,
            name: entry.name,
            categoryId: catId,
            subCategory: entry.sub,
            unit: entry.unit,
            unitCost: entry.cost,
            stock: 0,
            targetStock: 0,
            reorderPoint: null,
            reorderQty: null,
          });
          await adjustStock(created.id, 'stocktake', entry.qty, 'Apr 2026 Stocktake', 'System');
          results.push({ code: entry.newCode, name: entry.name, op: 'new', qty: entry.qty, status: 'ok' });
        }
      } catch (e: any) {
        results.push({ code: (entry as any).newCode ?? (entry as any).currentCode, name: '', op: entry.op, qty: (entry as any).qty, status: 'error', note: e.message });
      }
    }

    const ok    = results.filter(r => r.status === 'ok').length;
    const fails = results.filter(r => r.status !== 'ok').length;

    return NextResponse.json({
      success: true,
      message: `Stocktake Apr 2026 applied — ${ok} items updated, ${fails} issues.`,
      results,
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
