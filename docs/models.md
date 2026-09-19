# Domain models

First-principles data for a motorist-first product. Meaning comes from [standard-procedure.md](standard-procedure.md). This document is not UI and not a legal opinion.

**Hinge:** an `Incident` is not a claim. The official claim starts when a `Declaration` is sent to the insurer (often via the broker). A `Dossier` tracks operational status after that. The product never stores liability, which guarantee pays, or payout as conclusions.

Motorist experience owns the core file. Broker desk consumes the **same dossier** (desk types in `src/domain/desk.ts`).

---

## Glossary

| Term | Meaning in this model |
|---|---|
| **NOW** | Safety and evidence at or just after the crash. No déclaration form. |
| **LATER** | Déclaration de sinistre and follow-up. |
| **Constat** | Constat à l’amiable — joint report between drivers. |
| **PV** | Procès-verbal — official record from police / gendarmerie. |
| **Déclaration** | Notification to the insurer that opens the insurance file. |
| **Dossier** | Operational tracking of a submitted (or blocked) déclaration. |
| **Assistance** | Contractual roadside help. Stated as a policy fact, not an approval to pay. |
| **Channel** | Who carries the déclaration: broker or insurer direct. |

---

## Relationship overview

```
Policy ──covers──► Vehicle
   │
   └──► Incident ──► Evidence
           │
           └──► Declaration ──► Dossier
```

- One `Incident` has one `Evidence` aggregate (or an empty one while still gathering).
- Zero or one `Declaration` per incident in v1 (motorist may draft, then submit once).
- One `Dossier` per `Declaration` once the motorist is past pure NOW capture.
- `Broker` and `Insurer` are referenced by id; they are not decision engines.

---

## Entities

### Motorist

Person using the motorist product.

| Field | Type | Notes |
|---|---|---|
| `id` | string | Stable id. |
| `name` | string | Display name. |
| `phone` | string \| null | Optional contact. |
| `alsoTellEmployerIfCommute` | boolean | Parallel work-accident hint only. Not auto-insurance. |

### OtherParty

Other driver / third party. Optional on the incident.

| Field | Type | Notes |
|---|---|---|
| `id` | string | |
| `status` | `known` \| `unknown` \| `refused` \| `fled` | Whether a joint constat is possible. `fled` and `unknown` both force PV. |
| `name` | string \| null | Only when `known`. |
| `plate` | string \| null | Optional identity fragment. |

### Insurer

Stub. Opens the file after déclaration. Does not write conclusions into the app.

| Field | Type | Notes |
|---|---|---|
| `id` | string | |
| `displayName` | string | |

### Broker

Stub for a later desk UX. Channel for the déclaration, not the payer.

| Field | Type | Notes |
|---|---|---|
| `id` | string | |
| `displayName` | string | |

### Vehicle

| Field | Type | Notes |
|---|---|---|
| `id` | string | |
| `plate` | string \| null | |
| `makeModel` | string \| null | Free text if known. |

### Policy

Contract facts the motorist (or broker later) may know. Assistance is a **stated** fact, not an approval.

| Field | Type | Notes |
|---|---|---|
| `id` | string | |
| `number` | string \| null | Optional at NOW. |
| `insurerId` | string | → `Insurer` |
| `brokerId` | string \| null | → `Broker` |
| `vehicleId` | string | → `Vehicle` |
| `assistanceOnContract` | `yes` \| `no` \| `unknown` | Controls whether assistance contacts are offered. |

### Incident (NOW — not a claim)

Facts of the accident.

| Field | Type | Notes |
|---|---|---|
| `id` | string | |
| `motoristId` | string | → `Motorist` |
| `policyId` | string \| null | May be unknown at roadside. |
| `occurredAt` | datetime \| null | |
| `city` | string \| null | |
| `injury` | `no` \| `yes` \| `unknown` | First safety question (“Tout va bien ?”). `yes` or `unknown` ⇒ hard STOP (PV / authorities); no déclaration on this record alone. |
| `vehicleImmobilised` | boolean | Inverse of UI “driveable?”. `true` ⇒ offer assistance track. |
| `otherPartyId` | string \| null | → `OtherParty` |
| `workCommute` | boolean \| null | If true, surface “also tell employer” (parallel track). |

Derived rule (not a stored field): if `injury` is `yes` or `unknown`, or other party is `unknown` / `refused` / `fled`, evidence must mark PV as `required` until obtained.

### Evidence (NOW — still not a claim)

Belongs to one incident. Frontend store name **evidence pack** = this aggregate (+ photo blobs out of band).

| Field | Type | Notes |
|---|---|---|
| `incidentId` | string | → `Incident` |
| `constat` | `absent` \| `started` \| `complete` | Checklist progress in NOW door. |
| `pv` | `not_needed` \| `required` \| `obtained` | |
| `damageZones` | `DamageZone[]` | Tap-car map. Marks parts; **no severity, no pricing**. |
| `photos` | `PhotoMeta[]` | Metadata only in domain. Blobs live in IndexedDB (`idb-keyval`), keyed by `photoId`. |

#### DamageZone

