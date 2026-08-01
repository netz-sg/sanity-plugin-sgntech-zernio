import {describe, expect, it} from 'vitest'

import {canSend, platformsOf, rulesFor, usableMedia, validatePost} from './rules'
import type {SocialMediaItem, SocialPostValue} from './types'

const image = (overrides: Partial<SocialMediaItem['asset']> = {}): SocialMediaItem => ({
  _key: Math.random().toString(36).slice(2),
  asset: {
    _id: 'image-abc-1080x1350-jpg',
    url: 'https://cdn.sanity.io/images/p/d/abc-1080x1350.jpg',
    size: 2 * 1024 * 1024,
    metadata: {dimensions: {width: 1080, height: 1350, aspectRatio: 0.8}},
    ...overrides,
  },
})

const base: SocialPostValue = {
  title: 'Test',
  kind: 'feed',
  content: 'A caption',
  media: [image()],
  targets: [{accountId: 'a1', platform: 'instagram', label: 'IG'}],
  scheduledFor: '2027-01-01T12:00:00.000Z',
}

const errors = (value: SocialPostValue) =>
  validatePost(value)
    .filter((issue) => issue.level === 'error')
    .map((issue) => issue.message)

describe('rulesFor', () => {
  it('knows the limits per platform and kind', () => {
    expect(rulesFor('instagram', 'carousel')).toMatchObject({minMedia: 2, maxMedia: 10})
    expect(rulesFor('facebook', 'feed').maxImageBytes).toBe(4 * 1024 * 1024)
    expect(rulesFor('instagram', 'feed').maxContent).toBe(2200)
  })

  it('falls back to the stricter platform for anything unknown', () => {
    expect(rulesFor('mastodon', 'feed')).toEqual(rulesFor('instagram', 'feed'))
  })
})

describe('validatePost', () => {
  it('passes a well-formed post', () => {
    expect(errors(base)).toEqual([])
    expect(canSend(base)).toBe(true)
  })

  it('insists on an account', () => {
    expect(errors({...base, targets: []})).toContain('Pick at least one account')
  })

  it('counts media against the kind', () => {
    expect(errors({...base, kind: 'carousel'})[0]).toMatch(/at least 2 media/)
    expect(errors({...base, kind: 'feed', media: [image(), image()]})[0]).toMatch(/at most 1 media/)
  })

  it('requires a caption where the platform does', () => {
    expect(errors({...base, content: '   '})).toContain('instagram feed needs a caption')
    // A story has no caption field to speak of, so none is required.
    expect(errors({...base, kind: 'story', content: ''})).toEqual([])
  })

  it('catches captions that are too long', () => {
    const long = 'x'.repeat(2500)
    expect(errors({...base, content: long})[0]).toMatch(/allows 2200 characters/)
  })

  it('catches files the platform would reject', () => {
    const big = image({size: 6 * 1024 * 1024})
    expect(
      errors({...base, media: [big], targets: [{accountId: 'f', platform: 'facebook'}]})[0],
    ).toMatch(/facebook feed allows 4 MB/)
    // The same file is fine on Instagram, which allows 8 MB.
    expect(errors({...base, media: [big]})).toEqual([])
  })

  it('warns about crops instead of blocking them', () => {
    const wide = image({metadata: {dimensions: {width: 1920, height: 1080, aspectRatio: 1.78}}})
    const issues = validatePost({...base, kind: 'story', media: [wide]})
    expect(issues.every((issue) => issue.level === 'warning')).toBe(true)
    expect(issues.some((issue) => issue.message.includes('cropped'))).toBe(true)
  })

  it('warns when the caption runs past the fold', () => {
    const issues = validatePost({...base, content: 'x'.repeat(200)})
    expect(issues.some((issue) => issue.message.includes('more'))).toBe(true)
    expect(errors({...base, content: 'x'.repeat(200)})).toEqual([])
  })

  it('checks every targeted platform, not just the first', () => {
    const big = image({size: 6 * 1024 * 1024})
    const both = {
      ...base,
      media: [big],
      targets: [
        {accountId: 'i', platform: 'instagram'},
        {accountId: 'f', platform: 'facebook'},
      ],
    }
    expect(errors(both)).toHaveLength(1)
    expect(errors(both)[0]).toMatch(/facebook/)
  })

  it('mentions a missing time without blocking the send', () => {
    const issues = validatePost({...base, scheduledFor: undefined})
    expect(issues.some((issue) => issue.message.includes('draft'))).toBe(true)
    expect(canSend({...base, scheduledFor: undefined})).toBe(true)
  })
})

describe('helpers', () => {
  it('lists targeted platforms once each', () => {
    expect(
      platformsOf({
        targets: [
          {platform: 'instagram'},
          {platform: 'instagram'},
          {platform: 'facebook'},
          {platform: ''},
        ],
      }),
    ).toEqual(['instagram', 'facebook'])
  })

  it('drops media rows without an asset', () => {
    const withGaps = JSON.parse('[{"_key":"empty"},null]')
    expect(usableMedia([image(), ...withGaps])).toHaveLength(1)
    expect(usableMedia(undefined)).toEqual([])
  })
})
