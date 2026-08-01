import {useCallback, useEffect, useMemo, useState} from 'react'
import {useClient} from 'sanity'

import {ZernioClient} from '../lib/client'
import {readSettings, writeSettings} from '../lib/settings'
import type {ZernioSettings} from '../lib/types'

/** API version pinned so a Studio upgrade cannot change how documents are read. */
const API_VERSION = '2024-10-01'

/**
 * The settings document, with a way to write parts of it back.
 *
 * @public
 */
export function useZernioSettings(): {
  settings: ZernioSettings
  loading: boolean
  save: (patch: Partial<ZernioSettings>) => Promise<void>
  reload: () => void
} {
  const client = useClient({apiVersion: API_VERSION})
  const [settings, setSettings] = useState<ZernioSettings>({})
  const [loading, setLoading] = useState(true)
  const [generation, setGeneration] = useState(0)

  /** Reads the settings again — after saving, or when the tool asks for it. */
  const reload = useCallback(() => setGeneration((current) => current + 1), [])

  useEffect(() => {
    let cancelled = false

    readSettings(client)
      .then((document) => {
        if (!cancelled) {
          setSettings(document)
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
  }, [client, generation])

  const save = useCallback(
    async (patch: Partial<ZernioSettings>) => {
      await writeSettings(client, patch)
      setSettings((current) => ({...current, ...patch}))
    },
    [client],
  )

  return {settings, loading, save, reload}
}

/**
 * A Zernio client built from the stored key, or `undefined` while the Studio is
 * not set up yet.
 *
 * @public
 */
export function useZernioClient(apiKey: string | undefined): ZernioClient | undefined {
  return useMemo(() => (apiKey ? new ZernioClient({apiKey}) : undefined), [apiKey])
}
