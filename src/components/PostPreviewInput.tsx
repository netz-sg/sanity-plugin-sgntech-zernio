import {Card, Stack, Text} from '@sanity/ui'
import {useMemo} from 'react'
import {useClient, useFormValue} from 'sanity'

import {resolveMedia} from '../lib/media'
import type {PostKind, SocialMediaItem, SocialPostValue, SocialTarget} from '../lib/types'
import {PostPreview} from './PostPreview'

const API_VERSION = '2024-10-01'
const KINDS: PostKind[] = ['feed', 'carousel', 'story', 'reel']

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function readString(source: Record<string, unknown>, key: string): string | undefined {
  const value = source[key]
  return typeof value === 'string' ? value : undefined
}

function readArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function readMedia(value: unknown): SocialMediaItem[] {
  return readArray(value).flatMap((entry) => {
    if (!isRecord(entry)) return []
    const asset = isRecord(entry.asset) ? entry.asset : undefined

    return [
      {
        _key: readString(entry, '_key'),
        _type: readString(entry, '_type'),
        alt: readString(entry, 'alt'),
        asset: asset ? {_ref: readString(asset, '_ref'), _id: readString(asset, '_id')} : undefined,
      },
    ]
  })
}

function readTargets(value: unknown): SocialTarget[] {
  return readArray(value).flatMap((entry) => {
    if (!isRecord(entry)) return []
    return [
      {
        _key: readString(entry, '_key'),
        accountId: readString(entry, 'accountId'),
        platform: readString(entry, 'platform'),
        label: readString(entry, 'label'),
      },
    ]
  })
}

/**
 * The live preview inside the document form.
 *
 * Sits on a field of its own but reads the rest of the document: how the caption
 * folds and how the image is cropped only makes sense together.
 *
 * @public
 */
export function PostPreviewInput(): React.JSX.Element {
  const client = useClient({apiVersion: API_VERSION})
  const {projectId, dataset} = client.config()

  const content = useFormValue(['content'])
  const kind = useFormValue(['kind'])
  const media = useFormValue(['media'])
  const targets = useFormValue(['targets'])
  const publishNow = useFormValue(['publishNow'])
  const scheduledFor = useFormValue(['scheduledFor'])

  // The form value carries `asset._ref`, never a URL — resolving it here is what
  // makes the image show up while writing instead of after publishing.
  const value: SocialPostValue = useMemo(
    () => ({
      content: typeof content === 'string' ? content : undefined,
      kind: KINDS.find((entry) => entry === kind),
      media: resolveMedia(readMedia(media), {
        projectId: projectId ?? '',
        dataset: dataset ?? '',
      }),
      targets: readTargets(targets),
      publishNow: publishNow === true,
      scheduledFor: typeof scheduledFor === 'string' ? scheduledFor : undefined,
    }),
    [content, dataset, kind, media, projectId, publishNow, scheduledFor, targets],
  )

  return (
    <Card padding={3} radius={2} border>
      <Stack gap={4}>
        <Text size={0} muted>
          How the post will look. Updates as you type.
        </Text>
        <PostPreview value={value} />
      </Stack>
    </Card>
  )
}
