import type { CapacitorConfig } from '@capacitor/cli'

/**
 * Native shells for Med Assurance.
 * Platforms: `pnpm cap:add:android` / `cap:add:ios`, then `pnpm cap:sync`.
 * Building/opening iOS requires macOS + Xcode (`pnpm cap:open:ios` after adding).
 */
const config: CapacitorConfig = {
  appId: 'ma.medassurance.labas',
  appName: 'Med Assurance',
  webDir: '../../dist',
  server: {
    androidScheme: 'https',
  },
}

export default config
