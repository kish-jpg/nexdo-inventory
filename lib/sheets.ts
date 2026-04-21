/**
 * lib/sheets.ts
 * Google Sheets data access layer — no external dependencies.
 * Uses Node.js built-in `crypto` to sign JWTs for service account auth,
 * then calls the Google Sheets REST API directly with fetch.
 *
 * Sheet layout (3 tabs):
 *   Items        — one row per inventory item
 *   Categories   — one row per category
 *   Transactions — one row per stock movement
 */

import { createSign } from 'crypto';

// ─── Environment ──────────────────────────────────────────────────────────────

function getEnv(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Missing env var: ${key}`);
  return v;
}

// ─── JWT / Token ──────────────────────────────────────────────────────────────

let cachedToken: string | null = null;
let tokenExpiry = 0;

function b64url(input: string | Buffer): string {
  const buf = typeof input === 'string' ? Buffer.from(input, 'utf8') : input;
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry - 60_000) return cachedToken;

  const email = getEnv('GOOGLE_SERVICE_ACCOUNT_EMAIL');
  // Private key is stored with literal \n in env — convert to real newlines
  const privateKey = getEnv('GOOGLE_PRIVATE_KEY').replace(/\\n/g, '\n');

  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = b64url(JSON.stringify({
    iss: email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }));

  const sign = createSign('RSA-SHA256');
  sign.update(`${header}.${claim}`);
  const sig = sign.sign(privateKey, 'base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

  const jwt = `${header}.${claim}.${sig}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });

  const data = await res.json() as any;
  if (!data.access_token) {
    throw new Error(`Google auth failed: ${JSON.stringify(data)}`);
  }

  cachedToken = data.access_token;
  tokenExpiry = (now + 3600) * 1000;
  return cachedToken!;
}

// ─── Read Cache (60-second TTL — avoids repeated reads in bulk operations) ───

const readCache = new Map<string, { data: string[][]; exp: number }>();

function cacheGet(key: string): string[][] | null {
  const entry = readCache.get(key);
  if (entry && Date.now() < entry.exp) return entry.data;
  readCache.delete(key);
  return null;
}

function cacheSet(key: string, data: string[][]): void {
  readCache.set(key, { data, exp: Date.now() + 60_000 });
}

// ─── Rate-limit retry helper ──────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function invalidateCache(): void {
  readCache.clear();
}

// ─── Raw Sheets API Helpers ───────────────────────────────────────────────────

const BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

async function sheetsGet(range: string, attempt = 0): Promise<string[][]> {
  const cached = cacheGet(range);
  if (cached) return cached;

  const token = await getAccessToken();
  const id = getEnv('GOOGLE_SHEET_ID');
  const res = await fetch(`${BASE}/${id}/values/${encodeURIComponent(range)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json() as any;

  // Retry on 429 (rate limit) with exponential backoff — max 4 attempts
  if (res.status === 429 && attempt < 4) {
    const delay = (attempt + 1) * 15_000; // 15s, 30s, 45s, 60s
    await sleep(delay);
    return sheetsGet(range, attempt + 1);
  }

  if (!res.ok) throw new Error(`Sheets GET error: ${JSON.stringify(data)}`);
  const values = data.values ?? [];
  cacheSet(range, values);
  return values;
}

async function sheetsAppend(sheetName: string, row: (string | number | null)[]): Promise<void> {
  const token = await getAccessToken();
  const id = getEnv('GOOGLE_SHEET_ID');
  const range = `${sheetName}!A:Z`;
  const res = await fetch(
    `${BASE}/${id}/values/${encodeURIComponent(range)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: [row.map(v => v == null ? '' : String(v))] }),
    }
  );
  if (!res.ok) {
    const e = await res.json();
    throw new Error(`Sheets append error: ${JSON.stringify(e)}`);
  }
  invalidateCache();
}

/** Write many rows in a single API call — use for bulk operations like seeding */
async function sheetsBatchAppend(sheetName: string, rows: (string | number | null)[][]): Promise<void> {
  if (rows.length === 0) return;
  const token = await getAccessToken();
  const id = getEnv('GOOGLE_SHEET_ID');
  const range = `${sheetName}!A:Z`;
  const res = await fetch(
    `${BASE}/${id}/values/${encodeURIComponent(range)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: rows.map(row => row.map(v => v == null ? '' : String(v))) }),
    }
  );
  if (!res.ok) {
    const e = await res.json();
    throw new Error(`Sheets batch append error: ${JSON.stringify(e)}`);
  }
  invalidateCache();
}

async function sheetsUpdate(range: string, row: (string | number | null)[]): Promise<void> {
  const token = await getAccessToken();
  const id = getEnv('GOOGLE_SHEET_ID');
  const res = await fetch(
    `${BASE}/${id}/values/${encodeURIComponent(range)}?valueInputOption=RAW`,
    {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: [row.map(v => v == null ? '' : String(v))] }),
    }
  );
  if (!res.ok) {
    const e = await res.json();
    throw new Error(`Sheets update error: ${JSON.stringify(e)}`);
  }
  invalidateCache();
}

/** Write multiple rows to an exact range using PUT — more reliable than :append for bulk inserts */
async function sheetsWriteRows(range: string, rows: (string | number | null)[][]): Promise<void> {
  if (rows.length === 0) return;
  const token = await getAccessToken();
  const id = getEnv('GOOGLE_SHEET_ID');
  const res = await fetch(
    `${BASE}/${id}/values/${encodeURIComponent(range)}?valueInputOption=RAW`,
    {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: rows.map(row => row.map(v => v == null ? '' : String(v))) }),
    }
  );
  if (!res.ok) {
    const e = await res.json();
    throw new Error(`Sheets write error: ${JSON.stringify(e)}`);
  }
  invalidateCache();
}

async function sheetsClear(range: string): Promise<void> {
  const token = await getAccessToken();
  const id = getEnv('GOOGLE_SHEET_ID');
  const res = await fetch(`${BASE}/${id}/values/${encodeURIComponent(range)}:clear`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const e = await res.json();
    throw new Error(`Sheets clear error: ${JSON.stringify(e)}`);
  }
  invalidateCache();
}

/** Create a new sheet tab if it doesn't exist */
async function ensureSheet(title: string): Promise<void> {
  const token = await getAccessToken();
  const id = getEnv('GOOGLE_SHEET_ID');
  // Get existing sheets
  const res = await fetch(`${BASE}/${id}?fields=sheets.properties.title`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json() as any;
  const existing = (data.sheets ?? []).map((s: any) => s.properties.title);
  if (existing.includes(title)) return;
  // Add sheet
  await fetch(`${BASE}/${id}:batchUpdate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ requests: [{ addSheet: { properties: { title } } }] }),
  });
}

// ─── Sheet Column Definitions ─────────────────────────────────────────────────

const ITEM_HEADERS = [
  'id', 'itemCode', 'name', 'category', 'categoryId',
  'subCategory', 'unit', 'stock', 'targetStock',
  'reorderPoint', 'reorderQty', 'status',
  'supplier', 'unitCost', 'location', 'lastUpdated',
];

const CATEGORY_HEADERS = ['id', 'name'];

const TX_HEADERS = ['id', 'itemId', 'itemName', 'quantity', 'type', 'reason', 'doneBy', 'timestamp'];

// ─── Clear all data (keep headers) ───────────────────────────────────────────

export async function clearAllData(): Promise<void> {
  // Clear everything from row 2 onwards on all three sheets
  await sheetsClear('Items!A2:Z10000');
  await sheetsClear('Categories!A2:Z10000');
  await sheetsClear('Transactions!A2:Z10000');
  invalidateCache();
}

// ─── Sheet Init ───────────────────────────────────────────────────────────────

export async function initSheets(): Promise<void> {
  await ensureSheet('Items');
  await ensureSheet('Categories');
  await ensureSheet('Transactions');
  await ensureSheet('Occupancy');

  // Write headers (row 1 of each sheet)
  await sheetsUpdate('Items!A1:P1', ITEM_HEADERS);
  await sheetsUpdate('Categories!A1:B1', CATEGORY_HEADERS);
  await sheetsUpdate('Transactions!A1:H1', TX_HEADERS);
  await sheetsUpdate('Occupancy!A1:Q1', OCCUPANCY_HEADERS);
}

// ─── Next ID Helper ───────────────────────────────────────────────────────────

async function nextId(sheetName: string): Promise<number> {
  const rows = await sheetsGet(`${sheetName}!A:A`);
  const ids = rows.slice(1).map(r => parseInt(r[0] ?? '0')).filter(n => !isNaN(n) && n > 0);
  return ids.length === 0 ? 1 : Math.max(...ids) + 1;
}

// ─── Find row number by ID ────────────────────────────────────────────────────

