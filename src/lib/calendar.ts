import type {SocialPostValue} from './types'

/**
 * One day in the calendar grid.
 *
 * @public
 */
export interface CalendarDay {
  /** `YYYY-MM-DD`. */
  key: string
  date: Date
  inMonth: boolean
  isToday: boolean
}

function isoDay(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * The days of a month grid, padded to whole weeks starting on Monday — so the
 * grid always has complete rows and the first column is always Monday.
 *
 * @public
 */
export function monthGrid(year: number, month: number, today: Date): CalendarDay[] {
  const first = new Date(year, month, 1)
  // getDay() is Sunday-based; shift so Monday is 0.
  const leading = (first.getDay() + 6) % 7
  const start = new Date(year, month, 1 - leading)

  const todayKey = isoDay(today)
  const days: CalendarDay[] = []

  for (let index = 0; index < 42; index++) {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index)
    days.push({
      key: isoDay(date),
      date,
      inMonth: date.getMonth() === month,
      isToday: isoDay(date) === todayKey,
    })
    // Stop after a full week once the month is over — five rows are enough for
    // most months, six only when the month spills that far.
    if (index >= 27 && index % 7 === 6 && date.getMonth() !== month) break
  }

  return days
}

/**
 * The week a date sits in, Monday first.
 *
 * @public
 */
export function weekGrid(around: Date, today: Date): CalendarDay[] {
  const offset = (around.getDay() + 6) % 7
  const monday = new Date(around.getFullYear(), around.getMonth(), around.getDate() - offset)
  const todayKey = isoDay(today)

  return Array.from({length: 7}, (_, index) => {
    const date = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + index)
    return {key: isoDay(date), date, inMonth: true, isToday: isoDay(date) === todayKey}
  })
}

/**
 * The day a post belongs to, or `undefined` for posts without a time.
 *
 * @public
 */
export function dayOf(post: SocialPostValue | undefined): string | undefined {
  const raw = (post?.scheduledFor ?? '').trim()
  if (!raw) return undefined
  const date = new Date(raw)
  return Number.isNaN(date.getTime()) ? undefined : isoDay(date)
}

/**
 * Groups posts by day for the grid.
 *
 * @public
 */
export function postsByDay(posts: SocialPostValue[]): Map<string, SocialPostValue[]> {
  const map = new Map<string, SocialPostValue[]>()

  for (const post of posts) {
    const day = dayOf(post)
    if (!day) continue
    const list = map.get(day)
    if (list) list.push(post)
    else map.set(day, [post])
  }

  for (const list of map.values()) {
    list.sort((a, b) => (a.scheduledFor ?? '').localeCompare(b.scheduledFor ?? ''))
  }

  return map
}

/**
 * Moves a post to another day, keeping the time of day it already had.
 *
 * Dragging a post in the calendar changes the date, never the hour — that is
 * what people expect, and it keeps carefully chosen posting times intact.
 *
 * @public
 */
export function moveToDay(scheduledFor: string | undefined, dayKey: string): string {
  const [year, month, day] = dayKey.split('-').map(Number)
  const previous = scheduledFor ? new Date(scheduledFor) : undefined
  const hours = previous && !Number.isNaN(previous.getTime()) ? previous.getHours() : 12
  const minutes = previous && !Number.isNaN(previous.getTime()) ? previous.getMinutes() : 0

  const moved = new Date(year, (month ?? 1) - 1, day ?? 1, hours, minutes, 0, 0)
  return moved.toISOString()
}

/**
 * `HH:MM` of a post, for the calendar entry.
 *
 * @public
 */
export function timeLabel(post: SocialPostValue | undefined): string {
  const raw = (post?.scheduledFor ?? '').trim()
  if (!raw) return ''
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return ''
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}