| Field | Type | Notes |
|---|---|---|
| `id` | string | Stable zone id (e.g. `front_left`, `rear`). |
| `label` | string | FR label for UI. |

#### PhotoMeta

| Field | Type | Notes |
|---|---|---|
| `photoId` | string | Key for local blob store. |
| `slot` | `scene` \| `part` \| `corner` \| `other` | Guided slots: scene, marked parts, four corners. |
| `zoneId` | string \| null | When `slot === part`, link to `damageZones`. |
| `label` | string | Human label. |
| `capturedAt` | datetime \| null | Optional. |

**Completeness for later déclaration:** at least one of `constat === complete` or `pv === obtained`.

### Contact

Labelled directory row. Not a journey.

| Field | Type | Notes |
|---|---|---|
| `id` | string | |
| `role` | `authorities` \| `assistance` \| `insurer_general` \| `broker` | Distinct purposes. |
| `displayName` | string | |
| `phone` | string \| null | May be withheld if unverified. |
| `url` | string \| null | Official source page. |
| `note` | string | Boundary text (e.g. general ≠ emergency). |

**Offer rule:** show `assistance` contacts only when linked policy has `assistanceOnContract !== no` (offer when `yes` or `unknown`, with unknown labelled as unverified).

### Declaration (LATER — claim starts when submitted)

| Field | Type | Notes |
|---|---|---|
| `id` | string | |
| `incidentId` | string | → `Incident` |
| `narrative` | string | What happened, without concluding fault. |
| `documentRefs` | `DocumentRef[]` | Pointers to evidence pieces the motorist says they have. |
| `channel` | `broker` \| `insurer_direct` | Who receives / forwards the file. |
| `submittedAt` | datetime \| null | Null while draft. Set when sent. |

#### DocumentRef

| Field | Type | Notes |
|---|---|---|
| `kind` | `constat` \| `pv` \| `photo` \| `other` | |
| `label` | string | |
| `present` | boolean | Motorist asserts the piece exists. |

**Incompleteness rule:** if neither complete constat nor obtained PV exists on the linked `Evidence`, the déclaration must not move to submitted. Status lives on `Dossier` as `blocked_missing_evidence`.

### Dossier (after déclaration intent)

Operational tracking. Never fault, guarantee, or money.

| Field | Type | Notes |
|---|---|---|
| `id` | string | |
| `declarationId` | string | → `Declaration` |
| `missingPieces` | `MissingPiece[]` | e.g. `constat_or_pv`, `photos` |
| `status` | see below | |
| `nextHumanStep` | string | Plain language. May name insurer / expert / broker as *actors*, not as app decisions. |
| `notifiedWithinGuidanceNote` | string \| null | Optional ACAPS “inform quickly / within 5 days” **copy**. Never a computed legal expiry. |

#### MissingPiece

Allowed values (v1): `constat_or_pv` \| `photos` \| `policy_number` \| `other`

#### Dossier.status

| Value | Meaning |
|---|---|
| `draft` | Déclaration not sent. |
| `blocked_missing_evidence` | Cannot submit: missing constat/PV (or other required piece). |
| `declared` | Sent; file opened with insurer/broker channel. |
| `waiting_motorist` | Human next step is the motorist (e.g. provide missing piece). |
| `with_broker` | Broker holding / forwarding the file. |
| `with_insurer` | Insurer’s file; product stops naming outcomes. |

---

## Product entries × read / write

| Entry | Reads | Writes |
|---|---|---|
| **Motorist now** | `Policy` (esp. assistance), `Contact`, current `Incident` / `Evidence` | `Incident`, `OtherParty`, `Evidence`, photo metadata |
| **Motorist later** | Full incident + evidence, policy, contacts | `Declaration`, `Dossier` (status, missing pieces, next step text) |
| **Broker (later UX)** | Same motorist dossier entities | Desk-only fields **not in this spec** (tasks, import provenance, message drafts) |

Broker UX must not create a second copy of the file. Same ids.

---

## Completeness and branching rules

1. If `Incident.injury` is `yes` or `unknown` → set `Evidence.pv` to `required` (until `obtained`). Hard STOP UI: authorities / PV. No “Continuer” into déclaration.
2. If `OtherParty.status` is `unknown`, `refused`, or `fled` → `Evidence.pv` is `required` until obtained. Do not treat a half-constat as enough.
3. If other party is `known` and injury is `no` → `pv` may be `not_needed`; `constat` should move toward `complete`.
4. `Declaration.submittedAt` may be set only if evidence has `constat === complete` **or** `pv === obtained`.
5. Otherwise create / keep `Dossier.status = blocked_missing_evidence` with `missingPieces` including `constat_or_pv`.
6. Assistance contacts: hide or de-emphasise when `assistanceOnContract === no`. Offer when `yes` or `unknown` (label unknown as unverified).
7. `vehicleImmobilised === true` → assistance track (not a fourth claim journey).
8. `workCommute === true` → surface employer parallel track as guidance on the dossier / NOW copy; no separate work-accident entity in v1.

---

## Frontend mapping (Labas)

Canonical names live here. UI/store aliases in [frontend-contract.md](frontend-contract.md).

