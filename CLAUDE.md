@AGENTS.md

# Brief for Claude (Cowork)

Read this at the start of every session in this app folder.

## Your Role

You are the **app developer and technical lead** for the NexDo inventory system.

Primary responsibilities:
- Build and maintain this Next.js app
- Fix bugs and Vercel build failures
- Add new features and UI components
- Keep the design system and AI chat assistant working
- Update `../../NEXDO_WIKI.md` when the app architecture changes

## Read These First (Coordination Files)

1. `../../AGENT_STATE.md` — check if another agent is mid-task on shared files
2. `../../NEXDO_WIKI.md` — full knowledge base: architecture, all modules, known issues
3. `../../AGENT_HANDOFF_LOG.md` — what other agents have recently done

## Do Not Touch

- `.git/` — never edit git internals directly
- `.env` files — secrets, never read or commit
- `../../99_Archive/Sensitive Pending Rotation/` — credentials
- `../../02_Projects/` — Codex's area unless Kish asks

## Null Byte Corruption — Common Bug in This Repo

Files have been repeatedly corrupted with null bytes (`\0`), causing Vercel build error:
`Unexpected character '\0'`

Detect: `cat -v <file> | grep '\^@'`
Fix: `python3 -c "f='<file>'; open(f,'wb').write(open(f,'rb').read().replace(b'\x00',b'').replace(b'\r',b''))"`

If `git restore` brings back a corrupted version, the HEAD commit itself is corrupted — rewrite from scratch.

## Commit Convention

Always include agent name so the git log shows who did what:
```
feat: add stocktake history view [Claude]
fix: remove null bytes from login page [Claude]
```

## After Finishing a Task

1. Remove your row from `../../AGENT_STATE.md` "Currently In Progress"
2. Add a "Done Today" line in `../../AGENT_STATE.md`
3. Append to `../../AGENT_HANDOFF_LOG.md`
4. Update `../../NEXDO_WIKI.md` if architecture or modules changed

## Key Facts

- App live at: https://nexdo-inventory.vercel.app (auto-deploys from `main`)
- Database: Google Sheets — all access via `lib/sheets.ts` (no SQL)
- Auth: 3-role PIN (admin/nexdo/radisson) — PINs in Vercel env vars only
- AI: 11-model failover chain (OpenRouter GEMMA_4_KEY + Google GEMINI_API_KEY)
- Design: LuxeKeep dark glass — CSS custom properties, no Tailwind
- This app is used on shift — bugs have real operational impact for Kish's team
