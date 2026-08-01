import {Badge, Box, Button, Card, Flex, Select, Stack, Text} from '@sanity/ui'
import {useMemo, useState} from 'react'
import {useClient} from 'sanity'

import {useZernioClient, useZernioSettings} from '../hooks/useZernio'
import {canSend} from '../lib/rules'
import {sendPost} from '../lib/send'
import type {RemotePost, SocialPostValue} from '../lib/types'

const API_VERSION = '2024-10-01'

const STATUS_TONE: Record<string, 'default' | 'primary' | 'positive' | 'caution' | 'critical'> = {
  draft: 'default',
  ready: 'primary',
  scheduled: 'primary',
  publishing: 'caution',
  published: 'positive',
  partial: 'caution',
  failed: 'critical',
}

/**
 * The posts as a filterable list, with the one action that matters: send.
 *
 * @public
 */
export function PostList(props: {
  posts: SocialPostValue[]
  remote?: RemotePost[]
  onOpen: (post: SocialPostValue) => void
  onChanged: () => void
}): React.JSX.Element {
  const {posts, remote = [], onOpen, onChanged} = props
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
      <Flex gap={2} wrap="wrap">
        <Select value={status} onChange={(event) => setStatus(event.currentTarget.value)}>
          <option value="all">All statuses</option>
          {['draft', 'ready', 'scheduled', 'publishing', 'published', 'partial', 'failed'].map(
            (entry) => (
              <option key={entry} value={entry}>
                {entry}
              </option>
            ),
          )}
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
        <Text size={1} muted>
          {filtered.length} of {posts.length}
        </Text>
      </Flex>

      {note && (
        <Card padding={3} radius={2} border tone="primary">
          <Text size={1}>{note}</Text>
        </Card>
      )}

      <Stack gap={2}>
        {filtered.map((post) => {
          const sendable = canSend(post) && !post.zernioPostId

          return (
            <Card key={post._id} padding={3} radius={2} border>
              <Flex align="center" gap={3} wrap="wrap">
                <Stack gap={2} flex={1} style={{minWidth: 220}}>
                  <Flex align="center" gap={2}>
                    <Text
                      size={1}
                      weight="medium"
                      onClick={() => onOpen(post)}
                      style={{cursor: 'pointer'}}
                    >
                      {post.title ?? 'Untitled'}
                    </Text>
                    <Badge tone={STATUS_TONE[post.status ?? 'draft'] ?? 'default'}>
                      {post.status ?? 'draft'}
                    </Badge>
                    <Badge>{post.kind}</Badge>
                  </Flex>
                  <Text size={0} muted>
                    {(post.targets ?? []).map((target) => target.label).join(', ') || 'no accounts'}
                    {post.scheduledFor
                      ? ` · ${post.scheduledFor.slice(0, 16).replace('T', ' ')}`
                      : ''}
                    {post.publishNow ? ' · immediately' : ''}
                  </Text>
                  {post.lastError && (
                    <Text size={0} style={{color: 'var(--card-critical-fg-color)'}}>
                      {post.lastError}
                    </Text>
                  )}
                  {(post.results ?? []).some((result) => result.url) && (
                    <Flex gap={2} wrap="wrap">
                      {(post.results ?? [])
                        .filter((result) => result.url)
                        .map((result) => (
                          <a
                            key={result.url}
                            href={result.url}
                            target="_blank"
                            rel="noreferrer noopener"
                          >
                            <Text size={0}>{result.platform} ↗</Text>
                          </a>
                        ))}
                    </Flex>
                  )}
                </Stack>

                <Button text="Open" mode="ghost" onClick={() => onOpen(post)} />
                <Button
                  text={post.zernioPostId ? 'Sent' : 'Send'}
                  tone="primary"
                  disabled={!sendable || busy === post._id}
                  onClick={() => void send(post)}
                />
              </Flex>
            </Card>
          )
        })}

        {filtered.length === 0 && (
          <Text size={1} muted>
            Nothing matches these filters.
          </Text>
        )}
      </Stack>

      {remote.length > 0 && (
        <Stack gap={3}>
          <Stack gap={2}>
            <Text size={1} weight="medium">
              Only in Zernio ({remote.length})
            </Text>
            <Text size={0} muted>
              Written in Zernio's dashboard or by another tool. Shown so the calendar is complete;
              they cannot be edited from here.
            </Text>
          </Stack>

          <Stack gap={2}>
            {remote.map((post) => (
              <Card key={post.id} padding={3} radius={2} border style={{borderStyle: 'dashed'}}>
                <Flex align="center" gap={3} wrap="wrap">
                  <Stack gap={2} flex={1} style={{minWidth: 220}}>
                    <Flex align="center" gap={2}>
                      <Text size={1} textOverflow="ellipsis">
                        {post.content ?? 'Zernio post'}
                      </Text>
                      <Badge tone={STATUS_TONE[post.status ?? 'draft'] ?? 'default'}>
                        {post.status ?? 'draft'}
                      </Badge>
                    </Flex>
                    <Text size={0} muted>
                      {post.platforms
                        .map((entry) => [entry.platform, entry.account].filter(Boolean).join(' · '))
                        .join(', ')}
                      {post.scheduledFor
                        ? ` — ${post.scheduledFor.slice(0, 16).replace('T', ' ')}`
                        : ''}
                    </Text>
                  </Stack>

                  {post.platforms
                    .filter((entry) => entry.url)
                    .map((entry) => (
                      <a key={entry.url} href={entry.url} target="_blank" rel="noreferrer noopener">
                        <Text size={0}>{entry.platform} ↗</Text>
                      </a>
                    ))}
                </Flex>
              </Card>
            ))}
          </Stack>
        </Stack>
      )}
    </Stack>
  )
}
