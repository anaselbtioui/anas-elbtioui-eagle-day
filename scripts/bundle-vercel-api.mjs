import * as esbuild from 'esbuild'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outfile = join(root, 'api', '[[...route]].js')
const stub = join(root, 'apps/api/src/import-agent/vercel-stub.ts')
const domainSrc = join(root, 'packages/domain/src')

mkdirSync(dirname(outfile), { recursive: true })

/** Swap Playwright import-agent for a no-op stub on Vercel. */
const stubImportAgent = {
  name: 'stub-import-agent',
  setup(build) {
    build.onResolve({ filter: /import-agent/ }, (args) => {
      if (args.path.includes('vercel-stub')) return null
      return { path: stub }
    })
  },
}

const labasDomain = {
  name: 'labas-domain',
  setup(build) {
    build.onResolve({ filter: /^@labas\/domain\// }, (args) => ({
      path: join(domainSrc, args.path.slice('@labas/domain/'.length)),
    }))
  },
}

await esbuild.build({
  entryPoints: [join(root, 'apps/api/src/vercel-entry.ts')],
  outfile,
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  logLevel: 'info',
  plugins: [stubImportAgent, labasDomain],
  packages: 'bundle',
})

console.log(`bundled ${outfile}`)
