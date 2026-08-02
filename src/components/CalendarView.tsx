import {AddIcon} from '@sanity/icons/Add'
import {ChevronLeftIcon} from '@sanity/icons/ChevronLeft'
import {ChevronRightIcon} from '@sanity/icons/ChevronRight'
import {Badge, Box, Button, Card, Flex, Stack, Text} from '@sanity/ui'
import {useCallback, useMemo, useState} from 'react'
import {useClient} from 'sanity'

import {
  dayOf,
  monthGrid,
  moveToDay,
  postsByDay,
  remoteByDay,
  remoteTimeLabel,
  timeLabel,
  weekGrid,
} from '../lib/calendar'
import type {RemotePost, SocialPostValue} from '../lib/types'
import {PlatformIcon} from './PlatformIcon'
import {ensureZernioStyles} from './styles'
import {Segmented, Toolbar} from './ui'

const API_VERSION = '2024-10-01'
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function monthLabel(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString(undefined, {month: 'long', year: 'numeric'})
}

/**
 * Month and week view. Posts can be dragged onto another day, which moves the
 * date and keeps the time.
 *
 * @public
 */
export function CalendarView(props: {
  posts: SocialPostValue[]
  remote?: RemotePost[]
  onOpen: (post: SocialPostValue) => void
  onChanged: () => void
  onCreate?: (dayKey: string) => void
}): React.JSX.Element {
  const {posts, remote = [], onOpen, onChanged, onCreate} = props
  ensureZernioStyles()
  const client = useClient({apiVersion: API_VERSION})

  const today = useMemo(() => new Date(), [])
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1))
  const [mode, setMode] = useState<'month' | 'week'>('month')
  const [dragging, setDragging] = useState<string | undefined>()

  const days = useMemo(
    () =>
      mode === 'month'
        ? monthGrid(cursor.getFullYear(), cursor.getMonth(), today)
        : weekGrid(cursor, today),
    [cursor, mode, today],
  )

  const byDay = useMemo(() => postsByDay(posts), [posts])
  const remoteDays = useMemo(() => remoteByDay(remote), [remote])
  const undated = useMemo(() => posts.filter((post) => !dayOf(post)), [posts])

  const step = useCallback(
    (direction: 1 | -1) => {
      setCursor((current) =>
        mode === 'month'
          ? new Date(current.getFullYear(), current.getMonth() + direction, 1)
          : new Date(current.getFullYear(), current.getMonth(), current.getDate() + direction * 7),
      )
    },
    [mode],
  )

  const drop = useCallback(
    async (dayKey: string) => {
      const id = dragging
      setDragging(undefined)
      if (!id) return

      const post = posts.find((entry) => entry._id === id)
      // Published posts are history; moving them would only lie about the past.
      if (!post || post.status === 'published') return

      await client
        .patch(id)
        .set({scheduledFor: moveToDay(post.scheduledFor, dayKey)})
        .commit({visibility: 'async'})

      onChanged()
    },
    [client, dragging, onChanged, posts],
  )

  return (
    <Stack gap={4}>
      <Toolbar>
        <Button
          icon={ChevronLeftIcon}
          mode="bleed"
          onClick={() => step(-1)}
          aria-label="Previous"
        />
        <Button icon={ChevronRightIcon} mode="bleed" onClick={() => step(1)} aria-label="Next" />
        <Button
          text="Today"
          mode="bleed"
          fontSize={1}
          onClick={() =>
            setCursor(new Date(today.getFullYear(), today.getMonth(), today.getDate()))
          }
        />
        <Box flex={1} paddingX={2}>
          <Text weight="semibold">
            {mode === 'month'
              ? monthLabel(cursor.getFullYear(), cursor.getMonth())
              : `Week of ${days[0]?.key ?? ''}`}
          </Text>
        </Box>
        <Segmented
          value={mode}
          options={[
            {value: 'month', label: 'Month'},
            {value: 'week', label: 'Week'},
          ]}
          onChange={setMode}
        />
      </Toolbar>

      <Box style={{display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 6}}>
        {WEEKDAYS.map((weekday) => (
          <Box key={weekday} paddingX={2} paddingY={1}>
            <Text size={0} muted weight="semibold" style={{letterSpacing: '.06em'}}>
              {weekday.toUpperCase()}
            </Text>
          </Box>
        ))}

        {days.map((day) => {
          const entries = byDay.get(day.key) ?? []
          const external = remoteDays.get(day.key) ?? []

          return (
            <Box
              key={day.key}
              className="zn-card zn-daycell"
              padding={2}
              style={{
                minHeight: mode === 'month' ? 104 : 240,
                opacity: day.inMonth ? 1 : 0.55,
                outline: day.isToday ? '2px solid #ff5500' : undefined,
                outlineOffset: -1,
              }}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => void drop(day.key)}
            >
              <Stack gap={2}>
                <Flex align="center" gap={1}>
                  <Text size={0} muted={!day.inMonth} weight={day.isToday ? 'semibold' : 'regular'}>
                    {day.date.getDate()}
                  </Text>
                  <Box flex={1} />
                  {onCreate && (
                    <span className="zn-add">
                      <Button
                        icon={AddIcon}
                        mode="bleed"
                        padding={1}
                        fontSize={0}
                        title={`New post on ${day.key}`}
                        aria-label={`New post on ${day.key}`}
                        onClick={() => onCreate(day.key)}
                      />
                    </span>
                  )}
                </Flex>

                {entries.map((post) => (
                  <button
                    key={post._id}
                    type="button"
                    className="zn-event"
                    aria-label={`Open ${post.title ?? 'post'}`}
                    draggable={post.status !== 'published'}
                    onDragStart={() => setDragging(post._id)}
                    onDragEnd={() => setDragging(undefined)}
                    onClick={() => onOpen(post)}
                  >
                    <Stack gap={2}>
                      <Flex align="center" gap={1}>
                        {[
                          ...new Set(
                            (post.targets ?? []).map((target) => target.platform).filter(Boolean),
                          ),
                        ].map((platform) => (
                          <PlatformIcon key={platform} platform={platform} size={11} />
                        ))}
                        <Text size={0} weight="semibold">
                          {timeLabel(post)}
                        </Text>
                      </Flex>
                      <Text size={0} textOverflow="ellipsis">
                        {post.title}
                      </Text>
                    </Stack>
                  </button>
                ))}

                {external.map((post) => (
                  <div key={post.id} className="zn-event zn-event--remote">
                    <Stack gap={2}>
                      <Flex align="center" gap={1}>
                        {[...new Set(post.platforms.map((entry) => entry.platform))].map(
                          (platform) => (
                            <PlatformIcon key={platform} platform={platform} size={11} />
                          ),
                        )}
                        <Text size={0} muted weight="semibold">
                          {remoteTimeLabel(post)}
                        </Text>
                      </Flex>
                      <Text size={0} muted textOverflow="ellipsis">
                        {post.content ?? 'in Zernio'}
                      </Text>
                    </Stack>
                  </div>
                ))}
              </Stack>
            </Box>
          )
        })}
      </Box>

      {undated.length > 0 && (
        <Stack gap={2}>
          <Text size={1} weight="medium">
            Without a date
          </Text>
          <Flex gap={2} wrap="wrap">
            {undated.map((post) => (
              <Card
                key={post._id}
                padding={2}
                radius={2}
                border
                draggable
                onDragStart={() => setDragging(post._id)}
                onDragEnd={() => setDragging(undefined)}
                onClick={() => onOpen(post)}
                style={{cursor: 'pointer'}}
              >
                <Flex align="center" gap={2}>
                  <Text size={0}>{post.title}</Text>
                  <Badge>{post.kind}</Badge>
                </Flex>
              </Card>
            ))}
          </Flex>
          <Text size={0} muted>
            Drag one onto a day to schedule it.
          </Text>
        </Stack>
      )}
    </Stack>
  )
}
