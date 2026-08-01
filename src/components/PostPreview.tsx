import {Badge, Box, Card, Flex, Inline, Stack, Text} from '@sanity/ui'

import {deliveryUrl, isVideo, KIND_GEOMETRY, willBeCropped} from '../lib/media'
import {platformsOf, rulesFor, usableMedia, validatePost} from '../lib/rules'
import type {PostKind, SocialPostValue} from '../lib/types'

/**
 * Renders the caption the way the platform does: everything past the fold is
 * dimmed, with the "more" marker where the platform puts it.
 */
function Caption(props: {text: string; foldAt: number}): React.JSX.Element | null {
  const {text, foldAt} = props
  if (!text) return null

  const visible = text.slice(0, foldAt)
  const hidden = text.slice(foldAt)

  return (
    <Text size={1}>
      {visible}
      {hidden && (
        <>
          <span style={{opacity: 0.45}}>{hidden}</span> <span style={{opacity: 0.6}}>… more</span>
        </>
      )}
    </Text>
  )
}

function Frame(props: {
  kind: PostKind
  platform: string
  value: SocialPostValue
}): React.JSX.Element {
  const {kind, platform, value} = props
  const geometry = KIND_GEOMETRY[kind]
  const media = usableMedia(value.media)
  const first = media[0]
  const src = deliveryUrl(first, kind)
  const rules = rulesFor(platform, kind)
  const cropped = willBeCropped(first, platform, kind)

  // The frame is scaled down but keeps the real ratio — that is the whole point.
  const width = kind === 'story' || kind === 'reel' ? 150 : 210

  return (
    <Stack gap={3}>
      <Flex align="center" gap={2}>
        <Text size={1} weight="medium">
          {platform}
        </Text>
        <Badge tone="primary">{kind}</Badge>
        {media.length > 1 && <Badge>{media.length} items</Badge>}
      </Flex>

      <Box
        style={{
          width,
          aspectRatio: `${geometry.width} / ${geometry.height}`,
          background: 'var(--card-muted-fg-color, #ccc)',
          borderRadius: 4,
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {src && !isVideo(first) && (
          <img
            src={src}
            alt=""
            style={{width: '100%', height: '100%', objectFit: 'cover', display: 'block'}}
          />
        )}
        {src && isVideo(first) && (
          <Flex align="center" justify="center" style={{height: '100%'}}>
            <Text size={1}>video</Text>
          </Flex>
        )}
        {!src && (
          <Flex align="center" justify="center" style={{height: '100%'}}>
            <Text size={1} muted>
              no media
            </Text>
          </Flex>
        )}
      </Box>

      <Box style={{width}}>
        <Caption text={(value.content ?? '').trim()} foldAt={rules.foldAt} />
      </Box>

      {cropped && (
        <Text size={0} muted>
          Will be cropped to {geometry.width}×{geometry.height}
        </Text>
      )}
    </Stack>
  )
}

/**
 * Shows the post in the geometry of every platform it targets, plus the checks
 * that decide whether it can be sent.
 *
 * Deliberately not a replica of the Instagram interface: the questions worth
 * answering here are whether the crop works and where the caption folds.
 *
 * @public
 */
export function PostPreview(props: {value: SocialPostValue}): React.JSX.Element {
  const {value} = props
  const platforms = platformsOf(value)
  const issues = validatePost(value)
  const kind = value.kind ?? 'feed'

  return (
    <Stack gap={4}>
      {platforms.length === 0 ? (
        <Text size={1} muted>
          Pick an account to see the preview.
        </Text>
      ) : (
        <Inline gap={5}>
          {platforms.map((platform) => (
            <Frame key={platform} kind={kind} platform={platform} value={value} />
          ))}
        </Inline>
      )}

      {issues.length > 0 && (
        <Stack gap={2}>
          {issues.map((issue) => (
            <Card
              key={`${issue.field}-${issue.message}`}
              padding={3}
              radius={2}
              border
              tone={issue.level === 'error' ? 'critical' : 'caution'}
            >
              <Text size={1}>{issue.message}</Text>
            </Card>
          ))}
        </Stack>
      )}
    </Stack>
  )
}