| Domain | Labas store / feature |
|---|---|
| `Motorist` + `Vehicle` + `Policy` + `Insurer` + `Broker` | `store/profile` (wallet / onboarding stub) |
| `Incident` + `Evidence` | `store/evidencePack` (+ `Incident` fields on pack or sibling) |
| Photo blobs | IndexedDB via `idb-keyval`, not in domain JSON |
| `Declaration` + `Dossier` | `store/declaration` (Phase 2) |
| `Contact` | Embedded in doors (not a nav “Répertoire”) |
| Motorist NOW | `features/now` |
| Motorist LATER | `features/later` (stub Phase 0) |
| Broker | `features/broker` (desk Phase 3 — queue, fiche, events) |
| Assistance home door | Shortcut into immobilised / `Contact.role = assistance` — still not a claim |

`src/services/api.ts` (`LabasApi`) is the contract. `httpApi` talks to `npm run server`. Field names must match this doc. Photos never uploaded.

---

## Forbidden fields (do not store as product conclusions)

Do not add fields that assert:

- share of responsibility / fault percentage
- which guarantee is activated or will pay
- indemnity amount or “you will be paid”
- expert approval as a binding decision
- FGAC eligibility as a boolean outcome
- legal deadline expiry computed by the app

Insurer, expert, and recours may appear only inside `nextHumanStep` (or similar plain text), never as enums the app sets to true.

---

## Broker desk (same dossier)

Desk types live in `src/domain/desk.ts`. Persisted beside the motorist file (`desk_files` in Supabase / JSON). Same `Dossier.id`. No second copy. No fault / garantie / payout fields.

| Type | Role |
|---|---|
| `Provenance` | Source, freshness, owner (human référent) |
| `BrokerTask` | Checklist. Not a claims decision. |
| `DocumentRequest` | Ask motorist for a piece → `waiting_motorist` |
| `MessageDraft` | Local message. `humanApproved` required before `approvedAt`. No external send. |
| `DeskEvent` | Timeline row: `at`, `actor` (`motorist` \| `broker` \| `system`), `label`, `motoristVisible` |
| `DeskBundle` | Queue/fiche payload: profile + pack + declaration + dossier + desk fields + `events` |

Handoff: blocked while `missingPieces.length > 0` (`has_gaps`). Otherwise `Dossier.status = with_insurer`. Next step names the insurer as actor only.

Queue filter (client): name / police / city search, status chips, optional “mes dossiers” by `provenance.owner`, sort by `provenance.freshness`.

---

## Fictional examples (data only)

### Missing constat (material, known other party)

Nadia-style. Casablanca collision. Constat not signed yet.

```text
Motorist: { id: "M-1", name: "Nadia El Mansouri", phone: "06•••••142" }
Vehicle:  { id: "V-1", plate: "…", makeModel: "Dacia Sandero · 2022" }
Insurer:  { id: "I-1", displayName: "Insurer (stub)" }
Broker:   { id: "B-1", displayName: "Broker (stub)" }
Policy:   { id: "P-1", number: "MA-AUTO-24018", insurerId: "I-1", brokerId: "B-1",
            vehicleId: "V-1", assistanceOnContract: "unknown" }
OtherParty: { id: "O-1", status: "known", name: "…", plate: "…" }
Incident: { id: "INC-1", motoristId: "M-1", policyId: "P-1", city: "Casablanca",
            injury: "no", vehicleImmobilised: false, otherPartyId: "O-1", workCommute: false }
Evidence: { incidentId: "INC-1", constat: "absent", pv: "not_needed", photos: [] }
Declaration: { id: "DEC-1", incidentId: "INC-1", narrative: "Collision légère…",
               documentRefs: [{ kind: "constat", label: "Constat", present: false }],
               channel: "broker", submittedAt: null }
Dossier: { id: "DOS-1", declarationId: "DEC-1",
           missingPieces: ["constat_or_pv"],
           status: "blocked_missing_evidence",
           nextHumanStep: "Obtenir le constat signé (ou un PV) avant d’envoyer la déclaration.",
           notifiedWithinGuidanceNote: "Informer l’assureur rapidement (guidance ACAPS: exemple 5 jours)." }
```

Claim has **not** started (`submittedAt` null). Next step is evidence, not payout.

### Injury path (PV required)

Sara-style. Marrakech. Bodily harm reported.

```text
Motorist: { id: "M-2", name: "Sara Amrani" }
Incident: { id: "INC-2", motoristId: "M-2", city: "Marrakech",
            injury: "yes", vehicleImmobilised: false, otherPartyId: null, workCommute: null }
Evidence: { incidentId: "INC-2", constat: "absent", pv: "required", photos: [] }
```

No `Declaration` yet. NOW product entry: authorities / PV. Déclaration comes **later**, after `pv: obtained` (and any other pieces).

---

## Sources

- [standard-procedure.md](standard-procedure.md) — process chain and actors.
- [frontend-contract.md](frontend-contract.md) — Labas screens / stores ↔ these entities.
- ACAPS kit du conducteur / step dégâts matériels — guidance roles only; five-day example is copy, not a calculator.
