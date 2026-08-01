import type {PostKind, SocialMediaItem, SocialPostValue, ValidationIssue} from './types'

/**
 * What a platform allows per kind of post. Taken from Zernio's platform guides;
 * the numbers are the ones the API rejects on, so checking them here means the
 * editor hears about it while writing instead of hours later.
 *
 * @public
 */
export interface KindRules {
  minMedia: number
  maxMedia: number
  /** Characters of caption the platform accepts. */
  maxContent: number
  /** Characters shown before the "more" fold. */
  foldAt: number
  /** Bytes per image. */
  maxImageBytes: number
  /** Aspect ratios that are safe, as width divided by height. */
  aspect: {min: number; max: number}
  /** Whether a caption is required at all. */
  contentRequired: boolean
}

const MB = 1024 * 1024

const INSTAGRAM: Record<PostKind, KindRules> = {
  feed: {
    minMedia: 1,
    maxMedia: 1,
    maxContent: 2200,
    foldAt: 125,
    maxImageBytes: 8 * MB,
    aspect: {min: 0.8, max: 1.91},
    contentRequired: true,
  },
  carousel: {
    minMedia: 2,
    maxMedia: 10,
    maxContent: 2200,
    foldAt: 125,
    maxImageBytes: 8 * MB,
    aspect: {min: 0.8, max: 1.91},
    contentRequired: true,
  },
  story: {
    minMedia: 1,
    maxMedia: 1,
    maxContent: 2200,
    foldAt: 125,
    maxImageBytes: 8 * MB,
    aspect: {min: 0.5, max: 0.6},
    contentRequired: false,
  },
  reel: {
    minMedia: 1,
    maxMedia: 1,
    maxContent: 2200,
    foldAt: 125,
    maxImageBytes: 8 * MB,
    aspect: {min: 0.5, max: 0.6},
    contentRequired: false,
  },
}

const FACEBOOK: Record<PostKind, KindRules> = {
  feed: {
    minMedia: 0,
    maxMedia: 10,
    maxContent: 63206,
    foldAt: 480,
    maxImageBytes: 4 * MB,
    aspect: {min: 0.4, max: 2.5},
    contentRequired: false,
  },
  carousel: {
    minMedia: 2,
    maxMedia: 5,
    maxContent: 63206,
    foldAt: 480,
    maxImageBytes: 4 * MB,
    aspect: {min: 0.4, max: 2.5},
    contentRequired: false,
  },
  story: {
    minMedia: 1,
    maxMedia: 1,
    maxContent: 63206,
    foldAt: 480,
    maxImageBytes: 4 * MB,
    aspect: {min: 0.5, max: 0.6},
    contentRequired: false,
  },
  reel: {
    minMedia: 1,
    maxMedia: 1,
    maxContent: 63206,
    foldAt: 480,
    maxImageBytes: 4 * MB,
    aspect: {min: 0.5, max: 0.6},
    contentRequired: false,
  },
}

/**
 * The rules for one platform and kind, defaulting to Instagram's — the stricter
 * of the two, so an unknown platform is never waved through.
 *
 * @public
 */
export function rulesFor(platform: string | undefined, kind: PostKind | undefined): KindRules {
  // Anything unknown is measured against Instagram, the stricter of the two.
  const table = platform === 'facebook' ? FACEBOOK : INSTAGRAM
  return table[kind ?? 'feed'] ?? INSTAGRAM.feed
}

/**
 * Every platform a post is aimed at, without duplicates.
 *
 * @public
 */
export function platformsOf(value: SocialPostValue | undefined): string[] {
  const platforms = (value?.targets ?? [])
    .map((target) => (target?.platform ?? '').trim())
    .filter(Boolean)
  return [...new Set(platforms)]
}

/**
 * Usable media items — an image row without an asset is what an editor leaves
 * behind when deleting one.
 *
 * @public
 */
export function usableMedia(media: SocialMediaItem[] | undefined): SocialMediaItem[] {
  if (!Array.isArray(media)) return []
  return media.filter((item) => Boolean(item?.asset))
}

function aspectOf(item: SocialMediaItem): number | undefined {
  const dimensions = item.asset?.metadata?.dimensions
  if (dimensions?.aspectRatio) return dimensions.aspectRatio
  if (dimensions?.width && dimensions?.height) return dimensions.width / dimensions.height
  return undefined
}

function formatBytes(bytes: number): string {
  return `${Math.round((bytes / (1024 * 1024)) * 10) / 10} MB`
}

/**
 * Checks a post against the rules of every platform it targets.
 *
 * Errors are what Zernio would reject; warnings are what the platform accepts
 * but crops or hides — a 1:1 image in a story, a caption past the fold.
 *
 * @public
 */
export function validatePost(value: SocialPostValue | undefined): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  if (!value) return issues

  const media = usableMedia(value.media)
  const content = (value.content ?? '').trim()
  const platforms = platformsOf(value)
  const kind = value.kind ?? 'feed'

  if (platforms.length === 0) {
    issues.push({level: 'error', field: 'targets', message: 'Pick at least one account'})
  }

  for (const platform of platforms) {
    const rules = rulesFor(platform, kind)
    const where = `${platform} ${kind}`

    if (media.length < rules.minMedia) {
      issues.push({
        level: 'error',
        field: 'media',
        message: `${where} needs at least ${rules.minMedia} media item${rules.minMedia === 1 ? '' : 's'}`,
      })
    }
    if (media.length > rules.maxMedia) {
      issues.push({
        level: 'error',
        field: 'media',
        message: `${where} takes at most ${rules.maxMedia} media item${rules.maxMedia === 1 ? '' : 's'}`,
      })
    }
    if (rules.contentRequired && !content) {
      issues.push({level: 'error', field: 'content', message: `${where} needs a caption`})
    }
    if (content.length > rules.maxContent) {
      issues.push({
        level: 'error',
        field: 'content',
        message: `${where} allows ${rules.maxContent} characters, this is ${content.length}`,
      })
    }

    media.forEach((item, index) => {
      const size = item.asset?.size
      if (typeof size === 'number' && size > rules.maxImageBytes) {
        issues.push({
          level: 'error',
          field: 'media',
          message: `Media ${index + 1} is ${formatBytes(size)} — ${where} allows ${formatBytes(rules.maxImageBytes)}`,
        })
      }

      const aspect = aspectOf(item)
      if (aspect && (aspect < rules.aspect.min || aspect > rules.aspect.max)) {
        issues.push({
          level: 'warning',
          field: 'media',
          message: `Media ${index + 1} has an aspect ratio of ${aspect.toFixed(2)} — ${where} shows ${rules.aspect.min} to ${rules.aspect.max}, so it will be cropped`,
        })
      }
    })

    if (content.length > rules.foldAt) {
      issues.push({
        level: 'warning',
        field: 'content',
        message: `${where} hides everything past ${rules.foldAt} characters behind "more"`,
      })
    }
  }

  // A carousel of one is a feed post, and Zernio would silently treat it as one.
  if (kind === 'carousel' && media.length === 1) {
    issues.push({
      level: 'warning',
      field: 'media',
      message: 'A carousel with one item is just a feed post',
    })
  }

  if (!value.publishNow && !value.scheduledFor) {
    issues.push({
      level: 'warning',
      field: 'schedule',
      message: 'No time set — this will be saved as a draft in Zernio',
    })
  }

  return issues
}

/**
 * True when nothing stands in the way of sending.
 *
 * @public
 */
export function canSend(value: SocialPostValue | undefined): boolean {
  return validatePost(value).every((issue) => issue.level !== 'error')
}
