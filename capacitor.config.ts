import type { CapacitorConfig } from '@capacitor/cli'

/**
 * Native shells for Med Assurance.
 * Platforms: `npm run cap:add:android` / `cap:add:ios`, then `npm run cap:sync`.
 * Building/opening iOS requires macOS + Xcode (`npm run cap:open:ios` after adding).
 */
const config: CapacitorConfig = {
  appId: 'ma.medassurance.labas',
  appName: 'Med Assurance',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
}

export default config
