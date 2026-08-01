import {Badge, Box, Button, Card, Flex, Stack, Text} from '@sanity/ui'
import {useCallback, useMemo, useState} from 'react'
import {useClient} from 'sanity'

import {dayOf, monthGrid, moveToDay, postsByDay, timeLabel, weekGrid} from '../lib/calendar'
import type {SocialPostValue} from '../lib/types'

const API_VERSION = '2024-10-01'
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const STATUS_TONE: Record<string, 'default' | 'primary' | 'positive' | 'caution' | 'critical'> = {
  draft: 'default',
  ready: 'primary',
  scheduled: 'primary',
  publishing: 'caution',
  published: 'positive',
  partial: 'caution',
  failed: 'critical',
}

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
  onOpen: (post: SocialPostValue) => void
  onChanged: () => void
}): React.JSX.Element {
  const {posts, onOpen, onChanged} = props
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
      <Flex align="center" gap={2} wrap="wrap">
        <Button text="←" mode="ghost" onClick={() => step(-1)} aria-label="Previous" />
        <Button text="→" mode="ghost" onClick={() => step(1)} aria-label="Next" />
        <Button
          text="Today"
          mode="ghost"
          onClick={() =>
            setCursor(new Date(today.getFullYear(), today.getMonth(), today.getDate()))
          }
        />
        <Box flex={1}>
          <Text weight="medium">
            {mode === 'month'
              ? monthLabel(cursor.getFullYear(), cursor.getMonth())
              : `Week of ${days[0]?.key ?? ''}`}
          </Text>
        </Box>
        <Button
          text="Month"
          mode={mode === 'month' ? 'default' : 'ghost'}
          tone={mode === 'month' ? 'primary' : 'default'}
          onClick={() => setMode('month')}
        />
        <Button
          text="Week"
          mode={mode === 'week' ? 'default' : 'ghost'}
          tone={mode === 'week' ? 'primary' : 'default'}
          onClick={() => setMode('week')}
        />
      </Flex>

      <Box style={{display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 4}}>
        {WEEKDAYS.map((weekday) => (
          <Box key={weekday} padding={2}>
            <Text size={0} muted weight="medium">
              {weekday}
            </Text>
          </Box>
        ))}

        {days.map((day) => {
          const entries = byDay.get(day.key) ?? []

          return (
            <Card
              key={day.key}
              padding={2}
              radius={2}
              border
              tone={day.isToday ? 'primary' : day.inMonth ? 'default' : 'transparent'}
              style={{minHeight: mode === 'month' ? 96 : 220}}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => void drop(day.key)}
            >
              <Stack gap={2}>
                <Text size={0} muted={!day.inMonth}>
                  {day.date.getDate()}
                </Text>

                {entries.map((post) => (
                  <Card
                    key={post._id}
                    padding={2}
                    radius={2}
                    tone={STATUS_TONE[post.status ?? 'draft'] ?? 'default'}
                    draggable={post.status !== 'published'}
                    onDragStart={() => setDragging(post._id)}
                    onDragEnd={() => setDragging(undefined)}
                    onClick={() => onOpen(post)}
                    style={{cursor: 'pointer'}}
                  >
                    <Stack gap={1}>
                      <Text size={0} weight="medium" textOverflow="ellipsis">
                        {timeLabel(post)} {post.title}
                      </Text>
                      <Text size={0} muted textOverflow="ellipsis">
                        {post.kind} · {(post.targets ?? []).length} account(s)
                      </Text>
                    </Stack>
                  </Card>
                ))}
              </Stack>
            </Card>
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
