import {describe, expect, it} from 'vitest'

import {baseRect, cropFromView, rectParam, viewFromCrop} from './crop'

const LANDSCAPE = {width: 2000, height: 1000}
const PORTRAIT = {width: 1000, height: 2000}
const FEED = 1080 / 1350
const STORY = 1080 / 1920

describe('baseRect', () => {
  it('fits the height of a wide image', () => {
    expect(baseRect(LANDSCAPE, FEED)).toEqual({width: 800, height: 1000})
  })

  it('fits the width of a tall image', () => {
    expect(baseRect(PORTRAIT, FEED)).toEqual({width: 1000, height: 1250})
  })

  it('returns nothing for an image without dimensions', () => {
    expect(baseRect({width: 0, height: 0}, FEED)).toEqual({width: 0, height: 0})
  })
})

describe('cropFromView', () => {
  it('cuts the sides of a wide image at zoom 1', () => {
    const crop = cropFromView(LANDSCAPE, FEED, {zoom: 1, cx: 0.5, cy: 0.5})

    expect(crop.top).toBe(0)
    expect(crop.bottom).toBe(0)
    expect(crop.left).toBeCloseTo(0.3, 3)
    expect(crop.right).toBeCloseTo(0.3, 3)
  })

  it('keeps the rectangle inside the image when dragged past the edge', () => {
    const crop = cropFromView(LANDSCAPE, FEED, {zoom: 1, cx: 2, cy: -1})

    expect(crop.right).toBe(0)
    expect(crop.top).toBe(0)
    expect(crop.left).toBeCloseTo(0.6, 3)
  })

  it('shows less of the image the further it is zoomed in', () => {
    const one = cropFromView(PORTRAIT, STORY, {zoom: 1, cx: 0.5, cy: 0.5})
    const two = cropFromView(PORTRAIT, STORY, {zoom: 2, cx: 0.5, cy: 0.5})

    expect(1 - two.left - two.right).toBeCloseTo((1 - one.left - one.right) / 2, 3)
  })
})

describe('viewFromCrop', () => {
  it('is the inverse of cropFromView', () => {
    const view = {zoom: 1.75, cx: 0.4, cy: 0.55}
    const crop = cropFromView(PORTRAIT, FEED, view)
    const back = viewFromCrop(PORTRAIT, FEED, crop)

    expect(back.zoom).toBeCloseTo(view.zoom, 2)
    expect(back.cx).toBeCloseTo(view.cx, 2)
    expect(back.cy).toBeCloseTo(view.cy, 2)
  })

  it('falls back to the centre without a crop', () => {
    expect(viewFromCrop(PORTRAIT, FEED, undefined)).toEqual({zoom: 1, cx: 0.5, cy: 0.5})
  })
})

describe('rectParam', () => {
  it('is in source pixels', () => {
    expect(rectParam(LANDSCAPE, {top: 0, bottom: 0, left: 0.3, right: 0.3})).toBe('600,0,800,1000')
  })

  it('is left out when the whole image is used', () => {
    expect(rectParam(LANDSCAPE, {top: 0, bottom: 0, left: 0, right: 0})).toBeUndefined()
    expect(rectParam(LANDSCAPE, undefined)).toBeUndefined()
  })

  it('is left out when nothing would be left', () => {
    expect(rectParam(LANDSCAPE, {top: 0.5, bottom: 0.5, left: 0.5, right: 0.5})).toBeUndefined()
  })
})
