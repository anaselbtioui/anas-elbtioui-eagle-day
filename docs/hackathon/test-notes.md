# Test notes — Med Assurance

## Failure then fix

1. Injury path in `_old` allowed continuing past the banner — rejected. **Fix:** `yes` / `unknown` → STOP only (no Continuer). Same for refuses / fled / unknown other driver.
2. `_old` mixed motorist + broker nav. **Fix:** role picker first; desk under `/desk` only.
3. Shared `motoristId: 'M-1'` made every device Nadia on shared Supabase. **Failed attempt** in early wallet hardcode. **Fix (D1):** per-device `M-<uuid>` / `V-` / `P-` ids on signup + local migration.
4. Demo `emptyDb()` wiped live motorist data. **Fix (A2):** merge seeds; `/api/reset` gated.
5. Vercel SPA rewrite swallowed `/api`. **Fix (A1):** exclude `/api/(.*)` + `api/[[...route]].ts`.

## Cases run

| Case | Path | Result |
|---|---|---|
| Marrakech injury | NOW → blessé | STOP, tel:19 |
| Material pack | NOW → coopère → pack | Pack saved, CTA LATER |
| LATER → desk | Motorist send → broker queue | Same dossier id |
| Broker Nadia | Courtier → DOS-1 | Constat gap |
| Request + draft | Demander pièce → brouillon | Approve only after human checkbox |
| Handoff | Fiche with gaps | CTA disabled / 409 |
| Auth gate | Role → signup | JWT session |

## Commands

```bash
pnpm test
pnpm lint:copy
pnpm build
ALLOW_RESET=1 pnpm test:e2e
```

Screenshots: `pnpm exec playwright test e2e/screenshots.spec.ts`.
