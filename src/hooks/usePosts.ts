import {useCallback, useEffect, useState} from 'react'
import {useClient} from 'sanity'

import {isPending, refreshStatus} from '../lib/send'
import type {SocialPostValue} from '../lib/types'
import {useZernioClient, useZernioSettings} from './useZernio'

const API_VERSION = '2024-10-01'
const POLL_INTERVAL = 30_000

const QUERY = `*[_type == $type && !(_id in path("drafts.**"))]|order(coalesce(scheduledFor, _createdAt) desc){
  _id, _type, title, content, kind, media, targets, scheduledFor, timezone, publishNow,
  status, zernioPostId, results, lastError
}`

/**
 * All social posts, kept in sync while the tool is open.
 *
 * Also asks Zernio about posts that are still on their way and writes the
 * answer back — that is the whole status mechanism, and it only runs while
 * somebody is looking at this tool.
 *
 * @public
 */
export function usePosts(documentType: string): {
  posts: SocialPostValue[]
  loading: boolean
  reload: () => void
} {
  const client = useClient({apiVersion: API_VERSION})
  const {settings} = useZernioSettings()
  const zernio = useZernioClient(settings.apiKey)

  const [posts, setPosts] = useState<SocialPostValue[]>([])
  const [loading, setLoading] = useState(true)
  const [generation, setGeneration] = useState(0)

  /** Asks for the list again — used after writes and by the live subscription. */
  const reload = useCallback(() => setGeneration((current) => current + 1), [])

  useEffect(() => {
    let cancelled = false

    client
      .fetch<SocialPostValue[]>(QUERY, {type: documentType})
      .then((result) => {
        if (!cancelled) {
          setPosts(result)
          setLoading(false)
        }
        return undefined
      })
      .catch(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [client, documentType, generation])

  // Someone editing a post elsewhere shows up here without a manual reload.
  useEffect(() => {
    const subscription = client
      .listen(QUERY, {type: documentType}, {visibility: 'query'})
      .subscribe(() => reload())

    return () => subscription.unsubscribe()
  }, [client, documentType, reload])

  // Posts that were handed over but have not settled yet are polled while the
  // tool is open. Nothing happens when nobody is looking — by design.
  useEffect(() => {
    if (!zernio) return undefined

    const pending = posts.filter(isPending)
    if (pending.length === 0) return undefined

    let cancelled = false

    const tick = async () => {
      const changes = await Promise.all(
        pending.map((post) => refreshStatus(client, zernio, post).catch(() => false)),
      )
      if (!cancelled && changes.some(Boolean)) reload()
    }

    void tick()
    const timer = setInterval(() => void tick(), POLL_INTERVAL)

    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [client, posts, reload, zernio])

  return {posts, loading, reload}
}
