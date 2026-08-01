import {useCallback, useState} from 'react'
import type {DocumentActionComponent, DocumentActionProps} from 'sanity'
import {useClient} from 'sanity'

import {ZernioClient} from '../lib/client'
import {canSend, validatePost} from '../lib/rules'
import {sendPost} from '../lib/send'
import {readSettings} from '../lib/settings'
import type {SocialPostValue} from '../lib/types'

const API_VERSION = '2024-10-01'

/**
 * Document action that hands the post to Zernio.
 *
 * Sends the published version, never the draft — what goes out has to be what
 * was reviewed, and Zernio has no notion of a Sanity draft.
 *
 * @public
 */
export function createSendAction(documentType: string): DocumentActionComponent {
  const SendToZernio: DocumentActionComponent = (props: DocumentActionProps) => {
    const client = useClient({apiVersion: API_VERSION})
    const [busy, setBusy] = useState(false)
    const [dialog, setDialog] = useState<string | undefined>()

    const value = (props.published ?? props.draft) as SocialPostValue | null
    const errors = value ? validatePost(value).filter((issue) => issue.level === 'error') : []
    const ready = Boolean(value) && canSend(value ?? undefined) && Boolean(props.published)

    const handle = useCallback(async () => {
      if (!value) return
      setBusy(true)
      try {
        const settings = await readSettings(client)
        if (!settings.apiKey) {
          setDialog('No API key stored. Open the Zernio tool and add one under Settings.')
          return
        }

        const outcome = await sendPost(client, new ZernioClient({apiKey: settings.apiKey}), value)
        setDialog(outcome.message)
      } finally {
        setBusy(false)
      }
    }, [client, value])

    if (props.type !== documentType) return null

    return {
      label: busy ? 'Sending…' : 'Send to Zernio',
      icon: undefined,
      disabled: !ready || busy,
      title: props.published
        ? errors.map((issue) => issue.message).join(' · ') || undefined
        : 'Publish the document first — Zernio gets the published version',
      onHandle: () => void handle(),
      dialog: dialog
        ? {
            type: 'dialog',
            header: 'Zernio',
            content: dialog,
            onClose: () => setDialog(undefined),
          }
        : undefined,
    }
  }

  return SendToZernio
}
