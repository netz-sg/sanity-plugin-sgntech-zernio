import {Badge, Box, Card, Flex, Stack, Text} from '@sanity/ui'

import {KIND_GEOMETRY, willBeCropped} from '../lib/media'
import {platformsOf, usableMedia, validatePost} from '../lib/rules'
import type {PostKind, SocialPostValue} from '../lib/types'
import {PlatformFrame} from './PlatformFrame'
import {PlatformIcon} from './PlatformIcon'

/** How wide one frame is drawn, per size and per how many are shown. */
function frameWidth(size: 'compact' | 'large', kind: PostKind, count: number): number {
  const tall = kind === 'story' || kind === 'reel'
  if (size === 'compact') return tall ? 150 : 200
  if (count > 1) return tall ? 170 : 230
  return tall ? 250 : 330
}

/**
 * Shows the post the way each platform it targets will draw it, plus the checks
 * that decide whether it can be sent.
 *
 * The frames are the real thing — profile row, action bar, caption folded where
 * the app folds it — because "does this look right" is answered by seeing it in
 * its own surroundings, not next to a grey rectangle.
 *
 * @public
 */
export function PostPreview(props: {
  value: SocialPostValue
  /** `large` is the tool's rail, `compact` the document form. */
  size?: 'compact' | 'large'
  /** The composer shows the checks in its own bar instead. */
  showIssues?: boolean
}): React.JSX.Element {
  const {value, size = 'compact', showIssues = true} = props
  const platforms = platformsOf(value)
  const issues = validatePost(value)
  const kind = value.kind ?? 'feed'
  const geometry = KIND_GEOMETRY[kind]
  const width = frameWidth(size, kind, platforms.length)
  const first = usableMedia(value.media)[0]

  return (
    <Stack gap={4}>
      {platforms.length === 0 ? (
        <Card padding={4} radius={2} border tone="transparent">
          <Text size={1} muted>
            Pick an account to see how the post will look.
          </Text>
        </Card>
      ) : (
        <Flex gap={4} wrap="wrap">
          {platforms.map((platform) => (
            <Stack key={platform} gap={3}>
              <Flex align="center" gap={2}>
                <PlatformIcon platform={platform} size={13} />
                <Text size={0} muted style={{textTransform: 'capitalize'}}>
                  {platform} · {kind}
                </Text>
                {willBeCropped(first, platform, kind) && (
                  <Badge tone="caution" fontSize={0}>
                    crop {geometry.width}×{geometry.height}
                  </Badge>
                )}
              </Flex>

              <Box>
                <PlatformFrame platform={platform} kind={kind} value={value} width={width} />
              </Box>
            </Stack>
          ))}
        </Flex>
      )}

      {showIssues && issues.length > 0 && (
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
