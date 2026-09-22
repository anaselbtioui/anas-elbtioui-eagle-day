<p align="center">
  <img src="docs/assets/logo.svg" alt="Med Assurance" width="112" height="112" />
</p>

# Med Assurance

Guide après accident auto au Maroc: sécurité et preuves sur place, déclaration plus tard via le courtier. Le desk courtier travaille sur les mêmes dossiers.

Ce prototype **ne décide pas** la faute, la garantie, ni l'indemnisation.

Eagle Day hackathon · 3ᵉ place

[Live demo](https://anas-elbtioui-eagle-day.vercel.app) · [GitHub](https://github.com/anaselbtioui/anas-elbtioui-eagle-day)

## Two sides, one file

| Who | Job |
| --- | --- |
| Automobiliste | NOW (roadside evidence pack) · LATER (send to broker) · Assistance |
| Courtier | Queue, piece requests, human drafts, insurer handoff |

Same dossier ids on both sides.

## Try the demo (~2 min)

1. Open the live URL and pick Automobiliste or Courtier.
2. Sign up (any email, password ≥ 8 characters).
3. Motorist: onboarding → home → NOW or LATER.
   Broker: `/desk` queue after a motorist sends a dossier (same broker in onboarding).

Use two browser profiles (or normal + private) for motorist and broker together.

## Local

```bash
pnpm install
pnpm dev        # API :8787 + Vite :5173
```

Split: `pnpm dev:api` / `pnpm dev:web`.

Optional: `VITE_API_URL=http://127.0.0.1:8787`. Reset store with `ALLOW_RESET=1 pnpm reset:db`.

## Stack

React 19 · Vite · TypeScript · Tailwind v4 · Zustand · i18next (FR) · Hono · Supabase · PWA · Capacitor

Monorepo: `apps/web`, `apps/api`, `packages/domain`.

## Docs

| Folder | Contents |
| --- | --- |
| [docs/product](docs/product/) | Models, API, frontend contract, procedure |
| [docs/hackathon](docs/hackathon/) | Participant guide, submission checklist, test notes |
| [docs/screenshots](docs/screenshots/) | Demo captures |

## Known limits

- Mock OTP. Photos cache on-device, then upload to Storage. Portal import is simulation.
- No fault, coverage, or payout fields.
