import {Box, Button, Card, Flex, Stack, Text} from '@sanity/ui'
import {useState} from 'react'

import {remoteTimeLabel} from '../lib/calendar'
import type {RemotePost} from '../lib/types'
import {PlatformIcon} from './PlatformIcon'
import {StatusPill} from './ui'

const PAGE = 24

function dayLabel(post: RemotePost): string {
  const raw = (post.scheduledFor ?? '').trim()
  if (!raw) return ''
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return raw.slice(0, 10)
  return date.toLocaleDateString(undefined, {day: '2-digit', month: 'short', year: 'numeric'})
}

function RemoteCard(props: {post: RemotePost}): React.JSX.Element {
  const {post} = props
  const cover = post.media[0]
  const caption = (post.content ?? '').trim()
  const accounts = [...new Set(post.platforms.map((entry) => entry.account).filter(Boolean))]
  const platforms = [...new Set(post.platforms.map((entry) => entry.platform).filter(Boolean))]
  const links = post.platforms.filter((entry) => entry.url)

  return (
    <Card radius={3} border overflow="hidden">
      <Box
        style={{
          aspectRatio: '1 / 1',
          background: 'var(--card-muted-bg-color, rgba(127,127,127,.12))',
          position: 'relative',
        }}
      >
        {cover ? (
          <img
            src={cover.url}
            alt=""
            loading="lazy"
            style={{width: '100%', height: '100%', objectFit: 'cover', display: 'block'}}
          />
        ) : (
          <Flex align="center" justify="center" style={{height: '100%'}}>
            <Text size={0} muted>
              no preview
            </Text>
          </Flex>
        )}

        <Box style={{position: 'absolute', top: 8, left: 8}}>
          <StatusPill status={post.status} />
        </Box>
      </Box>

      <Box padding={3}>
        <Stack gap={3}>
          <Flex align="center" gap={2}>
            {platforms.map((platform) => (
              <Flex key={platform} align="center" gap={1}>
                <PlatformIcon platform={platform} />
              </Flex>
            ))}
            <Box flex={1} />
            <Text size={0} muted>
              {dayLabel(post)} {remoteTimeLabel(post)}
            </Text>
          </Flex>

          <Text size={0} muted textOverflow="ellipsis">
            {accounts.join(', ') || '—'}
          </Text>

          {/* Three lines of caption, cut by height — enough to tell posts apart. */}
          {caption && (
            <Box style={{maxHeight: '4.2em', overflow: 'hidden'}}>
              <Text size={1}>{caption}</Text>
            </Box>
          )}

          {links.length > 0 && (
            <Flex gap={2} wrap="wrap">
              {links.map((entry) => (
                <a key={entry.url} href={entry.url} target="_blank" rel="noreferrer noopener">
                  <Flex align="center" gap={1}>
                    <PlatformIcon platform={entry.platform} size={12} />
                    <Text size={0}>open ↗</Text>
                  </Flex>
                </a>
              ))}
            </Flex>
          )}
        </Stack>
      </Box>
    </Card>
  )
}

/**
 * The posts that live in Zernio, as cards with their image, the platforms they
 * went to and a link to the published post.
 *
 * Shown in pages of {@link PAGE}: a workspace with hundreds of posts would
 * otherwise render hundreds of images at once.
 *
 * @public
 */
export function RemotePostGrid(props: {posts: RemotePost[]}): React.JSX.Element | null {
  const {posts} = props
  const [shown, setShown] = useState(PAGE)

  if (posts.length === 0) return null

  return (
    <Stack gap={4}>
      <Stack gap={2}>
        <Text size={1} weight="medium">
          Already in Zernio ({posts.length})
        </Text>
        <Text size={0} muted>
          Written in Zernio or by another tool. Shown so the overview is complete; they cannot be
          edited from here.
        </Text>
      </Stack>

      <Box
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
          gap: 12,
        }}
      >
        {posts.slice(0, shown).map((post) => (
          <RemoteCard key={post.id} post={post} />
        ))}
      </Box>

      {shown < posts.length && (
        <Flex justify="center">
          <Button
            text={`Show ${Math.min(PAGE, posts.length - shown)} more`}
            mode="ghost"
            onClick={() => setShown((current) => current + PAGE)}
          />
        </Flex>
      )}
    </Stack>
  )
}
