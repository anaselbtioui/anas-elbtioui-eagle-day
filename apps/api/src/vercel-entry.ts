import { createApp } from './app.ts'
import {
  loadDb as loadSupabase,
  replaceDb as replaceSupabase,
  saveDb as saveSupabase,
  supabaseConfigured,
} from './supabase-store.ts'

export const config = {
  runtime: 'nodejs',
  maxDuration: 30,
}

function createServerlessApp() {
  if (!supabaseConfigured()) {
    const app = createApp(
      async () => {
        throw new Error('supabase_not_configured')
      },
      async () => {
        throw new Error('supabase_not_configured')
      },
    )
    app.get('/health', (c) =>
      c.json({ ok: false, service: 'labas-api', store: 'missing_env' }, 503),
    )
    app.get('/api/health', (c) =>
      c.json({ ok: false, service: 'labas-api', store: 'missing_env' }, 503),
    )
    return app
  }
  const app = createApp(loadSupabase, saveSupabase, replaceSupabase)
  app.get('/api/health', (c) =>
    c.json({
      ok: true,
      service: 'labas-api',
      store: 'supabase',
    }),
  )
  return app
}

const app = createServerlessApp()

/** Web Handler API — Vercel Node runtime expects `{ fetch }` / Hono `.fetch`, not hono/vercel `handle`. */
export default {
  fetch: (request: Request) => app.fetch(request),
}
