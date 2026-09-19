import type { Db } from './store.ts'

let chain: Promise<void> = Promise.resolve()

export function withWriteLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(fn, fn)
  chain = run.then(
    () => undefined,
    () => undefined,
  )
  return run
}

/** Load → mutate → persist under one lock (avoids wipe races on full-table save). */
export function exclusiveDbWrite(
  load: () => Promise<Db>,
  persist: (db: Db) => Promise<void>,
  mutator: (db: Db) => Db | Promise<Db>,
): Promise<Db> {
  return withWriteLock(async () => {
    const db = await load()
    const next = await mutator(db)
    await persist(next)
    return next
  })
}
