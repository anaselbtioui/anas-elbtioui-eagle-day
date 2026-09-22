/**
 * Backfill desk drafts for incidents that have a broker-linked policy
 * but no declaration yet.
 */
import { existsSync, readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { syncDossier, listDeskBundlesForBroker } from '../apps/api/src/core.ts'
import {
  loadDb,
  saveDb,
  supabaseConfigured,
} from '../apps/api/src/supabase-store.ts'
import { loadDb as loadJson, saveDb as saveJson } from '../apps/api/src/store.ts'

function loadEnvFile(path: string): void {
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq < 1) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = value
  }
}

loadEnvFile('.env')
loadEnvFile('.env.local')

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  try {
    const out = execSync('npx supabase status -o env', { encoding: 'utf8' })
    for (const line of out.split(/\r?\n/)) {
      const m = line.match(/^(API_URL|SERVICE_ROLE_KEY)=(.*)$/)
      if (!m) continue
      const val = m[2].replace(/^"|"$/g, '')
      if (m[1] === 'API_URL' && !process.env.SUPABASE_URL) process.env.SUPABASE_URL = val
      if (m[1] === 'SERVICE_ROLE_KEY' && !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        process.env.SUPABASE_SERVICE_ROLE_KEY = val
      }
    }
  } catch {
    /* ignore */
  }
}

const useSb = supabaseConfigured()
const load = useSb ? loadDb : loadJson
const save = useSb ? saveDb : saveJson

let db = await load()
const before = db.dossiers.length
for (const incident of db.incidents) {
  db = syncDossier(db, incident.id)
}
await save(db)
const after = db.dossiers.length
const brokerIds = [
  ...new Set(db.policies.map((p) => p.brokerId).filter((id): id is string => Boolean(id))),
]
console.log(
  JSON.stringify(
    {
      store: useSb ? 'supabase' : 'json',
      dossiersBefore: before,
      dossiersAfter: after,
      queues: Object.fromEntries(
        brokerIds.map((id) => [id, listDeskBundlesForBroker(db, id).length]),
      ),
    },
    null,
    2,
  ),
)
