import {useEffect, useState} from 'react'

import type {RemotePost, SocialPostValue} from '../lib/types'
import {useZernioClient, useZernioSettings} from './useZernio'

/**
 * The posts Zernio knows about, minus the ones this Studio sent itself.
 *
 * Without this the cockpit would only ever show its own work, and a post
 * scheduled from Zernio's dashboard or a colleague's phone would be invisible
 * here — which makes a calendar worse than useless, because it looks complete.
 *
 * @public
 */
export function useRemotePosts(
  ownPosts: SocialPostValue[],
  generation: number,
): {remote: RemotePost[]; loading: boolean; error?: string} {
  const {settings} = useZernioSettings()
  const zernio = useZernioClient(settings.apiKey)
  const profileId = settings.profileId

  const [remote, setRemote] = useState<RemotePost[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | undefined>()

  useEffect(() => {
    if (!zernio) return undefined

    let cancelled = false

    zernio
      .listPosts({limit: 200, profileId})
      .then((posts) => {
        if (!cancelled) {
          setRemote(posts)
          setError(undefined)
          setLoading(false)
        }
        return undefined
      })
      .catch((reason: unknown) => {
        if (cancelled) return
        setError(reason instanceof Error ? reason.message : 'Could not read posts from Zernio')
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [generation, profileId, zernio])

  // A post this Studio sent appears on both sides; the document is the richer
  // of the two, so the remote copy is dropped.
  const own = new Set(
    ownPosts.map((post) => post.zernioPostId).filter((id): id is string => Boolean(id)),
  )

  if (!zernio) return {remote: [], loading: false}

  return {remote: remote.filter((post) => !own.has(post.id)), loading, error}
}
