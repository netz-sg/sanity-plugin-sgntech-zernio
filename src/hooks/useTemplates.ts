import {useCallback, useEffect, useState} from 'react'
import {useClient} from 'sanity'

import type {TemplateValue} from '../lib/templates'

const API_VERSION = '2024-10-01'

const QUERY = `*[_type == $type && !(_id in path("drafts.**"))]|order(title asc){
  _id, _type, title, caption, firstComment, hashtags, hashtagPlacement
}`

/**
 * The post templates, kept in sync while the tool is open.
 *
 * @public
 */
export function useTemplates(templateType: string): {
  templates: TemplateValue[]
  loading: boolean
  reload: () => void
} {
  const client = useClient({apiVersion: API_VERSION})
  const [templates, setTemplates] = useState<TemplateValue[]>([])
  const [loading, setLoading] = useState(true)
  const [generation, setGeneration] = useState(0)

  const reload = useCallback(() => setGeneration((current) => current + 1), [])

  useEffect(() => {
    let cancelled = false

    client
      .fetch<TemplateValue[]>(QUERY, {type: templateType})
      .then((result) => {
        if (!cancelled) {
          setTemplates(result)
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
  }, [client, generation, templateType])

  // A template edited in the desk shows up in the picker without a reload.
  useEffect(() => {
    const subscription = client
      .listen(QUERY, {type: templateType}, {visibility: 'query'})
      .subscribe(() => reload())

    return () => subscription.unsubscribe()
  }, [client, reload, templateType])

  return {templates, loading, reload}
}
