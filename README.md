# Med Assurance

Mobile-first PWA for Moroccan motor accidents + courtier desk. Same dossier ids across both sides. Prototype does **not** decide fault, coverage, or payout.

## Stack

React 19 · Vite · TypeScript · Tailwind v4 · shadcn/ui · Zustand · i18next (FR) · Hono API · Supabase (optional) · PWA · Capacitor shells.

## Local

```bash
npm install
npm run server   # API on :8787 (JSON store without .env)
npm run dev      # Vite on :5173 — set VITE_API_URL=http://127.0.0.1:8787 if needed
npm test
npm run lint:copy
npm run test:e2e
npm run build
```

Playwright starts API + Vite via `webServer`. `ALLOW_RESET=1` for local reset.

## Walkthrough

1. **Role picker** — Automobiliste or Courtier, then sign up / sign in.
2. **Auth** — signup / signin (JWT). Brokers land on `/desk`; motorists on Phase 1 onboarding then home.
3. **Automobiliste home** — three doors: NOW / LATER / Assistance. Quiet *Changer de rôle*.
4. **NOW** — Tout va bien ? → injury STOP (19) **or** other driver → constat → tap-car → photos → driveable → pack saved. Offline writes queue and replay.
5. **LATER** — pieces + facts → check-answers → confirm → send to broker. Tracking timeline + add piece. Contacts for broker on send.
6. **Courtier desk** — queue (search / status / mes dossiers) → fiche → request piece → editable human-gated draft → handoff to insurer. Timeline events. `/desk/import` simulated browser import.

## Screenshots

[`docs/screenshots/`](docs/screenshots/) — role picker, onboarding, home, NOW stop, LATER, desk queue/fiche (desktop).

## Known gaps

- OTP is mock; photos stay local (data URLs / IndexedDB); no real portal login for import.
- Serverless whole-DB write still last-write-wins under heavy concurrency; row upserts for desk/dossiers/evidences mitigate part of it.
- iOS Capacitor build needs macOS + Xcode; Android scaffold via `npm run cap:add:android` then `cap:sync`.
- No coverage / fault / payout fields by design.

## Backend

`src/services/api.ts` → `httpApi`. Vercel: `api/[[...route]].ts` + env `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`. Docs: [`docs/api.md`](docs/api.md), [`docs/frontend-contract.md`](docs/frontend-contract.md).

## Brand

Med Assurance lockup `public/brand/med-assurance-logo.png`; icon unchanged. Fonts Baloo 2 / Baloo Bhaijaan 2.