async function findRowByID(sheetName: string, id: number): Promise<number | null> {
  const rows = await sheetsGet(`${sheetName}!A:A`);
  for (let i = 1; i < rows.length; i++) {
    if (parseInt(rows[i][0] ?? '') === id) return i + 1; // 1-indexed sheet row
  }
  return null;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type SheetCategory = {
  id: number;
  name: string;
  _count?: { items: number };
};

export type SheetItem = {
  id: number;
  itemCode: string | null;
  name: string;
  category: SheetCategory;
  categoryId: number;
  subCategory: string | null;
  unit: string;
  stock: number;
  targetStock: number;
  reorderPoint: number | null;
  reorderQty: number | null;
  status: string;
  supplier: string | null;
  unitCost: number | null;
  location: string | null;
  lastUpdated: string;
};

export type SheetTransaction = {
  id: number;
  itemId: number;
  itemName: string;
  quantity: number;
  type: string;
  reason: string | null;
  doneBy: string | null;
  timestamp: string;
  item: { name: string; category: { name: string } };
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function n(v: string | undefined): number | null {
  if (!v || v === '') return null;
  const x = parseFloat(v);
  return isNaN(x) ? null : x;
}

function ni(v: string | undefined): number {
  if (!v || v === '') return 0;
  const x = parseInt(v);
  return isNaN(x) ? 0 : x;
}

export function computeStatus(stock: number, reorderPoint: number | null, targetStock: number): string {
  if (reorderPoint != null && stock <= reorderPoint * 0.5) return 'red';
  if (reorderPoint != null && stock <= reorderPoint) return 'amber';
  if (stock >= targetStock * 0.8) return 'green';
  return 'amber';
}

// ─── Categories ───────────────────────────────────────────────────────────────

export async function getCategories(): Promise<SheetCategory[]> {
  const rows = await sheetsGet('Categories!A:B');
  if (rows.length <= 1) return [];
  return rows.slice(1).filter(r => r[0]).map(r => ({ id: ni(r[0]), name: r[1] ?? '' }));
}

export async function getCategoryMap(): Promise<Record<number, string>> {
  const cats = await getCategories();
  const map: Record<number, string> = {};
  for (const c of cats) map[c.id] = c.name;
  return map;
}

export async function createCategory(name: string): Promise<SheetCategory> {
  const existing = await getCategories();
  const found = existing.find(c => c.name.toLowerCase() === name.toLowerCase());
  if (found) return found;
  const id = await nextId('Categories');
  await sheetsAppend('Categories', [id, name]);
  return { id, name };
}

// ─── Items ────────────────────────────────────────────────────────────────────

function rowToItem(row: string[], catMap: Record<number, string>): SheetItem {
  const catId = ni(row[4]);
  return {
    id: ni(row[0]),
    itemCode: row[1] || null,
    name: row[2] ?? '',
    category: { id: catId, name: row[3] || catMap[catId] || '' },
    categoryId: catId,
    subCategory: row[5] || null,
    unit: row[6] || 'Each',
    stock: ni(row[7]),
    targetStock: ni(row[8]),
    reorderPoint: n(row[9]),
    reorderQty: n(row[10]),
    status: row[11] || 'green',
    supplier: row[12] || null,
    unitCost: n(row[13]),
    location: row[14] || null,
    lastUpdated: row[15] || new Date().toISOString(),
  };
}

function itemToRow(item: Partial<SheetItem> & { id: number; name: string; categoryId: number; targetStock: number; stock: number; unit: string; status: string }, catName: string): (string | number | null)[] {
  return [
    item.id,
    item.itemCode ?? '',
    item.name,
    catName,
    item.categoryId,
    item.subCategory ?? '',
    item.unit,
    item.stock,
    item.targetStock,
    item.reorderPoint ?? '',
    item.reorderQty ?? '',
    item.status,
    item.supplier ?? '',
    item.unitCost ?? '',
    item.location ?? '',
    new Date().toISOString(),
  ];
}

export async function getItems(opts?: { categoryId?: number; search?: string }): Promise<SheetItem[]> {
  const [rows, catMap] = await Promise.all([sheetsGet('Items!A:P'), getCategoryMap()]);
  if (rows.length <= 1) return [];
  let items = rows.slice(1)
    .filter(r => r[0] && r[2]) // must have id and name
    .map(r => rowToItem(r, catMap));

  if (opts?.categoryId) items = items.filter(i => i.categoryId === opts.categoryId);
  if (opts?.search) {
    const s = opts.search.toLowerCase();
    items = items.filter(i => i.name.toLowerCase().includes(s) || (i.itemCode ?? '').toLowerCase().includes(s));
  }
  return items.sort((a, b) => a.categoryId - b.categoryId || a.name.localeCompare(b.name));
}

export async function getItemById(id: number): Promise<SheetItem | null> {
  const items = await getItems();
  return items.find(i => i.id === id) ?? null;
}

export async function createItem(data: {
  name: string; categoryId: number; subCategory?: string | null; unit?: string;
  stock: number; targetStock: number; reorderPoint?: number | null; reorderQty?: number | null;
  supplier?: string | null; unitCost?: number | null; location?: string | null; itemCode?: string | null;
}): Promise<SheetItem> {
  const catMap = await getCategoryMap();
  const catName = catMap[data.categoryId] ?? '';
  const id = await nextId('Items');
  const stock = data.stock ?? 0;
  const status = computeStatus(stock, data.reorderPoint ?? null, data.targetStock);

  const item = {
    id, name: data.name, categoryId: data.categoryId, status,
    stock, targetStock: data.targetStock, unit: data.unit ?? 'Each',
    itemCode: data.itemCode ?? null, subCategory: data.subCategory ?? null,
    reorderPoint: data.reorderPoint ?? null, reorderQty: data.reorderQty ?? null,
    supplier: data.supplier ?? null, unitCost: data.unitCost ?? null, location: data.location ?? null,
  };

  await sheetsAppend('Items', itemToRow(item, catName));
  return { ...item, category: { id: data.categoryId, name: catName }, lastUpdated: new Date().toISOString() };
}

export async function updateItem(id: number, data: Partial<{
  name: string; categoryId: number; subCategory: string | null; unit: string;
  stock: number; targetStock: number; reorderPoint: number | null; reorderQty: number | null;
  supplier: string | null; unitCost: number | null; location: string | null; itemCode: string | null; status: string;
}>): Promise<SheetItem | null> {
  const rowNum = await findRowByID('Items', id);
  if (!rowNum) return null;

  const existing = await getItemById(id);
  if (!existing) return null;

  const catMap = await getCategoryMap();
  const catId = data.categoryId ?? existing.categoryId;
  const catName = catMap[catId] ?? existing.category.name;
  const stock = data.stock ?? existing.stock;
  const targetStock = data.targetStock ?? existing.targetStock;
  const reorderPoint = data.reorderPoint !== undefined ? data.reorderPoint : existing.reorderPoint;
  const status = data.status ?? computeStatus(stock, reorderPoint, targetStock);

  const updated = {
    id,
    name: data.name ?? existing.name,
    categoryId: catId,
    itemCode: data.itemCode !== undefined ? data.itemCode : existing.itemCode,
    subCategory: data.subCategory !== undefined ? data.subCategory : existing.subCategory,
    unit: data.unit ?? existing.unit,
    stock, targetStock, reorderPoint,
    reorderQty: data.reorderQty !== undefined ? data.reorderQty : existing.reorderQty,
    supplier: data.supplier !== undefined ? data.supplier : existing.supplier,
    unitCost: data.unitCost !== undefined ? data.unitCost : existing.unitCost,
    location: data.location !== undefined ? data.location : existing.location,
    status,
  };

  await sheetsUpdate(`Items!A${rowNum}:P${rowNum}`, itemToRow(updated, catName));
  return { ...updated, category: { id: catId, name: catName }, lastUpdated: new Date().toISOString() };
}

export async function deleteItem(id: number): Promise<boolean> {
  const rowNum = await findRowByID('Items', id);
  if (!rowNum) return false;
  await sheetsClear(`Items!A${rowNum}:P${rowNum}`);
  // Also clear related transactions
  const txRows = await sheetsGet('Transactions!A:B');
  for (let i = txRows.length - 1; i >= 1; i--) {
    if (parseInt(txRows[i][1] ?? '') === id) {
      await sheetsClear(`Transactions!A${i + 1}:H${i + 1}`);
    }
  }
  return true;
}

// ─── Stock Adjust ─────────────────────────────────────────────────────────────

export async function adjustStock(
  itemId: number,
  type: 'add' | 'remove' | 'stocktake',
  quantity: number,
  reason?: string,
  doneBy?: string,
): Promise<{ item: SheetItem; txId: number } | null> {
  const item = await getItemById(itemId);
  if (!item) return null;

  let newStock: number;
  if (type === 'add') newStock = item.stock + quantity;
  else if (type === 'remove') newStock = Math.max(0, item.stock - quantity);
  else newStock = quantity; // stocktake = absolute count

  const txQty = type === 'remove' ? -quantity : quantity;
  const newStatus = computeStatus(newStock, item.reorderPoint, item.targetStock);

  // Update item stock
  const updatedItem = await updateItem(itemId, { stock: newStock, status: newStatus });
  if (!updatedItem) return null;

  // Record transaction
  const txId = await nextId('Transactions');
  await sheetsAppend('Transactions', [
    txId, itemId, item.name, txQty, type, reason ?? '', doneBy ?? '', new Date().toISOString(),
  ]);

  return { item: updatedItem, txId };
}

/**
 * Bulk stocktake — sets absolute stock for multiple items in a single pass.
 * Uses 2 Sheets API reads total (Items + Transactions), then batch-writes,
 * avoiding the per-item read storm that causes 429 quota errors.
 */
export async function applyStocktake(
  entries: { code: string; qty: number }[],
  reason = 'Stocktake',
  doneBy = 'System',
): Promise<{ updated: { code: string; name: string; qty: number }[]; notFound: string[] }> {
  const now = new Date().toISOString();

  // 1. Read all data ONCE before any writes
  const [itemRows, txRows] = await Promise.all([
    sheetsGet('Items!A:P'),
    sheetsGet('Transactions!A:A'),
  ]);

  // 2. Build code → {id, rowNum, row[]} map from raw sheet data
  type RowInfo = { id: number; rowNum: number; name: string; row: string[] };
  const codeMap = new Map<string, RowInfo>();
  itemRows.slice(1).forEach((row, i) => {
    const code = row[1];
    if (row[0] && code) {
      codeMap.set(code, { id: parseInt(row[0]), rowNum: i + 2, name: row[2] ?? '', row });
    }
  });

  // 3. Next transaction ID = current row count (header + data rows = length, so next = length)
  let nextTxId = txRows.length;

  const updated: { code: string; name: string; qty: number }[] = [];
  const notFound: string[] = [];
  const txBatch: (string | number | null)[][] = [];

  // 4. Process each entry — compute new row, queue write
  for (const entry of entries) {
    const info = codeMap.get(entry.code);
    if (!info) { notFound.push(entry.code); continue; }

    // Build updated item row with new stock value
    const newRow = [...info.row];
    newRow[7]  = String(entry.qty);  // stock
    newRow[11] = computeStatus(entry.qty, info.row[9] ? parseInt(info.row[9]) : null, parseInt(info.row[8]) || 0); // status
    newRow[15] = now; // lastUpdated

    // Write item row directly — no extra reads needed
    await sheetsUpdate(`Items!A${info.rowNum}:P${info.rowNum}`, newRow);

    // Queue transaction row
    txBatch.push([++nextTxId, info.id, info.name, entry.qty, 'stocktake', reason, doneBy, now]);
    updated.push({ code: entry.code, name: info.name, qty: entry.qty });
  }

  // 5. Write all transactions in ONE batch call
  if (txBatch.length > 0) await sheetsBatchAppend('Transactions', txBatch);

  return { updated, notFound };
}

// ─── Transactions ─────────────────────────────────────────────────────────────

export async function getTransactions(opts?: { itemId?: number; limit?: number }): Promise<SheetTransaction[]> {
  const rows = await sheetsGet('Transactions!A:H');
  if (rows.length <= 1) return [];

  let txs = rows.slice(1)
    .filter(r => r[0])
    .map(r => ({
      id: ni(r[0]), itemId: ni(r[1]), itemName: r[2] ?? '',
      quantity: ni(r[3]), type: r[4] ?? '', reason: r[5] || null,
      doneBy: r[6] || null, timestamp: r[7] ?? '',
      item: { name: r[2] ?? '', category: { name: '' } }, // category name not stored in tx
    }))
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  if (opts?.itemId) txs = txs.filter(t => t.itemId === opts.itemId);
  if (opts?.limit) txs = txs.slice(0, opts.limit);
  return txs;
}

export async function getItemTransactions(itemId: number, limit = 20): Promise<SheetTransaction[]> {
  return getTransactions({ itemId, limit });
}

// ─── Batch Seed (writes everything in 3 API calls) ───────────────────────────

type SeedItem = {
  code: string; name: string; cat: string; sub: string; unit: string;
  stock: number; target: number; reorderPt: number | null; reorderQty: number | null;
  cost?: number;
};

export async function batchSeed(categoryNames: string[], items: SeedItem[]): Promise<void> {
  const now = new Date().toISOString();

  // 1. Batch write all categories (1 API call)
  const catRows: (string | number)[][] = categoryNames.map((name, i) => [i + 1, name]);
  await sheetsBatchAppend('Categories', catRows);

  // Build category name → id map
  const catMap: Record<string, number> = {};
  categoryNames.forEach((name, i) => { catMap[name] = i + 1; });

  // 2. Batch write all items (1 API call)
  const itemRows: (string | number | null)[][] = items.map((item, i) => {
    const id = i + 1;
    const catId = catMap[item.cat] ?? 1;
    const status = computeStatus(item.stock, item.reorderPt, item.target);
    return [
      id, item.code, item.name, item.cat, catId,
      item.sub, item.unit, item.stock, item.target,
      item.reorderPt ?? '', item.reorderQty ?? '', status,
      '', item.cost ?? '', '', now, // supplier, unitCost, location, lastUpdated
    ];
  });
  await sheetsBatchAppend('Items', itemRows);

  // 3. Batch write all initial stocktake transactions (1 API call)
  const txRows: (string | number | null)[][] = items.map((item, i) => [
    i + 1,           // tx id
    i + 1,           // item id
    item.name,
    item.stock,      // quantity
    'stocktake',
    'Initial seed — NexDo_Inventory_System.xlsx (Apr 2026)',
    '',              // doneBy
    now,
  ]);
  await sheetsBatchAppend('Transactions', txRows);
}

// ─── Laundry Module ───────────────────────────────────────────────────────────

const LAUNDRY_HEADERS = [
  'id', 'date', 'kingDep', 'kingRegular', 'kingDay3',
  'twinDep', 'twinRegular', 'twinDay3', 'notes', 'timestamp',
];

const DELIVERY_HEADERS = [
  'id', 'date', 'kingSheets', 'singleSheets', 'pillowSlipsMed',
  'pillowSlipsLarge', 'bathTowels', 'handTowels', 'faceTowels',
  'bathMats', 'duvets', 'notes', 'timestamp',
];

export type LaundryLog = {
  id: number;
  date: string;
  kingDep: number; kingRegular: number; kingDay3: number;
  twinDep: number; twinRegular: number; twinDay3: number;
  notes: string;
  timestamp: string;
};

export type SincerityDelivery = {
  id: number;
  date: string;
  kingSheets: number; singleSheets: number;
  pillowSlipsMed: number; pillowSlipsLarge: number;
  bathTowels: number; handTowels: number; faceTowels: number;
  bathMats: number; duvets: number;
  notes: string;
  timestamp: string;
};

/** Items sent per room type (recipe) */
export const LINEN_RECIPE = {
  fullKing: {
    'King Sheets': 3, 'Pillow Slips (Medium)': 2, 'Pillow Slips (Large)': 2,
    'Bath Towels': 2, 'Hand Towels': 2, 'Face Towels': 2, 'Bath Mats': 1,
  },
  fullTwin: {
    'Single Sheets': 6, 'Pillow Slips (Medium)': 2, 'Pillow Slips (Large)': 2,
    'Bath Towels': 2, 'Hand Towels': 2, 'Face Towels': 2, 'Bath Mats': 1,
  },
  terryOnly: {
    'Bath Towels': 2, 'Hand Towels': 2, 'Face Towels': 2, 'Bath Mats': 1,
  },
} as const;

export function calcSentItems(log: Pick<LaundryLog, 'kingDep' | 'kingRegular' | 'kingDay3' | 'twinDep' | 'twinRegular' | 'twinDay3'>): Record<string, number> {
  const fullKing = log.kingDep + log.kingDay3;
  const fullTwin = log.twinDep + log.twinDay3;
  const terryRooms = fullKing + log.kingRegular + fullTwin + log.twinRegular;

  return {
    'King Sheets':           fullKing * 3,
    'Single Sheets':         fullTwin * 6,
    'Pillow Slips (Medium)': (fullKing + fullTwin) * 2,
    'Pillow Slips (Large)':  (fullKing + fullTwin) * 2,
    'Bath Towels':           terryRooms * 2,
    'Hand Towels':           terryRooms * 2,
    'Face Towels':           terryRooms * 2,
    'Bath Mats':             terryRooms * 1,
  };
}

export async function initLaundrySheets(): Promise<void> {
  await ensureSheet('Laundry');
  await ensureSheet('SincerityDeliveries');
  await sheetsUpdate('Laundry!A1:J1', LAUNDRY_HEADERS);
  await sheetsUpdate('SincerityDeliveries!A1:M1', DELIVERY_HEADERS);
}

export async function saveLaundryLog(log: Omit<LaundryLog, 'id' | 'timestamp'>): Promise<LaundryLog> {
  const id = await nextId('Laundry');
  const timestamp = new Date().toISOString();
  await sheetsAppend('Laundry', [
    id, log.date, log.kingDep, log.kingRegular, log.kingDay3,
    log.twinDep, log.twinRegular, log.twinDay3, log.notes, timestamp,
  ]);
  return { id, timestamp, ...log };
}

export async function getLaundryLogs(limit = 60): Promise<LaundryLog[]> {
  const rows = await sheetsGet('Laundry!A:J');
  if (rows.length <= 1) return [];
  return rows.slice(1)
    .filter(r => r[0])
    .map(r => ({
      id: ni(r[0]), date: r[1] ?? '', kingDep: ni(r[2]), kingRegular: ni(r[3]), kingDay3: ni(r[4]),
      twinDep: ni(r[5]), twinRegular: ni(r[6]), twinDay3: ni(r[7]), notes: r[8] ?? '', timestamp: r[9] ?? '',
    }))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, limit);
}

export async function saveSincerityDelivery(d: Omit<SincerityDelivery, 'id' | 'timestamp'>): Promise<SincerityDelivery> {
  const id = await nextId('SincerityDeliveries');
  const timestamp = new Date().toISOString();
  await sheetsAppend('SincerityDeliveries', [
    id, d.date, d.kingSheets, d.singleSheets, d.pillowSlipsMed, d.pillowSlipsLarge,
    d.bathTowels, d.handTowels, d.faceTowels, d.bathMats, d.duvets, d.notes, timestamp,
  ]);
  return { id, timestamp, ...d };
}

export async function getSincerityDeliveries(limit = 60): Promise<SincerityDelivery[]> {
  const rows = await sheetsGet('SincerityDeliveries!A:M');
  if (rows.length <= 1) return [];
  return rows.slice(1)
    .filter(r => r[0])
    .map(r => ({
      id: ni(r[0]), date: r[1] ?? '',
      kingSheets: ni(r[2]), singleSheets: ni(r[3]), pillowSlipsMed: ni(r[4]), pillowSlipsLarge: ni(r[5]),
      bathTowels: ni(r[6]), handTowels: ni(r[7]), faceTowels: ni(r[8]),
      bathMats: ni(r[9]), duvets: ni(r[10]), notes: r[11] ?? '', timestamp: r[12] ?? '',
    }))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, limit);
}

