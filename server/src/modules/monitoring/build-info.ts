const STARTED_AT = Date.now()

/** Короткий хеш коммита, который сейчас работает (Railway выставляет RAILWAY_GIT_COMMIT_SHA), или null. */
export function currentCommit(env: NodeJS.ProcessEnv = process.env): string | null {
  const sha = env.RAILWAY_GIT_COMMIT_SHA || env.GIT_COMMIT || ''
  return sha ? sha.slice(0, 7) : null
}

export function uptimeSeconds(): number {
  return Math.round((Date.now() - STARTED_AT) / 1000)
}
