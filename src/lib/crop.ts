import type {PostKind} from './types'

/**
 * The part of the source image that is used, as fractions cut off each side.
 *
 * Deliberately Sanity's own crop shape: what the tool writes here is what the
 * image field's crop tool writes, so the two never fight over the same picture.
 *
 * @public
 */
export interface ImageCrop {
  top: number
  bottom: number
  left: number
  right: number
}

/**
 * How the crop is being looked at while dragging: a zoom factor and the centre
 * of the visible rectangle, both easier to reason about than four edges.
 *
 * @public
 */
export interface CropView {
  /** 1 is the largest rectangle of the target ratio that fits the source. */
  zoom: number
  /** Centre of the visible rectangle, as fractions of the source. */
  cx: number
  cy: number
}

/**
 * Width and height of an image.
 *
 * @public
 */
export interface Dimensions {
  width: number
  height: number
}

const MAX_ZOOM = 5

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function round(value: number): number {
  return Math.round(value * 10_000) / 10_000
}

/**
 * The largest rectangle of the wanted ratio that fits into the source, in
 * source pixels. Zoom 1 shows exactly this.
 *
 * @public
 */
export function baseRect(source: Dimensions, aspect: number): Dimensions {
  if (source.width <= 0 || source.height <= 0 || aspect <= 0) return {width: 0, height: 0}

  return source.width / source.height > aspect
    ? {width: source.height * aspect, height: source.height}
    : {width: source.width, height: source.width / aspect}
}

/**
 * Turns a zoom and a centre into a crop, keeping the rectangle inside the
 * image — dragging past the edge stops rather than showing empty space.
 *
 * @public
 */
export function cropFromView(source: Dimensions, aspect: number, view: CropView): ImageCrop {
  const base = baseRect(source, aspect)
  if (base.width === 0) return {top: 0, bottom: 0, left: 0, right: 0}

  const zoom = clamp(view.zoom || 1, 1, MAX_ZOOM)
  const width = base.width / zoom / source.width
  const height = base.height / zoom / source.height

  const cx = clamp(view.cx, width / 2, 1 - width / 2)
  const cy = clamp(view.cy, height / 2, 1 - height / 2)

  return {
    left: round(Math.max(0, cx - width / 2)),
    right: round(Math.max(0, 1 - (cx + width / 2))),
    top: round(Math.max(0, cy - height / 2)),
    bottom: round(Math.max(0, 1 - (cy + height / 2))),
  }
}

/**
 * The other direction: what zoom and centre a stored crop corresponds to, so
 * reopening the editor continues where it left off.
 *
 * @public
 */
export function viewFromCrop(
  source: Dimensions,
  aspect: number,
  crop: ImageCrop | undefined,
): CropView {
  const base = baseRect(source, aspect)
  if (!crop || base.width === 0) return {zoom: 1, cx: 0.5, cy: 0.5}

  const width = 1 - crop.left - crop.right
  const height = 1 - crop.top - crop.bottom
  if (width <= 0 || height <= 0) return {zoom: 1, cx: 0.5, cy: 0.5}

  return {
    zoom: clamp(base.width / (width * source.width), 1, MAX_ZOOM),
    cx: crop.left + width / 2,
    cy: crop.top + height / 2,
  }
}

/**
 * The `rect=` parameter of the image pipeline, in source pixels.
 *
 * @public
 */
export function rectParam(source: Dimensions, crop: ImageCrop | undefined): string | undefined {
  if (!crop || source.width <= 0 || source.height <= 0) return undefined

  const width = Math.round((1 - crop.left - crop.right) * source.width)
  const height = Math.round((1 - crop.top - crop.bottom) * source.height)
  if (width < 1 || height < 1) return undefined

  // A rect that covers everything is the same as no rect — and shorter URLs
  // keep the CDN cache from splitting over nothing.
  if (width >= source.width && height >= source.height) return undefined

  const left = Math.round(crop.left * source.width)
  const top = Math.round(crop.top * source.height)

  return `${left},${top},${width},${height}`
}

/**
 * The ratio the image actually has after its crop — what the platform sees,
 * which is the only ratio worth validating.
 *
 * @public
 */
export function effectiveAspect(
  source: Dimensions | undefined,
  crop: ImageCrop | undefined,
): number | undefined {
  if (!source?.width || !source?.height) return undefined
  if (!crop) return source.width / source.height

  const width = (1 - crop.left - crop.right) * source.width
  const height = (1 - crop.top - crop.bottom) * source.height
  if (width <= 0 || height <= 0) return undefined

  return width / height
}

/**
 * One rectangle the platform's own interface covers up.
 *
 * @public
 */
export interface SafeZone {
  label: string
  /** Fractions of the frame, from each side. */
  top: number
  bottom: number
  left: number
  right: number
}

/**
 * The areas Instagram covers with its own interface, as an overlay for the
 * editor. Numbers from Meta's story and reel design guidance.
 *
 * These are an editing aid only — nothing of this is baked into the image or
 * sent anywhere.
 *
 * @public
 */
export const SAFE_ZONES: Partial<Record<PostKind, SafeZone[]>> = {
  story: [
    {label: 'Profile row and close button', top: 0, bottom: 0.87, left: 0, right: 0},
    {label: 'Reply bar', top: 0.87, bottom: 0, left: 0, right: 0},
  ],
  reel: [
    {label: 'Top bar', top: 0, bottom: 0.93, left: 0, right: 0},
    {label: 'Caption and audio', top: 0.8, bottom: 0, left: 0, right: 0.25},
    {label: 'Action buttons', top: 0.45, bottom: 0.2, left: 0.78, right: 0},
  ],
}
