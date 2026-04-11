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

// ─── Read Cache (5-second TTL — avoids repeated reads in the same request) ────

const readCache = new Map<string, { data: string[][]; exp: number }>();

function cacheGet(key: string): string[][] | null {
  const entry = readCache.get(key);
  if (entry && Date.now() < entry.exp) return entry.data;
  readCache.delete(key);
  return null;
}

function cacheSet(key: string, data: string[][]): void {
  readCache.set(key, { data, exp: Date.now() + 5_000 });
}

export function invalidateCache(): void {
  readCache.clear();
}

// ─── Raw Sheets API Helpers ───────────────────────────────────────────────────

const BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

async function sheetsGet(range: string): Promise<string[][]> {
  const cached = cacheGet(range);
  if (cached) return cached;

  const token = await getAccessToken();
  const id = getEnv('GOOGLE_SHEET_ID');
  const res = await fetch(`${BASE}/${id}/values/${encodeURIComponent(range)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json() as any;
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

// ─── Sheet Init ───────────────────────────────────────────────────────────────

export async function initSheets(): Promise<void> {
  await ensureSheet('Items');
  await ensureSheet('Categories');
  await ensureSheet('Transactions');

  // Write headers (row 1 of each sheet)
  await sheetsUpdate('Items!A1:P1', ITEM_HEADERS);
  await sheetsUpdate('Categories!A1:B1', CATEGORY_HEADERS);
  await sheetsUpdate('Transactions!A1:H1', TX_HEADERS);
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
  stock: number; target: number; reorderPt: number; reorderQty: number;
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
      item.reorderPt, item.reorderQty, status,
      '', '', '', now, // supplier, unitCost, location, lastUpdated
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
