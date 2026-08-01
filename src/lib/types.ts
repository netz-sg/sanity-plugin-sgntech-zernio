/**
 * Platforms this plugin covers. Zernio itself speaks to more, but the editor
 * side — validation, preview, per-type options — is written for these two.
 *
 * @public
 */
export type ZernioPlatform = 'instagram' | 'facebook'

/**
 * The kind of post. Instagram and Facebook use the same names where they mean
 * the same thing.
 *
 * @public
 */
export type PostKind = 'feed' | 'carousel' | 'story' | 'reel'

/**
 * Where a post stands. `draft` and `ready` are ours, everything from `scheduled`
 * on is what Zernio reports back.
 *
 * @public
 */
export type PostStatus =
  | 'draft'
  | 'ready'
  | 'scheduled'
  | 'publishing'
  | 'published'
  | 'partial'
  | 'failed'

/**
 * A connected account, as Zernio returns it.
 *
 * @public
 */
export interface ZernioAccount {
  _id: string
  platform: string
  name?: string
  username?: string
  profileId?: string
  avatarUrl?: string
  disconnected?: boolean
}

/**
 * A profile — Zernio's container for accounts.
 *
 * @public
 */
export interface ZernioProfile {
  _id: string
  name?: string
  description?: string
}

/**
 * One image or video attached to a post.
 *
 * @public
 */
export interface SocialMediaItem {
  _key?: string
  _type?: string
  asset?: {
    _id?: string
    _ref?: string
    url?: string
    originalFilename?: string
    size?: number
    mimeType?: string
    metadata?: {dimensions?: {width?: number; height?: number; aspectRatio?: number}}
  }
  alt?: string
}

/**
 * The account a post goes to, stored on the document so the list keeps working
 * when Zernio is unreachable.
 *
 * @public
 */
export interface SocialTarget {
  _key?: string
  accountId?: string
  /** `instagram` or `facebook`; kept as a plain string so a new platform in Zernio does not break stored documents. */
  platform?: string
  label?: string
}

/**
 * What Zernio reported back for one target.
 *
 * @public
 */
export interface PublishResult {
  _key?: string
  accountId?: string
  platform?: string
  status?: string
  url?: string
  error?: string
}

/**
 * The value stored by this plugin's `socialPost` document type.
 *
 * @public
 */
export interface SocialPostValue {
  _id?: string
  _type?: string
  _rev?: string
  /** Internal name, only ever shown inside the Studio. */
  title?: string
  content?: string
  kind?: PostKind
  media?: SocialMediaItem[]
  targets?: SocialTarget[]
  scheduledFor?: string
  timezone?: string
  publishNow?: boolean
  status?: PostStatus
  zernioPostId?: string
  results?: PublishResult[]
  lastError?: string
  /** Per-kind extras. */
  firstComment?: string
  shareToFeed?: boolean
  isAiGenerated?: boolean
  collaborators?: string[]
  relatedTo?: {_ref?: string; _type?: string}
}

/**
 * A connected account as it is cached in the settings document.
 *
 * Deliberately not the API shape: Sanity reserves field names starting with an
 * underscore, so Zernio's `_id` is stored as `accountId`.
 *
 * @public
 */
export interface CachedAccount {
  accountId: string
  platform: string
  name?: string
  username?: string
  profileId?: string
  disconnected?: boolean
}

/**
 * Settings kept in the dataset, so a Studio can be set up without touching code.
 *
 * @public
 */
export interface ZernioSettings {
  _id?: string
  _type?: string
  /** The Zernio API key. See the readme for who can read this. */
  apiKey?: string
  /** Profile new posts default to. */
  profileId?: string
  /** Default timezone for scheduling, e.g. `Europe/Berlin`. */
  timezone?: string
  /** Cached accounts, so the document form works without a round trip. */
  accounts?: CachedAccount[]
  /** When the account cache was last refreshed. */
  accountsRefreshedAt?: string
}

/**
 * A rule that failed on a post, with the field it belongs to.
 *
 * @public
 */
export interface ValidationIssue {
  level: 'error' | 'warning'
  field: 'content' | 'media' | 'targets' | 'schedule'
  message: string
}
