# Med Assurance

**Guide après accident auto au Maroc** — sécurité et preuves sur place, déclaration plus tard via le courtier. Desk courtier sur les mêmes dossiers. Le prototype **ne décide pas** faute, garantie, ni indemnisation.

> Eagle Day hackathon · 3ᵉ place

**Live demo:** https://anas-elbtioui-eagle-day.vercel.app  
**GitHub:** https://github.com/anaselbtioui/anas-elbtioui-eagle-day

## What you built (two sides, one file)

| Who | What |
|---|---|
| **Automobiliste** | NOW (roadside) → pack de preuves · LATER → déclaration au courtier · Assistance contrat |
| **Courtier** | File de dossiers, demandes de pièces, brouillons humains, transmission assureur |

Same dossier ids on both sides.

## Try the demo (2 min)

1. Open the live URL → pick **Automobiliste** or **Courtier**.
2. Sign up (any email / password ≥ 8 chars).
3. Motorist: short onboarding → home (accidents) → NOW or LATER.  
   Broker: `/desk` queue → open a dossier after a motorist has sent one (pick the same broker in onboarding).

Tip: use two browser profiles (or normal + private) for motorist + broker.

## Stack

React 19 · Vite · TypeScript · Tailwind v4 · Zustand · i18next (FR) · Hono · Supabase · PWA · Capacitor shells.

## Local

```bash
npm install
npm run server   # API :8787
npm run dev      # Vite :5173
```

Optional: `VITE_API_URL=http://127.0.0.1:8787`. `ALLOW_RESET=1` + `npm run reset:db` for a clean local store.

## Known limits (by design / prototype)

- Mock OTP; photos stay on-device; import portail = simulation.
- No fault / coverage / payout fields.
- See [`docs/`](docs/) for procedure notes and API contract.