const RECON_ITEMS: { name: string; deliveryKey: keyof Omit<SincerityDelivery, 'id' | 'date' | 'notes' | 'timestamp'> }[] = [
  { name: 'King Sheets',           deliveryKey: 'kingSheets' },
  { name: 'Single Sheets',         deliveryKey: 'singleSheets' },
  { name: 'Pillow Slips (Medium)', deliveryKey: 'pillowSlipsMed' },
  { name: 'Pillow Slips (Large)',  deliveryKey: 'pillowSlipsLarge' },
  { name: 'Bath Towels',           deliveryKey: 'bathTowels' },
  { name: 'Hand Towels',           deliveryKey: 'handTowels' },
  { name: 'Face Towels',           deliveryKey: 'faceTowels' },
  { name: 'Bath Mats',             deliveryKey: 'bathMats' },
  { name: 'Duvet Covers',          deliveryKey: 'duvets' },
];

export async function getLaundryReconciliation() {
  const [logs, deliveries, items] = await Promise.all([
    getLaundryLogs(1000),
    getSincerityDeliveries(1000),
    getItems(),
  ]);

  // Aggregate total sent per item
  const totalSent: Record<string, number> = {};
  for (const log of logs) {
    const sent = calcSentItems(log);
    for (const [item, qty] of Object.entries(sent)) {
      totalSent[item] = (totalSent[item] ?? 0) + qty;
    }
  }

  // Aggregate total received per item
  const totalReceived: Record<string, number> = {};
  for (const d of deliveries) {
    for (const { name, deliveryKey } of RECON_ITEMS) {
      totalReceived[name] = (totalReceived[name] ?? 0) + (d[deliveryKey] as number);
    }
  }

  // Build reconciliation rows
  const rows = RECON_ITEMS.map(({ name }) => {
    const sent = totalSent[name] ?? 0;
    const received = totalReceived[name] ?? 0;
    const atLaundry = Math.max(0, sent - received);
    const inventoryItem = items.find(i => i.name === name);
    const inHotel = inventoryItem?.stock ?? 0;
    const par = inventoryItem?.targetStock ?? 0;
    const total = inHotel + atLaundry;
    const status = total >= par ? 'green' : total >= par * 0.7 ? 'amber' : 'red';
    return { name, sent, received, atLaundry, inHotel, total, par, status };
  });

  // Recent logs for display
  const recentLogs = logs.slice(0, 14);
  const recentDeliveries = deliveries.slice(0, 14);

  return { rows, recentLogs, recentDeliveries };
}

