# Browser-import bonus — live checklist

Use after fixture path is green. Evidence for `_old/BONUS.md`.

## Preconditions

- [ ] `DEEPSEEK_API_KEY` set in `.env` (not committed)
- [ ] `LABAS_IMPORT_MODE=live`
- [ ] `LABAS_IMPORT_HEADLESS=0` for visible demo
- [ ] Owner-authorised **test** account on TRT Broker or OuiAssur only
- [ ] Broker signed in to Med Assurance desk

## Run

1. Open `/desk/import` — badge shows **LIVE**
2. Pick source (TRT or OuiAssur)
3. Check consent (named site + authorised account)
4. **Lancer l’agent** — headed Playwright window opens login URL
5. When human gate appears: complete OTP / CAPTCHA / password in browser, then **Continuer**
6. Mapping preview shows source URL/time in journal + field rows
7. Confirm merge only after review; conflict rows require per-field pick
8. Open created/updated dossier — `provenance.source` = `Import navigateur · {source}`

## Hard stops (must interrupt, no merge)

- [ ] Unexpected hostname outside allowlist
- [ ] Cancel at human gate
- [ ] Ambiguous / empty extract

## Evidence to capture

- [ ] Authorised account scope (site + that account is test/owner)
- [ ] Screenshot or journal of visible steps (no passwords/OTP in logs)
- [ ] Mapping preview + outcome (new / duplicate / conflict / interrupted)
- [ ] Proof no external write beyond authorised login/register
- [ ] Note whether signup/login completed or exact stop stage

## Never

- Store credentials or session dumps
- Purchase, claim submit, contract change
- Use hidden/private APIs
- Run live portal against CI
