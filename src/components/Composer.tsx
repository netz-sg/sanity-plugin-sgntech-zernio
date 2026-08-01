import {
  Badge,
  Box,
  Button,
  Card,
  Checkbox,
  Flex,
  Select,
  Stack,
  Switch,
  Text,
  TextArea,
  TextInput,
} from '@sanity/ui'
import {useCallback, useMemo, useRef, useState} from 'react'
import {useClient} from 'sanity'

import {useZernioClient, useZernioSettings} from '../hooks/useZernio'
import {canSend} from '../lib/rules'
import {sendPost} from '../lib/send'
import type {PostKind, SocialMediaItem, SocialPostValue} from '../lib/types'
import {PlatformIcon} from './PlatformIcon'
import {PostPreview} from './PostPreview'

const API_VERSION = '2024-10-01'
const KINDS: PostKind[] = ['feed', 'carousel', 'story', 'reel']

/** `YYYY-MM-DDTHH:mm` for the datetime input, in local time. */
function toLocalInput(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/**
 * Write a post and send it without leaving the tool.
 *
 * The document is still created — that is what keeps history, roles and the
 * status write-back working — but nobody has to walk through the document
 * editor to publish something.
 *
 * @public
 */
export function Composer(props: {
  documentType: string
  initialDay?: string
  onSent: () => void
  onOpenDocument: (id: string) => void
}): React.JSX.Element {
  const {documentType, initialDay, onSent, onOpenDocument} = props
  const client = useClient({apiVersion: API_VERSION})
  const {settings} = useZernioSettings()
  const zernio = useZernioClient(settings.apiKey)
  const fileInput = useRef<HTMLInputElement>(null)

  const [title, setTitle] = useState('')
  const [kind, setKind] = useState<PostKind>('feed')
  const [content, setContent] = useState('')
  const [media, setMedia] = useState<SocialMediaItem[]>([])
  const [accountIds, setAccountIds] = useState<string[]>([])
  const [publishNow, setPublishNow] = useState(false)
  const [when, setWhen] = useState(() => {
    const base = initialDay ? new Date(`${initialDay}T12:00:00`) : new Date(Date.now() + 3600_000)
    return toLocalInput(base)
  })
  const [busy, setBusy] = useState<string | undefined>()
  const [note, setNote] = useState<{tone: 'positive' | 'critical'; text: string} | undefined>()

  const accounts = useMemo(
    () =>
      (settings.accounts ?? []).filter((account) =>
        ['instagram', 'facebook'].includes((account.platform ?? '').toLowerCase()),
      ),
    [settings.accounts],
  )

  const value: SocialPostValue = useMemo(
    () => ({
      title: title.trim() || 'Untitled',
      kind,
      content,
      media,
      publishNow,
      scheduledFor: publishNow ? undefined : new Date(when).toISOString(),
      timezone: settings.timezone || 'UTC',
      targets: accountIds.map((id) => {
        const account = accounts.find((entry) => entry.accountId === id)
        return {
          _key: id,
          accountId: id,
          platform: (account?.platform ?? '').toLowerCase(),
          label: account?.name ?? account?.username ?? id,
        }
      }),
    }),
    [accountIds, accounts, content, kind, media, publishNow, settings.timezone, title, when],
  )

  const upload = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return
      setBusy('upload')
      setNote(undefined)

      try {
        const uploaded = await Promise.all(
          Array.from(files).map(async (file) => {
            const isVideo = file.type.startsWith('video/')
            const asset = await client.assets.upload(isVideo ? 'file' : 'image', file, {
              filename: file.name,
            })

            return {
              _key: asset._id,
              _type: isVideo ? 'video' : 'photo',
              asset: {
                _id: asset._id,
                url: asset.url,
                size: asset.size,
                mimeType: asset.mimeType,
                metadata: asset.metadata,
              },
            }
          }),
        )

        setMedia((current) => [...current, ...uploaded])
      } catch (error) {
        setNote({
          tone: 'critical',
          text: error instanceof Error ? error.message : 'Upload failed',
        })
      } finally {
        setBusy(undefined)
      }
    },
    [client],
  )

  const send = useCallback(async () => {
    if (!zernio) {
      setNote({tone: 'critical', text: 'No API key stored — see Settings.'})
      return
    }

    setBusy('send')
    setNote(undefined)

    try {
      // The document is created published, not as a draft: it is the record of
      // something that is about to go out, and the send reads the published one.
      const created = await client.create({_type: documentType, ...value, status: 'ready'})
      const outcome = await sendPost(client, zernio, {...value, _id: created._id})

      setNote({tone: outcome.ok ? 'positive' : 'critical', text: outcome.message})

      if (outcome.ok) {
        // Cleared so the next post starts empty — the caption and the media are
        // the parts nobody wants to delete by hand.
        setTitle('')
        setContent('')
        setMedia([])
        onSent()
      }
    } catch (error) {
      setNote({tone: 'critical', text: error instanceof Error ? error.message : 'Unknown error'})
    } finally {
      setBusy(undefined)
    }
  }, [client, documentType, onSent, value, zernio])

  const saveDraft = async () => {
    setBusy('draft')
    try {
      const created = await client.create({_type: documentType, ...value, status: 'draft'})
      onOpenDocument(created._id)
    } finally {
      setBusy(undefined)
    }
  }

  return (
    <Box style={{display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 24}}>
      <Stack gap={4}>
        <Stack gap={2}>
          <Text size={1} weight="medium">
            Internal name
          </Text>
          <TextInput
            value={title}
            onChange={(event) => setTitle(event.currentTarget.value)}
            placeholder="Only shown inside the Studio"
          />
        </Stack>

        <Stack gap={2}>
          <Text size={1} weight="medium">
            Post type
          </Text>
          <Flex gap={2} wrap="wrap">
            {KINDS.map((entry) => (
              <Button
                key={entry}
                text={entry}
                mode={kind === entry ? 'default' : 'ghost'}
                tone={kind === entry ? 'primary' : 'default'}
                onClick={() => setKind(entry)}
              />
            ))}
          </Flex>
        </Stack>

        <Stack gap={2}>
          <Text size={1} weight="medium">
            Caption
          </Text>
          <TextArea
            rows={6}
            value={content}
            onChange={(event) => setContent(event.currentTarget.value)}
            placeholder="What goes out…"
          />
        </Stack>

        <Stack gap={2}>
          <Flex align="center" gap={2}>
            <Text size={1} weight="medium">
              Media
            </Text>
            <Box flex={1} />
            <Button
              text="Add image or video"
              mode="ghost"
              disabled={busy === 'upload'}
              onClick={() => fileInput.current?.click()}
            />
          </Flex>

          <input
            ref={fileInput}
            type="file"
            accept="image/*,video/*"
            multiple
            hidden
            onChange={(event) => void upload(event.currentTarget.files)}
          />

          {media.length > 0 && (
            <Flex gap={2} wrap="wrap">
              {media.map((item, index) => (
                <Card key={item._key ?? index} radius={2} border overflow="hidden">
                  <Box style={{width: 72, height: 72, position: 'relative'}}>
                    {item.asset?.url && !item._type?.includes('video') ? (
                      <img
                        src={item.asset.url}
                        alt=""
                        style={{width: '100%', height: '100%', objectFit: 'cover'}}
                      />
                    ) : (
                      <Flex align="center" justify="center" style={{height: '100%'}}>
                        <Text size={0}>video</Text>
                      </Flex>
                    )}
                  </Box>
                  <Button
                    text="Remove"
                    mode="bleed"
                    fontSize={0}
                    padding={1}
                    onClick={() => setMedia((current) => current.filter((_, i) => i !== index))}
                  />
                </Card>
              ))}
            </Flex>
          )}
        </Stack>

        <Stack gap={2}>
          <Text size={1} weight="medium">
            Accounts
          </Text>
          {accounts.length === 0 ? (
            <Card padding={3} radius={2} border tone="caution">
              <Text size={1}>No accounts loaded. Open Settings and press “Reload accounts”.</Text>
            </Card>
          ) : (
            <Stack gap={2}>
              {accounts.map((account) => {
                const checked = accountIds.includes(account.accountId)
                return (
                  <Card
                    key={account.accountId}
                    padding={2}
                    radius={2}
                    border
                    tone={checked ? 'primary' : 'default'}
                  >
                    <Flex align="center" gap={3}>
                      <Checkbox
                        checked={checked}
                        onChange={(event) =>
                          setAccountIds((current) =>
                            event.currentTarget.checked
                              ? [...current, account.accountId]
                              : current.filter((id) => id !== account.accountId),
                          )
                        }
                      />
                      <PlatformIcon platform={account.platform} />
                      <Text size={1}>{account.name ?? account.username ?? account.accountId}</Text>
                      {account.disconnected && <Badge tone="critical">disconnected</Badge>}
                    </Flex>
                  </Card>
                )
              })}
            </Stack>
          )}
        </Stack>

        <Stack gap={3}>
          <Flex align="center" gap={3}>
            <Switch
              checked={publishNow}
              onChange={(event) => setPublishNow(event.currentTarget.checked)}
            />
            <Text size={1}>Publish immediately</Text>
          </Flex>

          {!publishNow && (
            <Flex gap={2} align="center">
              <Box flex={1}>
                <TextInput
                  type="datetime-local"
                  value={when}
                  onChange={(event) => setWhen(event.currentTarget.value)}
                />
              </Box>
              <Select
                value={settings.timezone ?? 'UTC'}
                onChange={() => undefined}
                disabled
                style={{maxWidth: 200}}
              >
                <option>{settings.timezone ?? 'UTC'}</option>
              </Select>
            </Flex>
          )}
        </Stack>

        {note && (
          <Card padding={3} radius={2} border tone={note.tone}>
            <Text size={1}>{note.text}</Text>
          </Card>
        )}

        <Flex gap={2}>
          <Button
            text={publishNow ? 'Publish now' : 'Schedule'}
            tone="primary"
            disabled={!canSend(value) || busy === 'send'}
            onClick={() => void send()}
          />
          <Button
            text="Save as draft and open"
            mode="ghost"
            disabled={busy === 'draft'}
            onClick={() => void saveDraft()}
          />
        </Flex>
      </Stack>

      <Box style={{width: 320}}>
        <Stack gap={3}>
          <Text size={1} weight="medium">
            Preview
          </Text>
          <PostPreview value={value} />
        </Stack>
      </Box>
    </Box>
  )
}