// ─── Dashboard Stats ──────────────────────────────────────────────────────────

export async function getDashboardStats() {
  const items = await getItems();
  const recentTxs = await getTransactions({ limit: 20 });

  const total = items.length;
  const green = items.filter(i => i.status === 'green').length;
  const amber = items.filter(i => i.status === 'amber').length;
  const red = items.filter(i => i.status === 'red').length;

  const needsReorder = items.filter(i => {
    const threshold = i.reorderPoint ?? Math.round(i.targetStock * 0.5);
    return i.stock <= threshold;
  });

  // Category health
  const catMap: Record<string, { total: number; stock: number; target: number }> = {};
  for (const item of items) {
    const cat = item.category.name;
    if (!catMap[cat]) catMap[cat] = { total: 0, stock: 0, target: 0 };
    catMap[cat].total++;
    catMap[cat].stock += item.stock;
    catMap[cat].target += item.targetStock;
  }
  const categoryHealth = Object.entries(catMap).map(([name, d]) => ({
    name, count: d.total,
    stockPct: d.target > 0 ? Math.round((d.stock / d.target) * 100) : 0,
  }));

  const reorderList = needsReorder
    .sort((a, b) => {
      const aS = (a.reorderPoint ?? a.targetStock) - a.stock;
      const bS = (b.reorderPoint ?? b.targetStock) - b.stock;
      return bS - aS;
    })
    .slice(0, 10)
    .map(i => ({
      id: i.id, name: i.name, category: i.category.name,
      stock: i.stock, targetStock: i.targetStock,
      reorderPoint: i.reorderPoint, reorderQty: i.reorderQty,
      status: i.status,
      shortage: (i.reorderPoint ?? i.targetStock) - i.stock,
    }));

  return {
    kpis: { total, green, amber, red, needsReorder: needsReorder.length },
    categoryHealth,
    reorderList,
    recentTransactions: recentTxs,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// NexDo Cleaning Inventory
// Sheet tabs: NexDoItems, NexDoTransactions
// ═══════════════════════════════════════════════════════════════════════════════

const NEXDO_ITEM_HEADERS = [
  'id', 'code', 'name', 'category', 'subcategory', 'unit',
  'stock', 'targetStock', 'reorderPoint', 'reorderQty',
  'unitCost', 'notes', 'status', 'lastUpdated',
];

const NEXDO_TX_HEADERS = ['id', 'itemId', 'itemName', 'quantity', 'type', 'reason', 'doneBy', 'timestamp'];

export type NexDoItem = {
  id: number;
  code: string;
  name: string;
  category: string;
  subcategory: string;
  unit: string;
  stock: number;
  targetStock: number;
  reorderPoint: number;
  reorderQty: number;
  unitCost: number | null;
  notes: string;
  status: string;
  lastUpdated: string;
};

export type NexDoTransaction = {
  id: number;
  itemId: number;
  itemName: string;
  quantity: number;
  type: string;
  reason: string;
  doneBy: string;
  timestamp: string;
};

export async function initNexDoSheets(): Promise<void> {
  await ensureSheet('NexDoItems');
  await ensureSheet('NexDoTransactions');
  await sheetsUpdate('NexDoItems!A1:N1', NEXDO_ITEM_HEADERS);
  await sheetsUpdate('NexDoTransactions!A1:H1', NEXDO_TX_HEADERS);
}

function rowToNexDoItem(row: string[]): NexDoItem {
  return {
    id:           ni(row[0]),
    code:         row[1] ?? '',
    name:         row[2] ?? '',
    category:     row[3] ?? '',
    subcategory:  row[4] ?? '',
    unit:         row[5] ?? 'Each',
    stock:        ni(row[6]),
    targetStock:  ni(row[7]),
    reorderPoint: ni(row[8]),
    reorderQty:   ni(row[9]),
    unitCost:     n(row[10]),
    notes:        row[11] ?? '',
    status:       row[12] ?? 'green',
    lastUpdated:  row[13] ?? '',
  };
}

function nexdoItemToRow(item: NexDoItem): (string | number | null)[] {
  return [
    item.id, item.code, item.name, item.category, item.subcategory, item.unit,
    item.stock, item.targetStock, item.reorderPoint, item.reorderQty,
    item.unitCost ?? '', item.notes, item.status, new Date().toISOString(),
  ];
}

export async function getNexDoItems(opts?: { category?: string; search?: string }): Promise<NexDoItem[]> {
  const rows = await sheetsGet('NexDoItems!A:N');
  if (rows.length <= 1) return [];
  let items = rows.slice(1).filter(r => r[0] && r[2]).map(rowToNexDoItem);
  if (opts?.category) items = items.filter(i => i.category === opts.category);
  if (opts?.search) {
    const s = opts.search.toLowerCase();
    items = items.filter(i => i.name.toLowerCase().includes(s) || i.code.toLowerCase().includes(s));
  }
  return items.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
}

export async function getNexDoItemById(id: number): Promise<NexDoItem | null> {
  const items = await getNexDoItems();
  return items.find(i => i.id === id) ?? null;
}

export async function createNexDoItem(data: Omit<NexDoItem, 'id' | 'status' | 'lastUpdated'>): Promise<NexDoItem> {
  const id = await nextId('NexDoItems');
  const status = computeStatus(data.stock, data.reorderPoint, data.targetStock);
  const item: NexDoItem = { ...data, id, status, lastUpdated: new Date().toISOString() };
  await sheetsAppend('NexDoItems', nexdoItemToRow(item));
  return item;
}

export async function updateNexDoItem(id: number, data: Partial<Omit<NexDoItem, 'id' | 'lastUpdated'>>): Promise<NexDoItem | null> {
  const rowNum = await findRowByID('NexDoItems', id);
  if (!rowNum) return null;
  const existing = await getNexDoItemById(id);
  if (!existing) return null;
  const stock = data.stock ?? existing.stock;
  const reorderPoint = data.reorderPoint ?? existing.reorderPoint;
  const targetStock = data.targetStock ?? existing.targetStock;
  const updated: NexDoItem = {
    ...existing, ...data, id, stock, reorderPoint, targetStock,
    status: data.status ?? computeStatus(stock, reorderPoint, targetStock),
    lastUpdated: new Date().toISOString(),
  };
  await sheetsUpdate(`NexDoItems!A${rowNum}:N${rowNum}`, nexdoItemToRow(updated));
  return updated;
}

export async function adjustNexDoStock(
  itemId: number,
  type: 'add' | 'remove' | 'stocktake',
  quantity: number,
  reason?: string,
  doneBy?: string,
): Promise<{ item: NexDoItem; txId: number } | null> {
  const item = await getNexDoItemById(itemId);
  if (!item) return null;
  const newStock = type === 'add' ? item.stock + quantity
    : type === 'remove' ? Math.max(0, item.stock - quantity)
    : quantity;
  const txQty = type === 'remove' ? -quantity : quantity;
  const updatedItem = await updateNexDoItem(itemId, {
    stock: newStock,
    status: computeStatus(newStock, item.reorderPoint, item.targetStock),
  });
  if (!updatedItem) return null;
  const txId = await nextId('NexDoTransactions');
  await sheetsAppend('NexDoTransactions', [
    txId, itemId, item.name, txQty, type, reason ?? '', doneBy ?? '', new Date().toISOString(),
  ]);
  return { item: updatedItem, txId };
}

export async function getNexDoTransactions(opts?: { itemId?: number; limit?: number }): Promise<NexDoTransaction[]> {
  const rows = await sheetsGet('NexDoTransactions!A:H');
  if (rows.length <= 1) return [];
  let txs = rows.slice(1).filter(r => r[0]).map(r => ({
    id: ni(r[0]), itemId: ni(r[1]), itemName: r[2] ?? '',
    quantity: ni(r[3]), type: r[4] ?? '', reason: r[5] ?? '',
    doneBy: r[6] ?? '', timestamp: r[7] ?? '',
  })).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  if (opts?.itemId) txs = txs.filter(t => t.itemId === opts.itemId);
  if (opts?.limit) txs = txs.slice(0, opts.limit);
  return txs;
}

export async function getNexDoRestockList() {
  const items = await getNexDoItems();
  return items.filter(i => i.stock <= i.reorderPoint).map(i => ({
    ...i,
    needed: Math.max(0, i.reorderQty - (i.stock > 0 ? 0 : 0) + i.reorderQty),
    orderQty: i.reorderQty,
  }));
}

export async function getNexDoDashboardStats() {
  const items = await getNexDoItems();
  const recentTxs = await getNexDoTransactions({ limit: 20 });
  const total = items.length;
  const green = items.filter(i => i.status === 'green').length;
  const amber = items.filter(i => i.status === 'amber').length;
  const red = items.filter(i => i.status === 'red').length;
  const needsRestock = items.filter(i => i.stock <= i.reorderPoint).length;
  const totalValue = items.reduce((sum, i) => sum + (i.unitCost ?? 0) * i.stock, 0);
  const categoryBreakdown = ['Equipment', 'Chemicals', 'Tools', 'Safety'].map(cat => {
    const catItems = items.filter(i => i.category === cat);
    return {
      name: cat,
      count: catItems.length,
      value: catItems.reduce((s, i) => s + (i.unitCost ?? 0) * i.stock, 0),
      low: catItems.filter(i => i.status !== 'green').length,
    };
  });
  return { kpis: { total, green, amber, red, needsRestock, totalValue }, categoryBreakdown, recentTxs };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Occupancy & Consumption Reports
// ═══════════════════════════════════════════════════════════════════════════════

// Extended schema: cols A-F are legacy (backward-compatible), G-P are Opera-style fields.
const OCCUPANCY_HEADERS = [
  'id', 'date', 'occupiedRooms', 'totalRooms', 'notes', 'timestamp',
  'arrivals', 'departures', 'stayovers', 'houseUse', 'dayUse', 'noShow',
  'ooo', 'adr', 'roomRevenue', 'source',
];
const TOTAL_ROOMS = 322;

export type OccupancyLog = {
  id: number; date: string; occupiedRooms: number;
  totalRooms: number; notes: string; timestamp: string;
  occupancyPct: number;
  // Extended (optional for backward-compat with old rows)
  arrivals?: number; departures?: number; stayovers?: number;
  houseUse?: number; dayUse?: number; noShow?: number; ooo?: number;
  adr?: number | null; roomRevenue?: number | null;
  source?: string; // "Actual" | "Forecast" | "Opera-Auto"
};

export async function initOccupancySheet(): Promise<void> {
  await ensureSheet('Occupancy');
  await sheetsUpdate('Occupancy!A1:P1', OCCUPANCY_HEADERS);
}

export type OccupancyInput = {
  date: string;
  occupiedRooms: number;
  notes?: string;
  arrivals?: number; departures?: number; stayovers?: number;
  houseUse?: number; dayUse?: number; noShow?: number; ooo?: number;
  adr?: number | null; roomRevenue?: number | null;
  source?: string;
};

export async function saveOccupancyLog(log: OccupancyInput): Promise<OccupancyLog> {
  // Upsert by date
  const rows = await sheetsGet('Occupancy!A:P');
  const existing = rows.slice(1).findIndex(r => r[1] === log.date);
  const id = existing >= 0 ? ni(rows[existing + 1][0]) : await nextId('Occupancy');
  const timestamp = new Date().toISOString();
  const row: (string | number | null)[] = [
    id, log.date, log.occupiedRooms, TOTAL_ROOMS, log.notes ?? '', timestamp,
    log.arrivals ?? '', log.departures ?? '', log.stayovers ?? '',
    log.houseUse ?? '', log.dayUse ?? '', log.noShow ?? '', log.ooo ?? '',
    log.adr ?? '', log.roomRevenue ?? '', log.source ?? 'Actual',
  ];
  if (existing >= 0) {
    await sheetsUpdate(`Occupancy!A${existing + 2}:P${existing + 2}`, row);
  } else {
    await sheetsAppend('Occupancy', row);
  }
  invalidateCache();
  return {
    id, date: log.date, occupiedRooms: log.occupiedRooms,
    totalRooms: TOTAL_ROOMS, notes: log.notes ?? '', timestamp,
    occupancyPct: Math.round((log.occupiedRooms / TOTAL_ROOMS) * 100),
    arrivals: log.arrivals, departures: log.departures, stayovers: log.stayovers,
    houseUse: log.houseUse, dayUse: log.dayUse, noShow: log.noShow, ooo: log.ooo,
    adr: log.adr ?? null, roomRevenue: log.roomRevenue ?? null,
    source: log.source ?? 'Actual',
  };
}

export async function getOccupancyLogs(limit = 90): Promise<OccupancyLog[]> {
  const rows = await sheetsGet('Occupancy!A:P');
  if (rows.length <= 1) return [];
  return rows.slice(1).filter(r => r[0]).map(r => ({
    id: ni(r[0]), date: r[1] ?? '', occupiedRooms: ni(r[2]),
    totalRooms: ni(r[3]) || TOTAL_ROOMS, notes: r[4] ?? '', timestamp: r[5] ?? '',
    occupancyPct: Math.round((ni(r[2]) / (ni(r[3]) || TOTAL_ROOMS)) * 100),
    arrivals: r[6] ? ni(r[6]) : undefined,
    departures: r[7] ? ni(r[7]) : undefined,
    stayovers: r[8] ? ni(r[8]) : undefined,
    houseUse: r[9] ? ni(r[9]) : undefined,
    dayUse: r[10] ? ni(r[10]) : undefined,
    noShow: r[11] ? ni(r[11]) : undefined,
    ooo: r[12] ? ni(r[12]) : undefined,
    adr: n(r[13]),
    roomRevenue: n(r[14]),
    source: r[15] || 'Actual',
  })).sort((a, b) => b.date.localeCompare(a.date)).slice(0, limit);
}

export async function getConsumptionReport(days = 30) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString();

  // Get all "remove" transactions in the window from both inventories
  const [radissonTxs, nexdoTxs, radissonItems, nexdoItems, occupancyLogs] = await Promise.all([
    getTransactions({ limit: 5000 }),
    getNexDoTransactions({ limit: 5000 }),
    getItems(),
    getNexDoItems(),
    getOccupancyLogs(days + 10),
  ]);

  // Filter to window and removals only
  const radissonRemovals = radissonTxs.filter(t => t.type === 'remove' && t.timestamp >= cutoffStr);
  const nexdoRemovals    = nexdoTxs.filter(t => t.type === 'remove' && t.timestamp >= cutoffStr);

  // Occupancy in window
  const occInWindow = occupancyLogs.filter(o => o.date >= cutoff.toISOString().slice(0, 10));
  const avgOccupancy = occInWindow.length > 0
    ? Math.round(occInWindow.reduce((s, o) => s + o.occupancyPct, 0) / occInWindow.length)
    : null;
  const totalOccupiedRoomNights = occInWindow.reduce((s, o) => s + o.occupiedRooms, 0);
  const daysWithData = Math.max(days, 1);

  // Build consumption rows for Radisson items (linens focus)
  const radissonConsumption = radissonItems
    .filter(i => i.category.name === 'Linens')
    .map(item => {
      const txs = radissonRemovals.filter(t => t.itemId === item.id);
      const totalUsed = txs.reduce((s, t) => s + Math.abs(t.quantity), 0);
      const dailyRate = totalUsed / daysWithData;
      const daysRemaining = dailyRate > 0 ? Math.round(item.stock / dailyRate) : null;
      const perRoom = totalOccupiedRoomNights > 0 ? +(totalUsed / totalOccupiedRoomNights).toFixed(3) : null;
      return { id: item.id, name: item.name, category: 'Linens', totalUsed, dailyRate: +dailyRate.toFixed(1), daysRemaining, stock: item.stock, perRoom, status: item.status };
    });

  // Build consumption rows for NexDo items
  const nexdoConsumption = nexdoItems.map(item => {
    const txs = nexdoRemovals.filter(t => t.itemId === item.id);
    const totalUsed = txs.reduce((s, t) => s + Math.abs(t.quantity), 0);
    const totalCost = totalUsed * (item.unitCost ?? 0);
    const dailyRate = totalUsed / daysWithData;
    const daysRemaining = dailyRate > 0 ? Math.round(item.stock / dailyRate) : null;
    const costPerRoom = totalOccupiedRoomNights > 0 && item.unitCost ? +(totalCost / totalOccupiedRoomNights).toFixed(4) : null;
    return { id: item.id, name: item.name, category: item.category, totalUsed, totalCost: +totalCost.toFixed(2), dailyRate: +dailyRate.toFixed(2), daysRemaining, stock: item.stock, unitCost: item.unitCost, costPerRoom, status: item.status };
  });

  // NexDo cost summary
  const nexdoTotalCost = nexdoConsumption.reduce((s, i) => s + i.totalCost, 0);
  const nexdoCostPerRoom = totalOccupiedRoomNights > 0 ? +(nexdoTotalCost / totalOccupiedRoomNights).toFixed(2) : null;

  // Urgency: items with <7 days remaining
  const urgent = [
    ...radissonConsumption.filter(i => i.daysRemaining !== null && i.daysRemaining < 7),
    ...nexdoConsumption.filter(i => i.daysRemaining !== null && i.daysRemaining < 7),
  ].sort((a, b) => (a.daysRemaining ?? 999) - (b.daysRemaining ?? 999));

  return {
    windowDays: days,
    avgOccupancy,
    totalOccupiedRoomNights,
    daysWithOccupancyData: occInWindow.length,
    radissonConsumption,
    nexdoConsumption,
    nexdoTotalCost: +nexdoTotalCost.toFixed(2),
    nexdoCostPerRoom,
    urgent,
  };
}

type NexDoSeedItem = {
  code: string; name: string; cat: string; sub: string; unit: string;
  stock: number; target: number; reorderPt: number; reorderQty: number;
  cost: number | null; notes: string;
};

export async function sheetsClearNexDo(): Promise<void> {
  await sheetsClear('NexDoItems!A2:Z10000');
  await sheetsClear('NexDoTransactions!A2:Z10000');
  invalidateCache();
}

export async function seedNexDoItems(items: NexDoSeedItem[]): Promise<void> {
  const now = new Date().toISOString();
  const rows: (string | number | null)[][] = items.map((item, i) => {
    const id = i + 1;
    const status = computeStatus(item.stock, item.reorderPt, item.target);
    return [id, item.code, item.name, item.cat, item.sub, item.unit,
      item.stock, item.target, item.reorderPt, item.reorderQty,
      item.cost ?? '', item.notes, status, now];
  });
  await sheetsBatchAppend('NexDoItems', rows);
  const txRows: (string | number | null)[][] = items.map((item, i) => [
    i + 1, i + 1, item.name, item.stock, 'stocktake', 'Initial NexDo seed', '', now,
  ]);
  await sheetsBatchAppend('NexDoTransactions', txRows);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Housekeeping: Roster, Phone Assignments, Daily Performance
// ═══════════════════════════════════════════════════════════════════════════════

// 15 phones: 1-3 supervisors, 4-15 housekeepers (per HOMS design)
export const HSK_PHONE_COUNT = 15;

const HSK_ROSTER_HEADERS = ['id', 'phoneId', 'name', 'role', 'active', 'notes', 'timestamp'];
const HSK_ASSIGN_HEADERS = ['id', 'date', 'phoneId', 'housekeeperName', 'shift', 'startTime', 'endTime', 'notes', 'timestamp'];
const HSK_PERF_HEADERS   = ['id', 'date', 'phoneId', 'housekeeperName', 'roomsAssigned', 'departuresDone', 'stayoversDone', 'roomsCleaned', 'minutesWorked', 'avgMinsPerRoom', 'qualityScore', 'notes', 'source', 'timestamp'];

export type HSKRosterEntry = {
  id: number; phoneId: number; name: string; role: string;
  active: boolean; notes: string; timestamp: string;
};

export type HSKAssignment = {
  id: number; date: string; phoneId: number; housekeeperName: string;
  shift: string; startTime: string; endTime: string; notes: string; timestamp: string;
};

export type HSKPerformanceEntry = {
  id: number; date: string; phoneId: number; housekeeperName: string;
  roomsAssigned: number; departuresDone: number; stayoversDone: number;
  roomsCleaned: number; minutesWorked: number; avgMinsPerRoom: number | null;
  qualityScore: number | null; notes: string; source: string; timestamp: string;
};

export async function initHSKSheets(): Promise<void> {
  await ensureSheet('HSKRoster');
  await ensureSheet('HSKAssignments');
  await ensureSheet('HSKPerformance');
  await sheetsUpdate('HSKRoster!A1:G1', HSK_ROSTER_HEADERS);
  await sheetsUpdate('HSKAssignments!A1:I1', HSK_ASSIGN_HEADERS);
  await sheetsUpdate('HSKPerformance!A1:N1', HSK_PERF_HEADERS);
}

// ─── Roster ───────────────────────────────────────────────────────────────────

export async function getHSKRoster(): Promise<HSKRosterEntry[]> {
  const rows = await sheetsGet('HSKRoster!A:G');
  if (rows.length <= 1) return [];
  return rows.slice(1).filter(r => r[0]).map(r => ({
    id: ni(r[0]), phoneId: ni(r[1]), name: r[2] ?? '',
    role: r[3] || 'housekeeper',
    active: (r[4] ?? 'true').toString().toLowerCase() !== 'false',
    notes: r[5] ?? '', timestamp: r[6] ?? '',
  })).sort((a, b) => a.phoneId - b.phoneId);
}

export async function upsertHSKRosterEntry(entry: {
  phoneId: number; name: string; role?: string; active?: boolean; notes?: string;
}): Promise<HSKRosterEntry> {
  const rows = await sheetsGet('HSKRoster!A:G');
  const existing = rows.slice(1).findIndex(r => ni(r[1]) === entry.phoneId);
  const id = existing >= 0 ? ni(rows[existing + 1][0]) : await nextId('HSKRoster');
  const timestamp = new Date().toISOString();
  const row = [
    id, entry.phoneId, entry.name, entry.role ?? 'housekeeper',
    entry.active === false ? 'false' : 'true', entry.notes ?? '', timestamp,
  ];
  if (existing >= 0) {
    await sheetsUpdate(`HSKRoster!A${existing + 2}:G${existing + 2}`, row);
  } else {
    await sheetsAppend('HSKRoster', row);
  }
  invalidateCache();
  return {
    id, phoneId: entry.phoneId, name: entry.name,
    role: entry.role ?? 'housekeeper', active: entry.active !== false,
    notes: entry.notes ?? '', timestamp,
  };
}

// ─── Daily Phone Assignments ──────────────────────────────────────────────────

export async function getHSKAssignments(date?: string, limit = 200): Promise<HSKAssignment[]> {
  const rows = await sheetsGet('HSKAssignments!A:I');
  if (rows.length <= 1) return [];
  let entries = rows.slice(1).filter(r => r[0]).map(r => ({
    id: ni(r[0]), date: r[1] ?? '', phoneId: ni(r[2]),
    housekeeperName: r[3] ?? '', shift: r[4] || 'AM',
    startTime: r[5] ?? '', endTime: r[6] ?? '', notes: r[7] ?? '',
    timestamp: r[8] ?? '',
  }));
  if (date) entries = entries.filter(e => e.date === date);
  return entries.sort((a, b) => b.date.localeCompare(a.date) || a.phoneId - b.phoneId).slice(0, limit);
}

export async function saveHSKAssignment(a: {
  date: string; phoneId: number; housekeeperName: string;
  shift?: string; startTime?: string; endTime?: string; notes?: string;
}): Promise<HSKAssignment> {
  // Upsert by (date, phoneId)
  const rows = await sheetsGet('HSKAssignments!A:I');
  const existing = rows.slice(1).findIndex(r => r[1] === a.date && ni(r[2]) === a.phoneId);
  const id = existing >= 0 ? ni(rows[existing + 1][0]) : await nextId('HSKAssignments');
  const timestamp = new Date().toISOString();
  const row = [
    id, a.date, a.phoneId, a.housekeeperName,
    a.shift ?? 'AM', a.startTime ?? '', a.endTime ?? '', a.notes ?? '', timestamp,
  ];
  if (existing >= 0) {
    await sheetsUpdate(`HSKAssignments!A${existing + 2}:I${existing + 2}`, row);
  } else {
    await sheetsAppend('HSKAssignments', row);
  }
  invalidateCache();
  return {
    id, date: a.date, phoneId: a.phoneId, housekeeperName: a.housekeeperName,
    shift: a.shift ?? 'AM', startTime: a.startTime ?? '',
    endTime: a.endTime ?? '', notes: a.notes ?? '', timestamp,
  };
}

export async function deleteHSKAssignment(id: number): Promise<boolean> {
  const row = await findRowByID('HSKAssignments', id);
  if (!row) return false;
  await sheetsClear(`HSKAssignments!A${row}:I${row}`);
  invalidateCache();
  return true;
}

// ─── Daily Performance Entries ────────────────────────────────────────────────

export async function getHSKPerformance(opts?: {
  date?: string; phoneId?: number; fromDate?: string; toDate?: string; limit?: number;
}): Promise<HSKPerformanceEntry[]> {
  const rows = await sheetsGet('HSKPerformance!A:N');
  if (rows.length <= 1) return [];
  let entries = rows.slice(1).filter(r => r[0]).map(r => {
    const roomsCleaned = ni(r[7]);
    const minutes = ni(r[8]);
    const avgM = n(r[9]);
    return {
      id: ni(r[0]), date: r[1] ?? '', phoneId: ni(r[2]),
      housekeeperName: r[3] ?? '',
      roomsAssigned: ni(r[4]), departuresDone: ni(r[5]),
      stayoversDone: ni(r[6]), roomsCleaned,
      minutesWorked: minutes,
      avgMinsPerRoom: avgM ?? (roomsCleaned > 0 ? +(minutes / roomsCleaned).toFixed(1) : null),
      qualityScore: n(r[10]),
      notes: r[11] ?? '', source: r[12] || 'Manual', timestamp: r[13] ?? '',
    };
  });
  if (opts?.date) entries = entries.filter(e => e.date === opts.date);
  if (opts?.phoneId) entries = entries.filter(e => e.phoneId === opts.phoneId);
  if (opts?.fromDate) entries = entries.filter(e => e.date >= opts.fromDate!);
  if (opts?.toDate) entries = entries.filter(e => e.date <= opts.toDate!);
  return entries
    .sort((a, b) => b.date.localeCompare(a.date) || a.phoneId - b.phoneId)
    .slice(0, opts?.limit ?? 500);
}

export async function saveHSKPerformance(p: {
  date: string; phoneId: number; housekeeperName: string;
  roomsAssigned: number; departuresDone: number; stayoversDone: number;
  minutesWorked: number; qualityScore?: number | null; notes?: string; source?: string;
}): Promise<HSKPerformanceEntry> {
  // Upsert by (date, phoneId)
  const rows = await sheetsGet('HSKPerformance!A:N');
  const existing = rows.slice(1).findIndex(r => r[1] === p.date && ni(r[2]) === p.phoneId);
  const id = existing >= 0 ? ni(rows[existing + 1][0]) : await nextId('HSKPerformance');
  const timestamp = new Date().toISOString();
  const roomsCleaned = p.departuresDone + p.stayoversDone;
  const avgMinsPerRoom = roomsCleaned > 0 ? +(p.minutesWorked / roomsCleaned).toFixed(1) : 0;
  const row = [
    id, p.date, p.phoneId, p.housekeeperName,
    p.roomsAssigned, p.departuresDone, p.stayoversDone, roomsCleaned,
    p.minutesWorked, avgMinsPerRoom,
    p.qualityScore ?? '', p.notes ?? '', p.source ?? 'Manual', timestamp,
  ];
  if (existing >= 0) {
    await sheetsUpdate(`HSKPerformance!A${existing + 2}:N${existing + 2}`, row);
  } else {
    await sheetsAppend('HSKPerformance', row);
  }
  invalidateCache();
  return {
    id, date: p.date, phoneId: p.phoneId, housekeeperName: p.housekeeperName,
    roomsAssigned: p.roomsAssigned, departuresDone: p.departuresDone,
    stayoversDone: p.stayoversDone, roomsCleaned,
    minutesWorked: p.minutesWorked, avgMinsPerRoom,
    qualityScore: p.qualityScore ?? null, notes: p.notes ?? '',
    source: p.source ?? 'Manual', timestamp,
  };
}

export async function deleteHSKPerformance(id: number): Promise<boolean> {
  const row = await findRowByID('HSKPerformance', id);
  if (!row) return false;
  await sheetsClear(`HSKPerformance!A${row}:N${row}`);
  invalidateCache();
  return true;
}

// ─── Aggregated KPIs: performance rolled up per day ───────────────────────────

export async function getHSKDailyKPIs(days = 30): Promise<Array<{
  date: string;
  entries: number;
  teamSize: number;
  totalRoomsAssigned: number;
  totalRoomsCleaned: number;
  totalDepartures: number;
  totalStayovers: number;
  totalMinutes: number;
  avgRoomsPerHK: number;
  avgMinsPerRoom: number | null;
  avgQuality: number | null;
  occupiedRooms: number | null;
  occupancyPct: number | null;
  efficiency: number | null; // rooms per hour
}>> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const [perf, occ] = await Promise.all([
    getHSKPerformance({ fromDate: cutoffStr, limit: 5000 }),
    getOccupancyLogs(days + 5),
  ]);

  // Group performance by date
  const byDate = new Map<string, HSKPerformanceEntry[]>();
  for (const p of perf) {
    const arr = byDate.get(p.date) ?? [];
    arr.push(p);
    byDate.set(p.date, arr);
  }
  const occByDate = new Map(occ.map(o => [o.date, o]));

  return Array.from(byDate.entries()).map(([date, entries]) => {
    const totalRoomsAssigned = entries.reduce((s, e) => s + (e.roomsAssigned || 0), 0);
    const totalRoomsCleaned  = entries.reduce((s, e) => s + e.roomsCleaned, 0);
    const totalDepartures    = entries.reduce((s, e) => s + e.departuresDone, 0);
    const totalStayovers     = entries.reduce((s, e) => s + e.stayoversDone, 0);
    const totalMinutes       = entries.reduce((s, e) => s + e.minutesWorked, 0);
    const qualities          = entries.map(e => e.qualityScore).filter((v): v is number => v != null);
    const occEntry           = occByDate.get(date);
    return {
      date,
      entries: entries.length,
      teamSize: entries.length,
      totalRoomsAssigned,
      totalRoomsCleaned, totalDepartures, totalStayovers, totalMinutes,
      avgRoomsPerHK: entries.length > 0 ? +(totalRoomsCleaned / entries.length).toFixed(1) : 0,
      avgMinsPerRoom: totalRoomsCleaned > 0 ? +(totalMinutes / totalRoomsCleaned).toFixed(1) : null,
      avgQuality: qualities.length > 0 ? +(qualities.reduce((a, b) => a + b, 0) / qualities.length).toFixed(1) : null,
      occupiedRooms: occEntry ? occEntry.occupiedRooms : null,
      occupancyPct: occEntry ? occEntry.occupancyPct : null,
      efficiency: totalMinutes > 0 ? +((totalRoomsCleaned * 60) / totalMinutes).toFixed(2) : null,
    };
  }).sort((a, b) => b.date.localeCompare(a.date));
}

// ════════════════════════════════════════════════════════════════════════════════
// Projects: project management module
// ════════════════════════════════════════════════════════════════════════════════

const PROJECT_HEADERS = [
  'id', 'name', 'client', 'owner', 'status', 'priority',
  'startDate', 'dueDate', 'progress', 'summary', 'notes', 'lastUpdated',
];

const PROJECT_TASK_HEADERS = [
  'id', 'projectId', 'projectName', 'title', 'owner', 'status',
  'priority', 'dueDate', 'notes', 'completedAt', 'lastUpdated',
];

export type ProjectRecord = {
  id: number;
  name: string;
  client: string;
  owner: string;
  status: string;
  priority: string;
  startDate: string | null;
  dueDate: string | null;
  progress: number;
  summary: string;
  notes: string;
  lastUpdated: string;
};

export type ProjectTaskRecord = {
  id: number;
  projectId: number;
  projectName: string;
  title: string;
  owner: string;
  status: string;
  priority: string;
  dueDate: string | null;
  notes: string;
  completedAt: string | null;
  lastUpdated: string;
};

function clampProgress(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function normalizeDate(value?: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function projectRowToRecord(row: string[]): ProjectRecord {
  return {
    id: ni(row[0]),
    name: row[1] ?? '',
    client: row[2] ?? '',
    owner: row[3] ?? '',
    status: row[4] || 'Planning',
    priority: row[5] || 'Medium',
    startDate: normalizeDate(row[6]),
    dueDate: normalizeDate(row[7]),
    progress: clampProgress(ni(row[8])),
    summary: row[9] ?? '',
    notes: row[10] ?? '',
    lastUpdated: row[11] || new Date().toISOString(),
  };
}

function projectToRow(project: ProjectRecord): (string | number | null)[] {
  return [
    project.id,
    project.name,
    project.client,
    project.owner,
    project.status,
    project.priority,
    project.startDate ?? '',
    project.dueDate ?? '',
    clampProgress(project.progress),
    project.summary,
    project.notes,
    new Date().toISOString(),
  ];
}

function taskRowToRecord(row: string[]): ProjectTaskRecord {
  return {
    id: ni(row[0]),
    projectId: ni(row[1]),
    projectName: row[2] ?? '',
    title: row[3] ?? '',
    owner: row[4] ?? '',
    status: row[5] || 'Todo',
    priority: row[6] || 'Medium',
    dueDate: normalizeDate(row[7]),
    notes: row[8] ?? '',
    completedAt: normalizeDate(row[9]),
    lastUpdated: row[10] || new Date().toISOString(),
  };
}

function taskToRow(task: ProjectTaskRecord): (string | number | null)[] {
  return [
    task.id,
    task.projectId,
    task.projectName,
    task.title,
    task.owner,
    task.status,
    task.priority,
    task.dueDate ?? '',
    task.notes,
    task.completedAt ?? '',
    new Date().toISOString(),
  ];
}

export async function initProjectSheets(): Promise<void> {
  await ensureSheet('Projects');
  await ensureSheet('ProjectTasks');
  await sheetsUpdate('Projects!A1:L1', PROJECT_HEADERS);
  await sheetsUpdate('ProjectTasks!A1:K1', PROJECT_TASK_HEADERS);
}

export async function getProjects(): Promise<ProjectRecord[]> {
  const rows = await sheetsGet('Projects!A:L');
  if (rows.length <= 1) return [];
  return rows
    .slice(1)
    .filter(r => r[0] && r[1])
    .map(projectRowToRecord)
    .sort((a, b) => b.lastUpdated.localeCompare(a.lastUpdated));
}

export async function getProjectById(id: number): Promise<ProjectRecord | null> {
  const projects = await getProjects();
  return projects.find(project => project.id === id) ?? null;
}

export async function createProject(input: {
  name: string;
  client?: string;
  owner?: string;
  status?: string;
  priority?: string;
  startDate?: string | null;
  dueDate?: string | null;
  progress?: number;
  summary?: string;
  notes?: string;
}): Promise<ProjectRecord> {
  const id = await nextId('Projects');
  const project: ProjectRecord = {
    id,
    name: input.name.trim(),
    client: input.client?.trim() ?? '',
    owner: input.owner?.trim() ?? '',
    status: input.status?.trim() || 'Planning',
    priority: input.priority?.trim() || 'Medium',
    startDate: normalizeDate(input.startDate),
    dueDate: normalizeDate(input.dueDate),
    progress: clampProgress(Number(input.progress ?? 0)),
    summary: input.summary?.trim() ?? '',
    notes: input.notes?.trim() ?? '',
    lastUpdated: new Date().toISOString(),
  };
  await sheetsAppend('Projects', projectToRow(project));
  invalidateCache();
  return project;
}

export async function updateProject(id: number, input: Partial<Omit<ProjectRecord, 'id' | 'lastUpdated'>>): Promise<ProjectRecord | null> {
  const existing = await getProjectById(id);
  if (!existing) return null;
  const rowNumber = await findRowByID('Projects', id);
  if (!rowNumber) return null;

  const project: ProjectRecord = {
    ...existing,
    name: input.name != null ? input.name.trim() : existing.name,
    client: input.client != null ? input.client.trim() : existing.client,
    owner: input.owner != null ? input.owner.trim() : existing.owner,
    status: input.status != null ? input.status.trim() : existing.status,
    priority: input.priority != null ? input.priority.trim() : existing.priority,
    startDate: input.startDate !== undefined ? normalizeDate(input.startDate) : existing.startDate,
    dueDate: input.dueDate !== undefined ? normalizeDate(input.dueDate) : existing.dueDate,
    progress: input.progress != null ? clampProgress(Number(input.progress)) : existing.progress,
    summary: input.summary != null ? input.summary.trim() : existing.summary,
    notes: input.notes != null ? input.notes.trim() : existing.notes,
    lastUpdated: new Date().toISOString(),
  };

  await sheetsUpdate(`Projects!A${rowNumber}:L${rowNumber}`, projectToRow(project));
  invalidateCache();
  return project;
}

export async function getProjectTasks(opts?: {
  projectId?: number;
  status?: string;
  limit?: number;
}): Promise<ProjectTaskRecord[]> {
  const rows = await sheetsGet('ProjectTasks!A:K');
  if (rows.length <= 1) return [];
  let tasks = rows
    .slice(1)
    .filter(r => r[0] && r[3])
    .map(taskRowToRecord);

  if (opts?.projectId) tasks = tasks.filter(task => task.projectId === opts.projectId);
  if (opts?.status) tasks = tasks.filter(task => task.status === opts.status);

  tasks = tasks.sort((a, b) => {
    const aDone = a.status === 'Done' ? 1 : 0;
    const bDone = b.status === 'Done' ? 1 : 0;
    if (aDone !== bDone) return aDone - bDone;
    return b.lastUpdated.localeCompare(a.lastUpdated);
  });

  return tasks.slice(0, opts?.limit ?? 500);
}

export async function getProjectTaskById(id: number): Promise<ProjectTaskRecord | null> {
  const tasks = await getProjectTasks();
  return tasks.find(task => task.id === id) ?? null;
}

export async function createProjectTask(input: {
  projectId: number;
  title: string;
  owner?: string;
  status?: string;
  priority?: string;
  dueDate?: string | null;
  notes?: string;
}): Promise<ProjectTaskRecord> {
  const project = await getProjectById(input.projectId);
  if (!project) throw new Error('Project not found');

  const id = await nextId('ProjectTasks');
  const now = new Date().toISOString();
  const status = input.status?.trim() || 'Todo';
  const task: ProjectTaskRecord = {
    id,
    projectId: input.projectId,
    projectName: project.name,
    title: input.title.trim(),
    owner: input.owner?.trim() ?? '',
    status,
    priority: input.priority?.trim() || 'Medium',
    dueDate: normalizeDate(input.dueDate),
    notes: input.notes?.trim() ?? '',
    completedAt: status === 'Done' ? now : null,
    lastUpdated: now,
  };

  await sheetsAppend('ProjectTasks', taskToRow(task));
  invalidateCache();
  await recomputeProjectProgress(task.projectId);
  return task;
}

export async function updateProjectTask(id: number, input: Partial<Omit<ProjectTaskRecord, 'id' | 'projectId' | 'projectName' | 'lastUpdated'>>): Promise<ProjectTaskRecord | null> {
  const existing = await getProjectTaskById(id);
  if (!existing) return null;
  const rowNumber = await findRowByID('ProjectTasks', id);
  if (!rowNumber) return null;

  const nextStatus = input.status != null ? input.status.trim() : existing.status;
  const completedAt = nextStatus === 'Done'
    ? (existing.completedAt ?? new Date().toISOString())
    : null;

  const task: ProjectTaskRecord = {
    ...existing,
    title: input.title != null ? input.title.trim() : existing.title,
    owner: input.owner != null ? input.owner.trim() : existing.owner,
    status: nextStatus,
    priority: input.priority != null ? input.priority.trim() : existing.priority,
    dueDate: input.dueDate !== undefined ? normalizeDate(input.dueDate) : existing.dueDate,
    notes: input.notes != null ? input.notes.trim() : existing.notes,
    completedAt,
    lastUpdated: new Date().toISOString(),
  };

  await sheetsUpdate(`ProjectTasks!A${rowNumber}:K${rowNumber}`, taskToRow(task));
  invalidateCache();
  await recomputeProjectProgress(task.projectId);
  return task;
}

async function recomputeProjectProgress(projectId: number): Promise<void> {
  const [project, tasks] = await Promise.all([
    getProjectById(projectId),
    getProjectTasks({ projectId }),
  ]);
  if (!project) return;
  const progress = tasks.length === 0
    ? project.progress
    : clampProgress((tasks.filter(task => task.status === 'Done').length / tasks.length) * 100);
  await updateProject(projectId, { progress });
}

function isOverdue(dueDate: string | null, status: string): boolean {
  if (!dueDate || status === 'Done' || status === 'Completed') return false;
  return dueDate < new Date().toISOString().slice(0, 10);
}

export async function getProjectsDashboard() {
  const [projects, tasks] = await Promise.all([getProjects(), getProjectTasks()]);

  const activeProjects = projects.filter(project => !['Done', 'Completed', 'Archived'].includes(project.status));
  const overdueTasks = tasks.filter(task => isOverdue(task.dueDate, task.status));
  const doneTasks = tasks.filter(task => task.status === 'Done').length;
  const inFlightTasks = tasks.filter(task => ['Todo', 'In Progress', 'Blocked'].includes(task.status)).length;
  const avgProgress = projects.length > 0
    ? Math.round(projects.reduce((sum, project) => sum + project.progress, 0) / projects.length)
    : 0;

  const projectSummaries = projects.map(project => {
    const projectTasks = tasks.filter(task => task.projectId === project.id);
    const completed = projectTasks.filter(task => task.status === 'Done').length;
    const overdue = projectTasks.filter(task => isOverdue(task.dueDate, task.status)).length;
    return {
      ...project,
      taskCount: projectTasks.length,
      completedTasks: completed,
      overdueTasks: overdue,
      openTasks: projectTasks.length - completed,
    };
  }).sort((a, b) => {
    const aOverdue = a.overdueTasks > 0 ? 1 : 0;
    const bOverdue = b.overdueTasks > 0 ? 1 : 0;
    if (aOverdue !== bOverdue) return bOverdue - aOverdue;
    return b.lastUpdated.localeCompare(a.lastUpdated);
  });

  const recentTasks = [...tasks]
    .sort((a, b) => b.lastUpdated.localeCompare(a.lastUpdated))
    .slice(0, 12);

  return {
    kpis: {
      totalProjects: projects.length,
      activeProjects: activeProjects.length,
      totalTasks: tasks.length,
      inFlightTasks,
      overdueTasks: overdueTasks.length,
      avgProgress,
      doneTasks,
    },
    projects: projectSummaries,
    recentTasks,
  };
}


// ─── Batch occupancy import ────────────────────────────────────────────────────

/**
 * Import many occupancy records in a single Google Sheets API call.
 * Skips dates that already exist. Returns count of rows actually written.
 */
export async function batchSaveOccupancyLogs(logs: OccupancyInput[]): Promise<number> {
  if (logs.length === 0) return 0;

  // Read existing sheet to find duplicate dates and next available row
  const existing = await sheetsGet('Occupancy!A:B');
  const existingDates = new Set(existing.slice(1).map(r => r[1] ?? ''));

  // Next ID = max existing ID + 1
  const ids = existing.slice(1).map(r => parseInt(r[0] ?? '0')).filter(n => !isNaN(n) && n > 0);
  let nextIdVal = ids.length === 0 ? 1 : Math.max(...ids) + 1;

  // Next empty row in sheet (1-indexed): header is row 1, existing data fills rows 2..N
  // existing.length includes the header row, so next data row = existing.length + 1
  const startRow = existing.length + 1;

  const timestamp = new Date().toISOString();
  const rows: (string | number | null)[][] = [];

  for (const log of logs) {
    if (existingDates.has(log.date)) continue; // skip duplicates
    rows.push([
      nextIdVal++,
      log.date,
      log.occupiedRooms,
      TOTAL_ROOMS,
      log.notes ?? '',
      timestamp,
      log.arrivals ?? '',
      log.departures ?? '',
      log.stayovers ?? '',
      log.houseUse ?? '',
      log.dayUse ?? '',
      log.noShow ?? '',
      log.ooo ?? '',
      log.adr ?? '',
      log.roomRevenue ?? '',
      log.source ?? 'Opera-Import',
    ]);
  }

  if (rows.length === 0) return 0;

  // Write to exact computed range using PUT — avoids :append table-detection issues
  const endRow = startRow + rows.length - 1;
  const range = `Occupancy!A${startRow}:P${endRow}`;
  await sheetsWriteRows(range, rows);
  return rows.length;
}
