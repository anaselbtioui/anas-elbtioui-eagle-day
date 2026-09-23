# Frontend contract (Labas ↔ domain)

Bridge for the Labas UI agent and anyone implementing stores/API. Domain truth: [models.md](models.md). Process truth: [standard-procedure.md](standard-procedure.md).

Do not invent coverage, fault, or payout fields in UI state.

---

## Stack assumption (from Labas plan)

Vite + React 19 + TypeScript in `apps/web`. Zustand persist for profile / packs. Photo blobs in IndexedDB. `apps/web/src/services/api.ts` (`LabasApi`) + `apps/web/src/services/http-api.ts`. Local API: `pnpm --filter @labas/api start` on :8787; Vite proxies `/api`. See [api.md](api.md).

Docs stay under `docs/`. `_old/` is reference / fixtures only — not the product shell.

---

## i18n (UI languages)

- Locales: `fr` (fallback) + `en`. Copy lives in `apps/web/src/i18n/{fr,en}/common.json`.
- Detection order (browser): `?lng=` query → `localStorage` → `navigator` → `fr`.
- Override for demos/jury: open `/?lng=en` (cached in `localStorage` as `i18nextLng`).
- `document.documentElement.lang` tracks the active language.
- **Stays French on purpose:** server-stored desk/timeline/`nextHumanStep` strings (domain + API), and constat / aide-mémoire PDFs (`accident-docs.ts`) — Moroccan legal form.
- Vitest forces `lng: 'fr'`. Playwright pins `locale: 'fr-MA'` so FR e2e selectors stay stable.

---

## Three doors + role picker

First visit: role picker (Automobiliste vs Courtier). Two products, not one nav.

| Home door (FR copy) | Product entry | Domain writes |
|---|---|---|
| Je viens d'avoir un accident | Motorist NOW | `Incident`, `OtherParty`, `Evidence` |
| Déclarer un sinistre | Motorist LATER | `Declaration`, `Dossier` (reads evidence) |
| Véhicule immobilisé | Assistance track | Reads `Policy.assistanceOnContract` + `Contact` (`assistance`); may set `Incident.vehicleImmobilised` |
| Courtier (role picker → `/desk`) | Broker desk | Same dossier ids; desk-only types in `packages/domain/src/desk.ts` |

Motorist home has **no** Espace courtier link. Quiet **Changer de rôle** on both shells.

Directory numbers live **inside** the relevant door (authorities on STOP, assistance on immobilised, broker on send). Not a fourth journey.

---

## Store ↔ entity

| Zustand (plan) | Domain entities | Persist |
|---|---|---|
| `profile` | `Motorist`, `Vehicle`, `Policy`, `Insurer`, `Broker` | yes (local) |
| `evidencePack` | `Incident` + `Evidence` (+ `damageZones`, `photos` meta) | yes; blobs in idb |
| `declaration` | `Declaration` + `Dossier` | yes (Phase 2) |

Suggested pack shape (TypeScript-oriented, names match models):

```ts
type EvidencePack = {
  incident: Incident;
  otherParty: OtherParty | null;
  evidence: Evidence;
};
```

`driveable === false` in UI ⇔ `incident.vehicleImmobilised === true`.

---

## NOW door → fields

| Screen (Labas) | Domain effect |
|---|---|
| Tout va bien ? Anyone hurt | `Incident.injury` = `no` \| `yes` \| `unknown` |
| STOP (yes / unknown) | `Evidence.pv = required`; no further NOW capture that pretends to be a claim |
| Other driver | `OtherParty.status` = `known` \| `refused` \| `fled` \| `unknown` |
| STOP (refused / fled / unknown) | same PV rule |
| Constat checklist | `Evidence.constat` → `started` / `complete`; wallet attestation is read-only from `profile` |
| Tap-car | `Evidence.damageZones[]` |
| Photo slots | `Evidence.photos[]` with `slot`: `scene` \| `part` \| `corner` |
| Driveable? | `vehicleImmobilised` |
| Assistance card | show if `assistanceOnContract !== no`; label “assistance, pas l’assureur” |
| Evidence pack saved | pack complete for NOW; CTA → LATER later; **no** `Declaration.submittedAt` |

End of NOW: claim has **not** started.

---

## LATER door → fields (Phase 2)

| Screen | Domain effect |
|---|---|
| What documents exist | derive from `Evidence.constat` / `pv` / `photos` |
| Gap | `Dossier.status = blocked_missing_evidence`, `missingPieces` |
| Facts (no fault) | `Declaration.narrative` |
| Check answers | review only; Change returns to field |
| Send to broker | `channel = broker`, set `submittedAt`, `Dossier.status = declared` then `with_broker` |
| Tracking | `missingPieces`, `nextHumanStep`, named broker from `profile`; never “you will be paid” |

Submit guard (must implement in reducer / API):

```
canSubmit = evidence.constat === "complete" || evidence.pv === "obtained"
```

---

## STOP branch (must unit-test)

```
if injury in {yes, unknown} → STOP
if otherParty.status in {unknown, refused, fled} → STOP
else → constat path
```

STOP UI: call authorities, explain PV, **Terminer**. No Continuer into déclaration.

---

## Forbidden UI copy / state

Do not bind UI to:

- fault %, “responsable”, guarantee activated, indemnity amount, expert approved, FGAC eligible, legal countdown timer

Allowed: “prochaine étape humaine”, named broker, missing document names, ACAPS five-day **guidance** as static copy on dossier.

---

## Mock fixtures

Seed ids should match [models.md](models.md) examples where possible:

- Nadia / Casablanca / missing constat → `blocked_missing_evidence`
- Sara / Marrakech / injury → STOP, `pv: required`, no déclaration yet

Porting people/policies from `_old/data.js` is fine; **rename** into domain fields (`injury`, `constat`, `pv`, …), do not keep legacy claim-step enums as source of truth.

---

## Phase ownership

| Phase | Domain surface |
|---|---|
| 0 (NOW ship) | `profile` subset + full NOW pack; LATER stub |
| 1 | richer wallet on same party/policy entities |
| 2 | `Declaration` + `Dossier` (motorist LATER) |
| 3 | broker desk at `/desk`; same ids; desk types in `packages/domain/src/desk.ts`; HTTP in [api.md](api.md); queue search/filter, handoff, timeline events |
| C (LATER closure) | review-before-send, home status card, motorist-visible events, `addPieces` flip `waiting_motorist` → `with_broker`, contacts inside doors, draft save on blur |
| D (identity + wallet) | per-device `M-<uuid>` wallet (migrate legacy `M-1`); broker display name as desk owner / “mes dossiers”; Phase 1 onboarding fields (local photos only) |
| 4 | platform adapters only; no new domain entities |

---

## Handoff checklist for UI PRs

- [ ] New screen maps to a domain entity or is pure presentation
- [ ] STOP has no path to `submittedAt`
- [ ] Assistance labelled ≠ insurer
- [ ] No fault / payout strings in i18n for status
- [ ] Photo meta in pack; blobs not in JSON persist
