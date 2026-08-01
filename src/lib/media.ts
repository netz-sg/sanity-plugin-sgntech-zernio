import {rulesFor} from './rules'
import type {PostKind, SocialMediaItem} from './types'

/**
 * The target geometry per kind — what the platform shows without cropping.
 *
 * @public
 */
export const KIND_GEOMETRY: Record<PostKind, {width: number; height: number}> = {
  feed: {width: 1080, height: 1350},
  carousel: {width: 1080, height: 1350},
  story: {width: 1080, height: 1920},
  reel: {width: 1080, height: 1920},
}

/**
 * True when the asset is a video. Videos go to the platform untouched — the
 * image pipeline cannot transcode them.
 *
 * @public
 */
export function isVideo(item: SocialMediaItem | undefined): boolean {
  const mime = item?.asset?.mimeType ?? ''
  if (mime.startsWith('video/')) return true
  const id = item?.asset?._id ?? item?.asset?._ref ?? ''
  return id.startsWith('file-')
}

/**
 * Builds the URL handed to Zernio.
 *
 * Images run through Sanity's image pipeline on the way out: cropped to the
 * geometry the kind expects and converted to JPEG, which keeps them under the
 * platform's size limit without anyone editing files by hand. Videos are passed
 * through as they are.
 *
 * @public
 */
export function deliveryUrl(
  item: SocialMediaItem | undefined,
  kind: PostKind | undefined,
  options: {quality?: number} = {},
): string | undefined {
  const url = item?.asset?.url
  if (!url) return undefined
  if (isVideo(item)) return url

  const geometry = KIND_GEOMETRY[kind ?? 'feed']
  const quality = options.quality ?? 90
  const parameters = new URLSearchParams({
    w: String(geometry.width),
    h: String(geometry.height),
    fit: 'crop',
    crop: 'entropy',
    auto: 'format',
    q: String(quality),
  })

  return `${url}?${parameters.toString()}`
}

/**
 * The media type Zernio expects alongside the URL.
 *
 * @public
 */
export function mediaType(item: SocialMediaItem | undefined): 'image' | 'video' {
  return isVideo(item) ? 'video' : 'image'
}

/**
 * Turns the document's media into Zernio's `mediaItems`.
 *
 * @public
 */
export function mediaItemsFor(
  media: SocialMediaItem[] | undefined,
  kind: PostKind | undefined,
): {url: string; type: 'image' | 'video'}[] {
  if (!Array.isArray(media)) return []

  return media
    .map((item) => {
      const url = deliveryUrl(item, kind)
      return url ? {url, type: mediaType(item)} : undefined
    })
    .filter((item): item is {url: string; type: 'image' | 'video'} => Boolean(item))
}

/**
 * Whether an item will be cropped for a given platform and kind — the preview
 * uses this to say so before anyone publishes.
 *
 * @public
 */
export function willBeCropped(
  item: SocialMediaItem | undefined,
  platform: string | undefined,
  kind: PostKind | undefined,
): boolean {
  const dimensions = item?.asset?.metadata?.dimensions
  const aspect =
    dimensions?.aspectRatio ??
    (dimensions?.width && dimensions?.height ? dimensions.width / dimensions.height : undefined)
  if (!aspect) return false

  const rules = rulesFor(platform, kind)
  return aspect < rules.aspect.min || aspect > rules.aspect.max
}
