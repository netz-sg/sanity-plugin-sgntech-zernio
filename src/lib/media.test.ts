import {describe, expect, it} from 'vitest'

import {assetUrlFromRef, resolveMedia} from './media'

const SOURCE = {projectId: 'abc123', dataset: 'production'}

describe('assetUrlFromRef', () => {
  it('builds an image URL from a reference', () => {
    expect(assetUrlFromRef('image-Tb9Ew8CXIwaY6R1kjMvI0uRR-2000x3000-jpg', SOURCE)).toBe(
      'https://cdn.sanity.io/images/abc123/production/Tb9Ew8CXIwaY6R1kjMvI0uRR-2000x3000.jpg',
    )
  })

  it('builds a file URL from a reference', () => {
    expect(assetUrlFromRef('file-Tb9Ew8CXIwaY6R1kjMvI0uRR-mp4', SOURCE)).toBe(
      'https://cdn.sanity.io/files/abc123/production/Tb9Ew8CXIwaY6R1kjMvI0uRR.mp4',
    )
  })

  it('returns nothing for what it cannot read', () => {
    expect(assetUrlFromRef(undefined, SOURCE)).toBeUndefined()
    expect(assetUrlFromRef('image-broken', SOURCE)).toBeUndefined()
    expect(assetUrlFromRef('drafts.something', SOURCE)).toBeUndefined()
    expect(assetUrlFromRef('image-x-10x10-jpg', {projectId: '', dataset: ''})).toBeUndefined()
  })
})

describe('resolveMedia', () => {
  it('fills in URL and dimensions from the reference', () => {
    const [item] = resolveMedia(
      [{_key: 'a', asset: {_ref: 'image-abc-1080x1350-jpg'}}],
      SOURCE,
    )

    expect(item.asset?.url).toBe('https://cdn.sanity.io/images/abc123/production/abc-1080x1350.jpg')
    expect(item.asset?.metadata?.dimensions).toEqual({
      width: 1080,
      height: 1350,
      aspectRatio: 0.8,
    })
  })

  it('leaves media that already has a URL alone', () => {
    const media = [{_key: 'a', asset: {_ref: 'image-abc-10x10-jpg', url: 'https://example.test/a'}}]
    expect(resolveMedia(media, SOURCE)).toEqual(media)
  })

  it('survives rows without an asset', () => {
    expect(resolveMedia([{_key: 'a'}], SOURCE)).toEqual([{_key: 'a'}])
    expect(resolveMedia(undefined, SOURCE)).toEqual([])
  })
})
