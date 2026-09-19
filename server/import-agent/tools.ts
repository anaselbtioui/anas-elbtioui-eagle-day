import { chromium, type Browser, type Page } from 'playwright'
import type { ExtractedImport, ImportSource } from '../../src/domain/browser-import.ts'
import { isAllowlistedUrl, PORTAL_URLS } from './portals.ts'

export type BrowserHandle = {
  browser: Browser
  page: Page
}

export async function launchPortal(source: ImportSource): Promise<BrowserHandle> {
  const headless = process.env.LABAS_IMPORT_HEADLESS === '1'
  const browser = await chromium.launch({ headless })
  const context = await browser.newContext({
    locale: 'fr-MA',
    viewport: { width: 1280, height: 800 },
  })
  // Never persist storage — ephemeral context only.
  const page = await context.newPage()
  const url = PORTAL_URLS[source].login
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 })
  return { browser, page }
}

export async function closeBrowser(handle: BrowserHandle | null): Promise<void> {
  if (!handle) return
  try {
    await handle.browser.close()
  } catch {
    /* ignore */
  }
}

export async function a11ySnapshot(page: Page): Promise<string> {
  const url = page.url()
  const title = await page.title().catch(() => '')
  const text = await page
    .locator('body')
    .innerText({ timeout: 5000 })
    .catch(() => '')
  const inputs = await page
    .locator('input, button, a, select, textarea')
    .evaluateAll((els) =>
      els.slice(0, 80).map((el) => {
        const tag = el.tagName.toLowerCase()
        const type = el.getAttribute('type') ?? ''
        const name = el.getAttribute('name') ?? ''
        const id = el.id ?? ''
        const label = (el.getAttribute('aria-label') || el.textContent || '')
          .trim()
          .slice(0, 80)
        return `${tag}#${id}[name=${name}][type=${type}] ${label}`
      }),
    )
    .catch(() => [] as string[])
  return [`URL: ${url}`, `TITLE: ${title}`, 'CONTROLS:', ...inputs, 'TEXT:', text.slice(0, 8000)].join(
    '\n',
  )
}

export async function safeClick(page: Page, selector: string): Promise<string> {
  await page.locator(selector).first().click({ timeout: 8000 })
  return `clicked ${selector}`
}

export async function safeType(page: Page, selector: string, text: string): Promise<string> {
  // Never type secrets from the model into password/otp without human — tools may still fill non-secret fields.
  const loc = page.locator(selector).first()
  const type = await loc.getAttribute('type')
  if (type === 'password') {
    throw new Error('password_requires_human')
  }
  await loc.fill(text, { timeout: 8000 })
  return `typed into ${selector}`
}

export async function assertAllowlisted(page: Page, source: ImportSource): Promise<void> {
  const url = page.url()
  if (!isAllowlistedUrl(url, source)) {
    throw new Error(`url_not_allowlisted:${url}`)
  }
}

/** Heuristic DOM extract when model extract is weak — best-effort visible labels. */
export async function heuristicExtract(page: Page): Promise<ExtractedImport | null> {
  const body = await page.locator('body').innerText().catch(() => '')
  const policy =
    body.match(/MA-AUTO-\d{5}/i)?.[0] ??
    body.match(/police[:\s]+([A-Z0-9-]+)/i)?.[1] ??
    null
  if (!policy) return null
  const name =
    body.match(/nom[:\s]+([^\n]+)/i)?.[1]?.trim() ??
    body.match(/assuré[:\s]+([^\n]+)/i)?.[1]?.trim() ??
    'Client importé'
  const phone = body.match(/0\d[\d•\s]{6,}/)?.[0]?.trim() ?? null
  const plate = body.match(/\d{1,6}-[A-Z]-\d{1,2}/)?.[0] ?? null
  return {
    name: name.slice(0, 80),
    phone,
    policy: policy.toUpperCase(),
    vehicle: null,
    plate,
    city: null,
  }
}
