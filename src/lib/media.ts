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
 * Where a dataset lives, so an asset reference can be turned into a URL.
 *
 * @public
 */
export interface AssetSource {
  projectId: string
  dataset: string
}

/**
 * Builds the CDN URL of an asset from its reference.
 *
 * The document form only ever has `asset._ref` — the dereferenced asset with its
 * `url` is a query-time thing. The reference carries everything the URL needs,
 * so the preview does not have to wait for a round trip.
 *
 * @public
 */
export function assetUrlFromRef(
  reference: string | undefined,
  source: AssetSource,
): string | undefined {
  if (!reference || !source.projectId || !source.dataset) return undefined
  const parts = reference.split('-')
  const kind = parts.shift()

  if (kind === 'image') {
    const format = parts.pop()
    const dimensions = parts.pop()
    const id = parts.join('-')
    if (!format || !dimensions || !id) return undefined
    return `https://cdn.sanity.io/images/${source.projectId}/${source.dataset}/${id}-${dimensions}.${format}`
  }

  if (kind === 'file') {
    const extension = parts.pop()
    const id = parts.join('-')
    if (!extension || !id) return undefined
    return `https://cdn.sanity.io/files/${source.projectId}/${source.dataset}/${id}.${extension}`
  }

  return undefined
}

/** `1080x1350` out of an image reference. */
function dimensionsFromRef(
  reference: string | undefined,
): {width: number; height: number; aspectRatio: number} | undefined {
  if (!reference?.startsWith('image-')) return undefined
  const dimensions = reference.split('-').at(-2) ?? ''
  const [width, height] = dimensions.split('x').map(Number)
  if (!width || !height) return undefined
  return {width, height, aspectRatio: width / height}
}

/**
 * Fills in `asset.url` and the dimensions for media that only carries a
 * reference, so the same preview works in the form and in the tool.
 *
 * @public
 */
export function resolveMedia(
  media: SocialMediaItem[] | undefined,
  source: AssetSource,
): SocialMediaItem[] {
  if (!Array.isArray(media)) return []

  return media.map((item) => {
    const reference = item?.asset?._ref
    if (!item?.asset || item.asset.url || !reference) return item

    const url = assetUrlFromRef(reference, source)
    if (!url) return item

    return {
      ...item,
      asset: {
        ...item.asset,
        url,
        metadata: item.asset.metadata ?? {dimensions: dimensionsFromRef(reference)},
      },
    }
  })
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
