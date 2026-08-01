import {describe, expect, it} from 'vitest'

import {dayOf, monthGrid, moveToDay, postsByDay, timeLabel} from './calendar'
import {postPayload} from './client'
import {deliveryUrl, mediaItemsFor} from './media'
import type {SocialMediaItem, SocialPostValue} from './types'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/** The platform entries of a payload, read without a type assertion. */
function platformsIn(value: SocialPostValue): Record<string, unknown>[] {
  const platforms = postPayload(value).platforms
  return Array.isArray(platforms) ? platforms.filter(isRecord) : []
}

/** The extras of the first platform entry. */
function specificsIn(value: SocialPostValue, index = 0): Record<string, unknown> {
  const entry = platformsIn(value)[index]
  const specific = entry?.platformSpecificData
  return isRecord(specific) ? specific : {}
}

const photo: SocialMediaItem = {
  _key: 'm1',
  asset: {
    _id: 'image-abc-1080x1350-jpg',
    url: 'https://cdn.sanity.io/images/p/d/abc-1080x1350.jpg',
    metadata: {dimensions: {width: 1080, height: 1350, aspectRatio: 0.8}},
  },
}

const video: SocialMediaItem = {
  _key: 'm2',
  asset: {
    _id: 'file-def-mp4',
    url: 'https://cdn.sanity.io/files/p/d/def.mp4',
    mimeType: 'video/mp4',
  },
}

describe('deliveryUrl', () => {
  it('crops images to the geometry the kind expects', () => {
    const url = new URL(String(deliveryUrl(photo, 'story')))
    expect(url.searchParams.get('w')).toBe('1080')
    expect(url.searchParams.get('h')).toBe('1920')
    expect(url.searchParams.get('fit')).toBe('crop')
  })

  it('uses the feed geometry for feed and carousel', () => {
    expect(deliveryUrl(photo, 'feed')).toContain('h=1350')
    expect(deliveryUrl(photo, 'carousel')).toContain('h=1350')
  })

  it('passes videos through untouched — the image pipeline cannot transcode', () => {
    expect(deliveryUrl(video, 'reel')).toBe('https://cdn.sanity.io/files/p/d/def.mp4')
  })

  it('is empty without an asset', () => {
    expect(deliveryUrl({_key: 'x'}, 'feed')).toBeUndefined()
  })
})

describe('mediaItemsFor', () => {
  it('builds what Zernio expects and keeps the order', () => {
    expect(mediaItemsFor([photo, video], 'carousel')).toEqual([
      {url: expect.stringContaining('w=1080'), type: 'image'},
      {url: 'https://cdn.sanity.io/files/p/d/def.mp4', type: 'video'},
    ])
  })
})

describe('postPayload', () => {
  const base: SocialPostValue = {
    content: ' Hello ',
    kind: 'feed',
    media: [photo],
    targets: [
      {accountId: 'a1', platform: 'instagram'},
      {accountId: 'a2', platform: 'facebook'},
    ],
    scheduledFor: '2027-03-05T12:00:00.000Z',
    timezone: 'Europe/Berlin',
  }

  it('sends a scheduled post with a local time and a zone', () => {
    const payload = postPayload(base)
    expect(payload).toMatchObject({
      content: 'Hello',
      scheduledFor: '2027-03-05T12:00:00',
      timezone: 'Europe/Berlin',
    })
    expect(payload).not.toHaveProperty('publishNow')
  })

  it('drops the schedule when publishing immediately', () => {
    const payload = postPayload({...base, publishNow: true})
    expect(payload).toMatchObject({publishNow: true})
    expect(payload).not.toHaveProperty('scheduledFor')
  })

  it('leaves both out for a draft', () => {
    const payload = postPayload({...base, scheduledFor: undefined})
    expect(payload).not.toHaveProperty('scheduledFor')
    expect(payload).not.toHaveProperty('publishNow')
  })

  it('marks stories through platformSpecificData', () => {
    expect(specificsIn({...base, kind: 'story'})).toMatchObject({contentType: 'story'})
  })

  it('carries the reel switch and the first comment where they belong', () => {
    expect(specificsIn({...base, kind: 'reel', shareToFeed: false})).toMatchObject({
      shareToFeed: false,
    })
    expect(specificsIn({...base, firstComment: ' #hashtags '})).toMatchObject({
      firstComment: '#hashtags',
    })
    // A story has no comment field, so it must not be sent along.
    expect(specificsIn({...base, kind: 'story', firstComment: 'x'})).not.toHaveProperty(
      'firstComment',
    )
  })

  it('sends collaborators to Instagram only', () => {
    const value = {...base, collaborators: ['guest', ' ']}
    expect(specificsIn(value, 0)).toMatchObject({collaborators: ['guest']})
    expect(specificsIn(value, 1)).not.toHaveProperty('collaborators')
  })

  it('skips targets without an account', () => {
    expect(platformsIn({...base, targets: [{platform: 'instagram'}]})).toEqual([])
  })
})

describe('calendar', () => {
  const today = new Date(2026, 7, 1)

  it('starts the month grid on a Monday and covers whole weeks', () => {
    const days = monthGrid(2026, 7, today)
    expect(days[0].date.getDay()).toBe(1)
    expect(days.length % 7).toBe(0)
    expect(days.some((day) => day.isToday)).toBe(true)
  })

  it('groups posts by day and sorts them by time', () => {
    const posts: SocialPostValue[] = [
      {_id: 'b', scheduledFor: new Date(2026, 7, 3, 18, 0).toISOString()},
      {_id: 'a', scheduledFor: new Date(2026, 7, 3, 9, 30).toISOString()},
      {_id: 'c'},
    ]
    const grouped = postsByDay(posts)
    expect([...grouped.keys()]).toEqual(['2026-08-03'])
    expect(grouped.get('2026-08-03')?.map((post) => post._id)).toEqual(['a', 'b'])
    expect(dayOf(posts[2])).toBeUndefined()
  })

  it('keeps the time of day when a post is dragged to another day', () => {
    const moved = new Date(moveToDay(new Date(2026, 7, 3, 18, 45).toISOString(), '2026-08-09'))
    expect(moved.getDate()).toBe(9)
    expect(moved.getHours()).toBe(18)
    expect(moved.getMinutes()).toBe(45)
  })

  it('drops an undated post at midday rather than midnight', () => {
    expect(new Date(moveToDay(undefined, '2026-08-09')).getHours()).toBe(12)
  })

  it('formats the time for the calendar entry', () => {
    expect(timeLabel({scheduledFor: new Date(2026, 7, 3, 9, 5).toISOString()})).toBe('09:05')
    expect(timeLabel({})).toBe('')
  })
})
