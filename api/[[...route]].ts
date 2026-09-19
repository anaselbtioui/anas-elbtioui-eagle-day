import { handle } from 'hono/vercel'
import { createApp } from '../server/app.ts'
import {
  loadDb as loadSupabase,
  saveDb as saveSupabase,
  supabaseConfigured,
} from '../server/supabase-store.ts'

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
    return app
  }
  return createApp(loadSupabase, saveSupabase)
}

const app = createServerlessApp()

export default handle(app)
