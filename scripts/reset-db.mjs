#!/usr/bin/env node
/**
 * Wipe Labas API store (users, packs, dossiers) via POST /api/reset.
 *
 * Usage:
 *   pnpm reset:db
 *   pnpm reset:db -- --url https://anas-elbtioui-eagle-day.vercel.app
 *
 * Needs ALLOW_RESET=1 on the target API (local .env / Vercel env).
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

function loadDotEnv() {
  const path = resolve(process.cwd(), '.env')
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
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

loadDotEnv()

const args = process.argv.slice(2)
let base = process.env.LABAS_API_URL?.trim() || 'http://127.0.0.1:8787'
const urlIdx = args.indexOf('--url')
if (urlIdx >= 0 && args[urlIdx + 1]) {
  base = args[urlIdx + 1].replace(/\/$/, '')
}

const endpoint = `${base}/api/reset`
const res = await fetch(endpoint, { method: 'POST' })
const text = await res.text()
let body
try {
  body = JSON.parse(text)
} catch {
  body = text
}

if (!res.ok) {
  console.error(`reset failed ${res.status}`, body)
  process.exit(1)
}

console.log('ok — DB wiped', body)
