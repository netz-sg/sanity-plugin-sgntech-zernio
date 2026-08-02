import {ComposeIcon} from '@sanity/icons/Compose'
import {PublishIcon} from '@sanity/icons/Publish'
import {Badge, Box, Button, Card, Flex, Select, Stack, Text} from '@sanity/ui'
import {useMemo, useState} from 'react'
import {useClient} from 'sanity'

import {useZernioClient, useZernioSettings} from '../hooks/useZernio'
import {deliveryUrl, isVideo} from '../lib/media'
import {canSend} from '../lib/rules'
import {sendPost} from '../lib/send'
import type {RemotePost, SocialPostValue} from '../lib/types'
import {PlatformIcon} from './PlatformIcon'
import {RemotePostGrid} from './RemotePostGrid'
import {ensureZernioStyles} from './styles'
import {EmptyState, StatusPill, Toolbar} from './ui'

const API_VERSION = '2024-10-01'
const STATUSES = ['draft', 'ready', 'scheduled', 'publishing', 'published', 'partial', 'failed']

function whenLabel(post: SocialPostValue): string {
  if (post.publishNow) return 'immediately'
  const raw = (post.scheduledFor ?? '').trim()
  if (!raw) return 'no date'

  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return raw.slice(0, 16).replace('T', ' ')

  return date.toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function Thumbnail(props: {post: SocialPostValue}): React.JSX.Element {
  const first = (props.post.media ?? [])[0]
  const url = !isVideo(first) ? deliveryUrl(first, props.post.kind) : undefined

  return (
    <div className="zn-thumb" style={{width: 60, height: 60}}>
      {url ? (
        <img src={url} alt="" loading="lazy" />
      ) : (
        <Text size={0} muted>
          {first ? 'video' : '—'}
        </Text>
      )}
    </div>
  )
}

/**
 * The posts as a filterable list, with the two actions that matter: open and
 * send.
 *
 * @public
 */
export function PostList(props: {
  posts: SocialPostValue[]
  remote?: RemotePost[]
  onOpen: (post: SocialPostValue) => void
  onChanged: () => void
  onCreate?: () => void
}): React.JSX.Element {
  const {posts, remote = [], onOpen, onChanged, onCreate} = props
  ensureZernioStyles()
  const client = useClient({apiVersion: API_VERSION})
  const {settings} = useZernioSettings()
  const zernio = useZernioClient(settings.apiKey)

  const [status, setStatus] = useState('all')
  const [account, setAccount] = useState('all')
  const [busy, setBusy] = useState<string | undefined>()
  const [note, setNote] = useState<string | undefined>()

  const accounts = useMemo(() => {
    const map = new Map<string, string>()
    for (const post of posts) {
      for (const target of post.targets ?? []) {
        if (target.accountId) map.set(target.accountId, target.label ?? target.accountId)
      }
    }
    return [...map.entries()]
  }, [posts])

  const filtered = useMemo(
    () =>
      posts.filter((post) => {
        if (status !== 'all' && (post.status ?? 'draft') !== status) return false
        if (account !== 'all' && !(post.targets ?? []).some((t) => t.accountId === account)) {
          return false
        }
        return true
      }),
    [account, posts, status],
  )

  const send = async (post: SocialPostValue) => {
    if (!zernio) {
      setNote('No API key stored — open Settings first.')
      return
    }
    setBusy(post._id)
    setNote(undefined)
    const outcome = await sendPost(client, zernio, post)
    setBusy(undefined)
    setNote(outcome.message)
    onChanged()
  }

  return (
    <Stack gap={4}>
      <Toolbar>
        <Select value={status} onChange={(event) => setStatus(event.currentTarget.value)}>
          <option value="all">All statuses</option>
          {STATUSES.map((entry) => (
            <option key={entry} value={entry}>
              {entry}
            </option>
          ))}
        </Select>

        <Select value={account} onChange={(event) => setAccount(event.currentTarget.value)}>
          <option value="all">All accounts</option>
          {accounts.map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </Select>

        <Box flex={1} />
        <Text size={0} muted>
          {filtered.length} of {posts.length}
        </Text>
      </Toolbar>

      {note && (
        <Card padding={3} radius={2} border tone="primary">
          <Text size={1}>{note}</Text>
        </Card>
      )}

      <Stack gap={2}>
        {filtered.map((post) => {
          const sendable = canSend(post) && !post.zernioPostId
          const platforms = [
            ...new Set((post.targets ?? []).map((target) => target.platform).filter(Boolean)),
          ]
          const links = (post.results ?? []).filter((result) => result.url)

          return (
            <Box key={post._id} className="zn-card zn-card--hover">
              <Flex align="center" gap={3} wrap="wrap" padding={3}>
                <Thumbnail post={post} />

                <Stack gap={3} flex={1} style={{minWidth: 220}}>
                  <Flex align="center" gap={2} wrap="wrap">
                    <Text
                      size={1}
                      weight="semibold"
                      onClick={() => onOpen(post)}
                      style={{cursor: 'pointer'}}
                    >
                      {post.title ?? 'Untitled'}
                    </Text>
                    <StatusPill status={post.status} />
                    <Badge fontSize={0}>{post.kind}</Badge>
                  </Flex>

                  <Flex align="center" gap={2} wrap="wrap">
                    {platforms.map((platform) => (
                      <PlatformIcon key={platform} platform={platform} size={13} />
                    ))}
                    <Text size={0} muted textOverflow="ellipsis">
                      {(post.targets ?? []).map((target) => target.label).join(', ') ||
                        'no accounts'}{' '}
                      · {whenLabel(post)}
                    </Text>
                  </Flex>

                  {post.lastError && (
                    <Text size={0} style={{color: 'var(--card-critical-fg-color)'}}>
                      {post.lastError}
                    </Text>
                  )}

                  {links.length > 0 && (
                    <Flex gap={3} wrap="wrap">
                      {links.map((result) => (
                        <a
                          key={result.url}
                          href={result.url}
                          target="_blank"
                          rel="noreferrer noopener"
                        >
                          <Flex align="center" gap={1}>
                            <PlatformIcon platform={result.platform} size={12} />
                            <Text size={0}>open ↗</Text>
                          </Flex>
                        </a>
                      ))}
                    </Flex>
                  )}
                </Stack>

                <Flex gap={2}>
                  <Button
                    text="Open"
                    icon={ComposeIcon}
                    mode="ghost"
                    onClick={() => onOpen(post)}
                  />
                  <Button
                    text={post.zernioPostId ? 'Sent' : 'Send'}
                    icon={PublishIcon}
                    tone="primary"
                    mode={post.zernioPostId ? 'bleed' : 'default'}
                    disabled={!sendable || busy === post._id}
                    loading={busy === post._id}
                    onClick={() => void send(post)}
                  />
                </Flex>
              </Flex>
            </Box>
          )
        })}

        {filtered.length === 0 && (
          <EmptyState
            title={posts.length === 0 ? 'No posts yet' : 'Nothing matches these filters'}
            description={
              posts.length === 0
                ? 'Write one in the composer — it is saved as a document and can be scheduled or published straight away.'
                : undefined
            }
            action={
              posts.length === 0 && onCreate ? (
                <Button text="New post" icon={ComposeIcon} tone="primary" onClick={onCreate} />
              ) : undefined
            }
          />
        )}
      </Stack>

      <RemotePostGrid posts={remote} />
    </Stack>
  )
}
