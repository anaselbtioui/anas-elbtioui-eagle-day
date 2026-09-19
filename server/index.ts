import { existsSync, readFileSync } from 'node:fs'
import { serve } from '@hono/node-server'
import { createApp } from './app.ts'
import { loadDb as loadJson, saveDb as saveJson } from './store.ts'
import {
  loadDb as loadSupabase,
  saveDb as saveSupabase,
  supabaseConfigured,
} from './supabase-store.ts'

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
if (!process.env.DEEPSEEK_API_KEY?.trim() && existsSync('deepseek-api.key.txt')) {
  process.env.DEEPSEEK_API_KEY = readFileSync('deepseek-api.key.txt', 'utf8').trim()
}

const useSupabase = supabaseConfigured()
const app = createApp(
  useSupabase ? loadSupabase : loadJson,
  useSupabase ? saveSupabase : saveJson,
)

const port = Number(process.env.PORT ?? 8787)
serve({ fetch: app.fetch, hostname: '127.0.0.1', port })
console.log(`Med Assurance API http://127.0.0.1:${port} store=${useSupabase ? 'supabase' : 'json'}`)
