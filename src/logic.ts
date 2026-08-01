/**
 * The parts that have nothing to do with the Studio: the rules, the payload
 * builder, the API client and the calendar maths.
 *
 * This entry imports neither `sanity` nor `@sanity/ui`, so it runs in a plain
 * Node process, in a serverless function or in tests — useful for validating a
 * post before sending it from somewhere other than the Studio.
 *
 * ```ts
 * import {validatePost, postPayload, ZernioClient} from 'sanity-plugin-sgntech-zernio/logic'
 * ```
 *
 * @packageDocumentation
 */

export {postPayload, ZERNIO_BASE_URL, ZernioClient, ZernioError} from './lib/client'
export type {ZernioClientOptions} from './lib/client'
export {
  canSend,
  platformsOf,
  rulesFor,
  usableMedia,
  validatePost,
  type KindRules,
} from './lib/rules'
export {
  deliveryUrl,
  isVideo,
  KIND_GEOMETRY,
  mediaItemsFor,
  mediaType,
  willBeCropped,
} from './lib/media'
export {
  dayOf,
  monthGrid,
  moveToDay,
  postsByDay,
  timeLabel,
  weekGrid,
  type CalendarDay,
} from './lib/calendar'
export {keyWarning, SETTINGS_ID, SETTINGS_TYPE} from './lib/settings'
export type {
  CachedAccount,
  PostKind,
  PostStatus,
  PublishResult,
  SocialMediaItem,
  SocialPostValue,
  SocialTarget,
  ValidationIssue,
  ZernioAccount,
  ZernioPlatform,
  ZernioProfile,
  ZernioSettings,
} from './lib/types'
