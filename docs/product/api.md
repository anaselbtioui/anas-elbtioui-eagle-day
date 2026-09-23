# Labas HTTP API

Local motorist backend. Domain: [models.md](models.md). No coverage / fault / payout fields.

Default: `http://127.0.0.1:8787`

Vite proxies `/api` in `pnpm dev` so the UI can call same-origin `/api/...`.

Photos: browser IndexedDB cache + upload to private Supabase Storage bucket `evidence` via `POST /api/packs/:id/photos` (service role). Signed read: `GET /api/packs/:id/photos/:photoId/url`. API still stores **metadata only** (`storagePath` on photo meta).

## Database (Supabase)

CLI is in the repo (`supabase/`). Schema: `supabase/migrations/` (domain + `desk_files`).

Hono talks to Postgres with the **service role** (bypasses RLS). Anon has no policies — browser must not use the service key.

**Local (daily):** Docker + `supabase start`. API URL `http://127.0.0.1:54321`. Keys from `supabase status -o env`. Written to gitignored `.env`.

**Vercel (ship):** hosted project `labas` (`okwluptyaarwqugpdvbn`). Set `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` in Vercel, then `supabase db push` so cloud schema matches.

1. `supabase start` (once Docker is up)
2. `pnpm --filter @labas/api start`
3. Studio: http://127.0.0.1:54323

## Run

```bash
pnpm --filter @labas/api start
```

Health: `GET /health`

## Feature coverage

| Product surface | Endpoints |
|---|---|
| Onboarding / wallet | `GET/PUT /api/profile`, `POST /api/profile/demo` |
| Home resume | `GET /api/session`, `GET /api/packs?motoristId=` |
| NOW pack | `POST /api/packs`, `GET/PUT/PATCH /api/packs/:id` |
| Assist door (immobilised) | `POST /api/packs` `{ vehicleImmobilised: true }`, `GET /api/contacts` |
| Directory inside doors | `GET /api/contacts?assistanceOnContract=` |
| LATER draft + send | `PUT /api/declarations/:incidentId`, `POST .../submit` |
| LATER tracking | `GET /api/files/:incidentId`, `GET /api/dossiers?incidentId=` |
| Add docs after send | `POST /api/packs/:id/pieces` (syncs dossier) |
| Broker desk | `GET /api/broker/queue`, `GET /api/broker/dossiers/:id`, requests / drafts / tasks / owner / handoff; `DeskBundle.events` timeline |

Out of HTTP: auth/session tokens beyond Labas JWT, insurer API.

## Routes

| Method | Path | Notes |
|---|---|---|
| GET | `/api/session?motoristId=` | Profile + packs + files (home bootstrap) |
| GET | `/api/profile?motoristId=` | Wallet: motorist + vehicle + policy + insurer + broker |
| PUT | `/api/profile` | Upsert wallet |
| POST | `/api/profile/demo` | Reset to Nadia wallet |
| GET | `/api/contacts?assistanceOnContract=` | Hide assistance when `no` |
| GET | `/api/packs?motoristId=` | Pack history, newest first |
| POST | `/api/packs` | New incident + empty evidence. Optional `{ injury, vehicleImmobilised, city, workCommute }` |
| GET | `/api/packs/:incidentId` | Evidence pack |
| PUT | `/api/packs/:incidentId` | Save pack; applies PV STOP rules; refreshes linked dossier |
| PATCH | `/api/packs/:incidentId` | Merge incident / otherParty / evidence |
| POST | `/api/packs/:incidentId/pieces` | Append photos / set constat or PV; return file + synced dossier |
| GET | `/api/files/:incidentId` | Pack + declaration + dossier (LATER door) |
| PUT | `/api/declarations/:incidentId` | Draft déclaration + dossier |
| POST | `/api/declarations/:incidentId/submit` | **409** if no complete constat and no obtained PV |
| GET | `/api/dossiers?incidentId=` | Dossier by incident |
| GET | `/api/dossiers/:declarationId` | Tracking by déclaration id |
| GET | `/api/broker/queue` | `DeskBundle[]` — same dossier ids as motorist; includes `events[]` |
| GET | `/api/broker/dossiers/:dossierId` | Full fiche + provenance + tasks + `events` timeline |
| POST | `/api/broker/dossiers/:dossierId/requests` | `{ piece, note }` → `waiting_motorist`; appends desk event |
| POST | `/api/broker/dossiers/:dossierId/drafts` | `{ intent, pieceLabel? }` — local draft, no send; event logged |
| PATCH | `/api/broker/dossiers/:dossierId/drafts/:draftId` | `{ humanApproved?, body? }` — editing `body` resets human gate |
| POST | `/api/broker/dossiers/:dossierId/drafts/:draftId/approve` | **409** `not_human_approved` |
| POST | `/api/broker/dossiers/:dossierId/tasks/:taskId/toggle` | Desk checklist; appends event |
| POST | `/api/broker/dossiers/:dossierId/owner` | `{ owner }` — desk référent; appends event |
| POST | `/api/broker/dossiers/:dossierId/handoff` | `with_insurer` if no `missingPieces`; **409** `has_gaps` otherwise |
| POST | `/api/demo/nadia` | Casablanca, constat missing |
| POST | `/api/demo/sara` | Marrakech injury, `pv: required` |
| POST | `/api/reset` | Empty DB + Nadia profile |

## Submit rule

```
canSubmit = evidence.constat === "complete" || evidence.pv === "obtained"
```

Blocked dossier: `status: blocked_missing_evidence`, `missingPieces` includes `constat_or_pv`.

After submit, missing photos/policy keep `waiting_motorist`. Adding pieces later can move it to `with_broker` / `with_insurer`.

Broker drafts never leave the app. Handoff only records `with_insurer` — not a coverage decision.

### Desk events

`DeskFile.events` / `DeskBundle.events` — append-only timeline (`DeskEvent`: `id`, `at`, `actor: motorist|broker|system`, `label`, `motoristVisible`).

Logged on submit, document request, draft create/approve, task toggle, owner change, handoff, and motorist add-piece. Motorist LATER tracking shows only `motoristVisible: true` rows.

## Frontend

`apps/web/src/services/api.ts` — `LabasApi` interface.  
`apps/web/src/services/http-api.ts` — `httpApi` implementation.

Phase 0 UI may keep Zustand local; swap to `httpApi` when the NOW door is ready to persist.

## Latency ledger

Measured against production with curl, 5 samples, median. Reads = `GET /api/profile`; writes = `PUT /api/packs/:id`. Budget: reads < 300 ms, writes < 500 ms.

| Date | Change | Reads | Writes | Verdict |
| --- | --- | --- | --- | --- |
| 2026-09-23 | Baseline: lambda in `iad1`, Supabase in `eu-west-1`, 16 sequential upserts per save | 0.24 s | 1.93 s | — |
| 2026-09-23 | `saveDb` nested `withWriteLock` inside `exclusiveDbWrite` (deadlock, 30 s timeout on every write) | — | 30 s | fixed |
| 2026-09-23 | `vercel.json` `regions: ["dub1"]` | 0.17 s | 0.47 s | kept |
| 2026-09-23 | Upserts parallel per FK tier (6 round trips instead of 16) | 0.17 s | 0.30 s | kept |

Remaining write cost is one `loadDb` (13 parallel selects) plus 6 upsert tiers. Next candidate, only if measured over budget: upsert only the tables the mutation touched.
