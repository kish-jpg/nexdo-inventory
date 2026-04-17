/**
 * app/api/chat/route.ts
 *
 * Gemini-powered inventory assistant.
 * Fetches live stock context from Google Sheets, builds a system prompt,
 * and streams Gemini 2.0 Flash responses back to the client.
 */

import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getDashboardStats, getItems } from '@/lib/sheets';

export const dynamic = 'force-dynamic';

// ─── System Prompt ────────────────────────────────────────────────────────────

const SYSTEM_BASE = `You are an AI inventory assistant for the housekeeping team at Radisson RED Auckland hotel, New Zealand.

PROPERTY CONTEXT:
- Hotel: Radisson RED Auckland (322 rooms total)
- Room types: King Urban, Twin Urban, King Premium, Suite
- Key linen supplier: Sincerely Laundry — daily order cutoff 09:00 NZT
- Other suppliers: Astro (bedding, amenity kits), BUNZL (consumables), Anchor, JVD, Pasabahce
- Managed by: Kish (Housekeeping Manager)

YOUR CAPABILITIES:
- Answer questions about current stock levels, reorder status, and shortages
- Help draft supplier orders grouped by supplier, formatted for copy-paste
- Calculate linen requirements from room occupancy (departures × linen recipe)
- Suggest reorder quantities based on PAR levels and current stock
- Explain consumption trends and flag critical items

RESPONSE GUIDELINES:
- Be concise and direct — this is an operational tool used on shift
- Always include specific numbers when discussing stock
- For supplier orders, format with *Supplier Name* as header, then bullet items with quantities
- When drafting WhatsApp messages, use *bold* markdown syntax
- If data is unavailable for a specific item, say so clearly — never guess stock numbers
- Keep responses focused; avoid unnecessary preamble`;

// ─── Context Builder ──────────────────────────────────────────────────────────

async function buildInventoryContext(): Promise<string> {
  try {
    const [stats, items] = await Promise.all([
      getDashboardStats(),
      getItems(),
    ]);

    const nztTime = new Date().toLocaleString('en-NZ', {
      timeZone: 'Pacific/Auckland',
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });

    // Critical items (red status)
    const criticalItems = items.filter(i => i.status === 'red');
    const critText = criticalItems.length > 0
      ? criticalItems
          .map(i => `  • ${i.name} [${i.itemCode ?? '—'}]: ${i.stock} on hand (target: ${i.targetStock}${i.supplier ? ', supplier: ' + i.supplier : ''})`)
          .join('\n')
      : '  None at critical level ✓';

    // Reorder list
    const reorderText = stats.reorderList.length > 0
      ? stats.reorderList
          .map(i =>
            `  • ${i.name} (${i.category}): stock=${i.stock}, target=${i.targetStock}, ` +
            `reorder qty=${i.reorderQty ?? i.shortage} — ${i.status === 'red' ? '🔴 CRITICAL' : '🟡 LOW'}`
          )
          .join('\n')
      : '  All items above reorder threshold ✓';

    // Category health
    const catHealthText = stats.categoryHealth
      .map(c => `  • ${c.name}: ${c.stockPct}% of target across ${c.count} items`)
      .join('\n');

    // Supplier breakdown for reorder items
    const supplierMap: Record<string, string[]> = {};
    for (const item of items) {
      if ((item.status === 'red' || item.status === 'amber') && item.supplier) {
        if (!supplierMap[item.supplier]) supplierMap[item.supplier] = [];
        supplierMap[item.supplier].push(
          `${item.name}: need ${item.reorderQty ?? Math.max(0, item.targetStock - item.stock)}`
        );
      }
    }
    const supplierText = Object.entries(supplierMap).length > 0
      ? Object.entries(supplierMap)
          .map(([s, items]) => `  ${s}: ${items.join(', ')}`)
          .join('\n')
      : '  No outstanding supplier orders needed';

    return `

LIVE INVENTORY SNAPSHOT (${nztTime} NZT):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total items tracked: ${stats.kpis.total}
Stock OK (green): ${stats.kpis.green} | Low stock (amber): ${stats.kpis.amber} | Critical (red): ${stats.kpis.red}
Items needing reorder: ${stats.kpis.needsReorder}

CRITICAL STOCK (immediate action needed):
${critText}

FULL REORDER LIST (${stats.reorderList.length} items):
${reorderText}

CATEGORY HEALTH:
${catHealthText}

SUPPLIER BREAKDOWN (low/critical items):
${supplierText}`;
  } catch {
    return '\n\nNote: Live inventory data temporarily unavailable — Google Sheets connection issue.';
  }
}

// ─── Key registry — tried in order until one works ───────────────────────────

const API_KEYS = [
  { envVar: 'GEMMA_4_KEY',    model: 'gemini-2.0-flash' },
  { envVar: 'GEMINI_API_KEY', model: 'gemini-2.0-flash' },
] as const;

// ─── Attempt one streaming call with a given key + model ──────────────────────

async function tryStream(
  apiKey: string,
  modelName: string,
  systemPrompt: string,
  history: { role: string; parts: { text: string }[] }[],
  lastUserMessage: string,
): Promise<ReadableStream<Uint8Array>> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: systemPrompt,
  });

  const chat = model.startChat({ history });
  const result = await chat.sendMessageStream(lastUserMessage);

  return new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of result.stream) {
          const text = chunk.text();
          if (text) controller.enqueue(new TextEncoder().encode(text));
        }
      } catch (err: any) {
        controller.enqueue(
          new TextEncoder().encode(`\n\n[Stream error: ${err.message}]`)
        );
      } finally {
        controller.close();
      }
    },
  });
}

// ─── Route Handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const messages: { role: 'user' | 'model'; content: string }[] = body.messages ?? [];
    const role: string = body.role ?? 'radisson';

    if (!messages.length) {
      return NextResponse.json({ error: 'No messages provided' }, { status: 400 });
    }

    // Resolve available keys in priority order
    const candidates = API_KEYS
      .map(k => ({ ...k, key: process.env[k.envVar] }))
      .filter(k => !!k.key);

    if (candidates.length === 0) {
      return NextResponse.json(
        { error: 'No API key configured. Add GEMMA_4_KEY or GEMINI_API_KEY in Vercel env vars.' },
        { status: 500 }
      );
    }

    // Build inventory context
    const contextBlock = await buildInventoryContext();
    const systemPrompt =
      SYSTEM_BASE +
      contextBlock +
      `\n\nUSER ROLE: ${role} (${
        role === 'admin' ? 'full access' : role === 'nexdo' ? 'NexDo staff' : 'Radisson housekeeping'
      })`;

    const history = messages.slice(0, -1).map(m => ({
      role: m.role,
      parts: [{ text: m.content }],
    }));
    const lastUserMessage = messages[messages.length - 1].content;

    // Try each key in order — fall through to next on failure
    let lastError: Error | null = null;
    for (const candidate of candidates) {
      try {
        const stream = await tryStream(
          candidate.key!,
          candidate.model,
          systemPrompt,
          history,
          lastUserMessage,
        );

        return new Response(stream, {
          headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Cache-Control': 'no-cache, no-store',
            'X-Accel-Buffering': 'no',
            'X-AI-Key': candidate.envVar, // useful for debugging in Vercel logs
          },
        });
      } catch (err: any) {
        lastError = err;
        // Log which key failed, then try the next one
        console.warn(`[chat] ${candidate.envVar} failed: ${err.message} — trying next key`);
      }
    }

    // All keys exhausted
    return NextResponse.json(
      { error: `All API keys failed. Last error: ${lastError?.message}` },
      { status: 502 }
    );
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
