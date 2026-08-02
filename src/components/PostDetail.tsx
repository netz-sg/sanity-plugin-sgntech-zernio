import {ArrowLeftIcon} from '@sanity/icons/ArrowLeft'
import {CopyIcon} from '@sanity/icons/Copy'
import {EditIcon} from '@sanity/icons/Edit'
import {PublishIcon} from '@sanity/icons/Publish'
import {RefreshIcon} from '@sanity/icons/Refresh'
import {TrashIcon} from '@sanity/icons/Trash'
import {Badge, Box, Button, Card, Flex, Heading, Stack, Text} from '@sanity/ui'
import {useCallback, useState} from 'react'
import {useClient} from 'sanity'

import {useZernioClient, useZernioSettings} from '../hooks/useZernio'
import {deliveryUrl, isVideo} from '../lib/media'
import {canSend, validatePost} from '../lib/rules'
import {refreshStatus, sendPost} from '../lib/send'
import type {SocialPostValue} from '../lib/types'
import {PlatformIcon} from './PlatformIcon'
import {PostPreview} from './PostPreview'
import {Section, StatusPill} from './ui'

const API_VERSION = '2024-10-01'

function when(post: SocialPostValue): string {
  if (post.publishNow) return 'Immediately, as soon as it is sent'
  const raw = (post.scheduledFor ?? '').trim()
  if (!raw) return 'No time set'

  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return raw

  return date.toLocaleString(undefined, {
    weekday: 'short',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function Detail(props: {label: string; children: React.ReactNode}): React.JSX.Element {
  return (
    <Flex gap={3} align="flex-start">
      <Box style={{width: 110, flex: 'none'}}>
        <Text size={1} muted>
          {props.label}
        </Text>
      </Box>
      <Box flex={1} style={{minWidth: 0}}>
        {props.children}
      </Box>
    </Flex>
  )
}

/**
 * Everything about one post on a page of its own: what it says, what it looks
 * like, where it goes, what came back from Zernio — and the actions that belong
 * to it.
 *
 * The calendar and the list open this rather than the editor, because the first
 * question about a post is usually "what is this and did it go out", not "let
 * me change it".
 *
 * @public
 */
export function PostDetail(props: {
  post: SocialPostValue
  onBack: () => void
  onEdit: (post: SocialPostValue) => void
  onDuplicate: (post: SocialPostValue) => void
  onChanged: () => void
  onDeleted: () => void
}): React.JSX.Element {
  const {post, onBack, onEdit, onDuplicate, onChanged, onDeleted} = props
  const client = useClient({apiVersion: API_VERSION})
  const {settings} = useZernioSettings()
  const zernio = useZernioClient(settings.apiKey)

  const [busy, setBusy] = useState<string | undefined>()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [note, setNote] = useState<{tone: 'positive' | 'critical'; text: string} | undefined>()

  const issues = validatePost(post)
  const errors = issues.filter((issue) => issue.level === 'error')
  const media = post.media ?? []
  const results = post.results ?? []
  const sent = Boolean(post.zernioPostId)

  const send = useCallback(async () => {
    if (!zernio) {
      setNote({tone: 'critical', text: 'No API key stored — see Settings.'})
      return
    }

    setBusy('send')
    const outcome = await sendPost(client, zernio, post)
    setBusy(undefined)
    setNote({tone: outcome.ok ? 'positive' : 'critical', text: outcome.message})
    onChanged()
  }, [client, onChanged, post, zernio])

  const refresh = useCallback(async () => {
    if (!zernio) return
    setBusy('status')

    try {
      const changed = await refreshStatus(client, zernio, post)
      setNote({
        tone: 'positive',
        text: changed ? 'Status updated' : 'Nothing has changed at Zernio',
      })
      if (changed) onChanged()
    } catch (error) {
      setNote({tone: 'critical', text: error instanceof Error ? error.message : 'Unknown error'})
    } finally {
      setBusy(undefined)
    }
  }, [client, onChanged, post, zernio])

  const remove = useCallback(async () => {
    if (!post._id) return
    setBusy('delete')

    try {
      await client.delete(post._id)
      await client.delete(`drafts.${post._id.replace(/^drafts\./, '')}`).catch(() => undefined)
      onDeleted()
    } catch (error) {
      setNote({tone: 'critical', text: error instanceof Error ? error.message : 'Could not delete'})
      setBusy(undefined)
    }
  }, [client, onDeleted, post._id])

  return (
    <Stack gap={3}>
      <Flex align="center" gap={3} wrap="wrap">
        <Button text="All posts" icon={ArrowLeftIcon} mode="bleed" onClick={onBack} />
        <Box flex={1} style={{minWidth: 160}}>
          <Flex align="center" gap={2} wrap="wrap">
            <Heading size={1}>{post.title ?? 'Untitled'}</Heading>
            <StatusPill status={post.status} />
            <Badge fontSize={0}>{post.kind}</Badge>
            {sent && <Badge tone="primary">in Zernio</Badge>}
          </Flex>
        </Box>
        <Flex gap={2} wrap="wrap">
          <Button text="Edit" icon={EditIcon} mode="ghost" onClick={() => onEdit(post)} />
          <Button
            text="Duplicate"
            icon={CopyIcon}
            mode="ghost"
            onClick={() => onDuplicate(post)}
          />
          {sent && (
            <Button
              text="Check status"
              icon={RefreshIcon}
              mode="ghost"
              disabled={busy === 'status'}
              loading={busy === 'status'}
              onClick={() => void refresh()}
            />
          )}
          <Button
            text={sent ? 'Send again' : 'Send'}
            icon={PublishIcon}
            tone="primary"
            disabled={!canSend(post) || busy === 'send'}
            loading={busy === 'send'}
            onClick={() => void send()}
          />
          {confirmDelete ? (
            <Flex gap={2}>
              <Button
                text="Really delete"
                tone="critical"
                disabled={busy === 'delete'}
                onClick={() => void remove()}
              />
              <Button text="Keep" mode="bleed" onClick={() => setConfirmDelete(false)} />
            </Flex>
          ) : (
            <Button
              icon={TrashIcon}
              title="Delete"
              aria-label="Delete"
              mode="bleed"
              tone="critical"
              onClick={() => setConfirmDelete(true)}
            />
          )}
        </Flex>
      </Flex>

      {note && (
        <Card padding={3} radius={2} border tone={note.tone}>
          <Text size={1}>{note.text}</Text>
        </Card>
      )}

      {post.lastError && (
        <Card padding={3} radius={2} border tone="critical">
          <Stack gap={2}>
            <Text size={1} weight="medium">
              Zernio refused this post
            </Text>
            <Text size={1}>{post.lastError}</Text>
          </Stack>
        </Card>
      )}

      {!sent && errors.length > 0 && (
        <Card padding={3} radius={2} border tone="caution">
          <Stack gap={3}>
            <Text size={1} weight="medium">
              Not ready to send
            </Text>
            {errors.map((issue) => (
              <Text key={issue.message} size={1}>
                · {issue.message}
              </Text>
            ))}
          </Stack>
        </Card>
      )}

      <Box
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) minmax(320px, 400px)',
          alignItems: 'start',
          gap: 16,
        }}
      >
        <Stack gap={3}>
          <Section title="Caption">
            {post.content ? (
              <Text size={1} style={{whiteSpace: 'pre-wrap'}}>
                {post.content}
              </Text>
            ) : (
              <Text size={1} muted>
                No caption.
              </Text>
            )}
          </Section>

          {post.firstComment && (
            <Section title="First comment">
              <Text size={1} style={{whiteSpace: 'pre-wrap'}}>
                {post.firstComment}
              </Text>
            </Section>
          )}

          <Section title={`Media (${media.length})`}>
            {media.length === 0 ? (
              <Text size={1} muted>
                Nothing attached.
              </Text>
            ) : (
              <Flex gap={3} wrap="wrap">
                {media.map((item, index) => {
                  const url = !isVideo(item) ? deliveryUrl(item, post.kind) : undefined
                  return (
                    <Card
                      key={item._key ?? index}
                      radius={2}
                      border
                      overflow="hidden"
                      style={{width: 96, height: 96}}
                    >
                      {url ? (
                        <img
                          src={url}
                          alt={item.alt ?? ''}
                          loading="lazy"
                          style={{width: '100%', height: '100%', objectFit: 'cover'}}
                        />
                      ) : (
                        <Flex align="center" justify="center" style={{height: '100%'}}>
                          <Text size={0} muted>
                            video
                          </Text>
                        </Flex>
                      )}
                    </Card>
                  )
                })}
              </Flex>
            )}
          </Section>

          <Section title="Where and when">
            <Stack gap={4}>
              <Detail label="Accounts">
                {(post.targets ?? []).length === 0 ? (
                  <Text size={1} muted>
                    None picked.
                  </Text>
                ) : (
                  <Flex gap={2} wrap="wrap">
                    {(post.targets ?? []).map((target) => (
                      <Card key={target._key ?? target.accountId} padding={2} radius={4} border>
                        <Flex align="center" gap={2} paddingX={1}>
                          <PlatformIcon platform={target.platform} size={14} />
                          <Text size={1}>{target.label ?? target.accountId}</Text>
                        </Flex>
                      </Card>
                    ))}
                  </Flex>
                )}
              </Detail>

              <Detail label="Scheduled">
                <Text size={1}>{when(post)}</Text>
              </Detail>

              <Detail label="Timezone">
                <Text size={1}>{post.timezone ?? 'UTC'}</Text>
              </Detail>

              {post.zernioPostId && (
                <Detail label="Zernio id">
                  <Text size={1} muted style={{fontFamily: 'var(--font-family-mono, monospace)'}}>
                    {post.zernioPostId}
                  </Text>
                </Detail>
              )}
            </Stack>
          </Section>

          {results.length > 0 && (
            <Section title="What Zernio reported">
              <Stack gap={2}>
                {results.map((result, index) => (
                  <Card key={result._key ?? index} padding={3} radius={2} border>
                    <Flex align="center" gap={3} wrap="wrap">
                      <PlatformIcon platform={result.platform} size={15} />
                      <Text size={1} style={{textTransform: 'capitalize'}}>
                        {result.platform ?? 'unknown'}
                      </Text>
                      <StatusPill status={result.status} />
                      <Box flex={1} />
                      {result.error && (
                        <Text size={0} style={{color: 'var(--card-critical-fg-color)'}}>
                          {result.error}
                        </Text>
                      )}
                      {result.url && (
                        <a href={result.url} target="_blank" rel="noreferrer noopener">
                          <Text size={1}>open ↗</Text>
                        </a>
                      )}
                    </Flex>
                  </Card>
                ))}
              </Stack>
            </Section>
          )}
        </Stack>

        <Box style={{position: 'sticky', top: 0}}>
          <Section title="Preview">
            <PostPreview value={post} size="large" />
          </Section>
        </Box>
      </Box>
    </Stack>
  )
}
