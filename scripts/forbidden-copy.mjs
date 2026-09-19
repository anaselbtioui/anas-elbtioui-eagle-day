#!/usr/bin/env node
/**
 * Forbidden-copy lint for Med Assurance i18n.
 * Flags "garantie activée", "responsable", "indemnis" outside allowed disclaimers.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'i18n')

const FORBIDDEN = [
  { id: 'garantie_activee', re: /garantie\s+activ[ée]e/gi },
  { id: 'responsable', re: /\bresponsable\b/gi },
  { id: 'indemnis', re: /indemnis/gi },
]

/** Negating / guidance copy that may mention garantie or indemnisation. */
const ALLOWED_DISCLAIMER =
  /aucune\s+d[ée]cision|pas\s+(une\s+)?d[ée]cision|n[’']est\s+pas\s+une\s+d[ée]cision|ni\s+d[’']indemnisation|jamais\s+de\s+(faute|d[ée]cision|garantie)|pas\s+de\s+d[ée]cision\s+de\s+garantie/i

function walkJson(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name)
    if (statSync(full).isDirectory()) out.push(...walkJson(full))
    else if (name.endsWith('.json')) out.push(full)
  }
  return out
}

function collectStrings(value, prefix = '') {
  /** @type {{ path: string, text: string }[]} */
  const rows = []
  if (typeof value === 'string') {
    rows.push({ path: prefix || '(root)', text: value })
  } else if (Array.isArray(value)) {
    value.forEach((item, i) => rows.push(...collectStrings(item, `${prefix}[${i}]`)))
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      const next = prefix ? `${prefix}.${k}` : k
      rows.push(...collectStrings(v, next))
    }
  }
  return rows
}

const violations = []

for (const file of walkJson(root)) {
  const data = JSON.parse(readFileSync(file, 'utf8'))
  const rel = path.relative(process.cwd(), file)
  for (const { path: key, text } of collectStrings(data)) {
    for (const rule of FORBIDDEN) {
      rule.re.lastIndex = 0
      if (!rule.re.test(text)) continue
      if (rule.id !== 'garantie_activee' && ALLOWED_DISCLAIMER.test(text)) continue
      violations.push(`${rel} :: ${key} [${rule.id}] → ${JSON.stringify(text)}`)
    }
  }
}

if (violations.length) {
  console.error('Forbidden-copy lint failed:\n')
  for (const line of violations) console.error(`  ${line}`)
  process.exit(1)
}

console.log('Forbidden-copy lint OK (i18n)')
