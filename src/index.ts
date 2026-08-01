import {definePlugin} from 'sanity'

import {createSendAction} from './actions/sendToZernio'
import {ZernioIcon} from './components/ZernioIcon'
import {ZernioTool} from './components/ZernioTool'
import {
  createSettingsType,
  createSocialPostType,
  type SocialPostTypeOptions,
} from './schema/socialPost'

/**
 * Configuration for {@link zernio}.
 *
 * @public
 */
export interface ZernioConfig extends SocialPostTypeOptions {
  /** Title of the tool in the Studio navigation. Defaults to `Zernio`. */
  toolTitle?: string
  /** Register the document action that sends a post. Defaults to `true`. */
  documentAction?: boolean
}

/**
 * Plan, preview and publish Instagram and Facebook posts from inside Sanity
 * Studio, through the Zernio API.
 *
 * Posts are documents, so they get drafts, version history, roles and a
 * reference to whatever they are about. The tool adds the cockpit: a calendar,
 * a filtered list, previews in the geometry of each post type, and a settings
 * panel for the API key, profiles and connected accounts.
 *
 * ```ts
 * import {defineConfig} from 'sanity'
 * import {zernio} from 'sanity-plugin-sgntech-zernio'
 *
 * export default defineConfig({
 *   plugins: [zernio({relatedTypes: ['post', 'release'], timezone: 'Europe/Berlin'})],
 * })
 * ```
 *
 * The API key is stored in the dataset. Everyone who can read the dataset can
 * use it — see the readme before deciding which key to put in.
 *
 * @public
 */
export const zernio = definePlugin<ZernioConfig | void>((config) => {
  const options = config || {}
  const documentType = options.name ?? 'socialPost'

  return {
    name: 'sanity-plugin-sgntech-zernio',

    schema: {
      types: [createSocialPostType(options), createSettingsType()],
    },

    tools: [
      {
        name: 'zernio',
        title: options.toolTitle ?? 'Zernio',
        icon: ZernioIcon,
        component: ZernioTool,
        options: {documentType},
      },
    ],

    document: {
      actions: (previous, context) => {
        if (options.documentAction === false) return previous
        if (context.schemaType !== documentType) return previous
        return [...previous, createSendAction(documentType)]
      },
    },
  }
})

export {
  createSocialPostType,
  createSettingsType,
  type SocialPostTypeOptions,
} from './schema/socialPost'
export {ZernioTool, type ZernioToolProps} from './components/ZernioTool'
export {Composer} from './components/Composer'
export {PostPreview} from './components/PostPreview'
export {PostPreviewInput} from './components/PostPreviewInput'
export {PlatformIcon} from './components/PlatformIcon'
export {RemotePostGrid} from './components/RemotePostGrid'
export {ZernioClient, ZernioError, postPayload, ZERNIO_BASE_URL} from './lib/client'
export type {ZernioClientOptions} from './lib/client'
export {isPending, refreshStatus, sendPost, type SendOutcome} from './lib/send'
export {
  canSend,
  platformsOf,
  rulesFor,
  usableMedia,
  validatePost,
  type KindRules,
} from './lib/rules'
export {
  assetUrlFromRef,
  deliveryUrl,
  isVideo,
  KIND_GEOMETRY,
  mediaItemsFor,
  mediaType,
  resolveMedia,
  willBeCropped,
  type AssetSource,
} from './lib/media'
export {
  dayOf,
  monthGrid,
  moveToDay,
  postsByDay,
  remoteByDay,
  remoteTimeLabel,
  timeLabel,
  weekGrid,
  type CalendarDay,
} from './lib/calendar'
export {
  cacheAccounts,
  clearSetting,
  keyWarning,
  readSettings,
  SETTINGS_ID,
  SETTINGS_TYPE,
  writeSettings,
} from './lib/settings'
export type {
  CachedAccount,
  PostKind,
  PostStatus,
  PublishResult,
  RemotePost,
  SocialMediaItem,
  SocialPostValue,
  SocialTarget,
  ValidationIssue,
  ZernioAccount,
  ZernioPlatform,
  ZernioProfile,
  ZernioSettings,
} from './lib/types'
