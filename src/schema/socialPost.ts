import {defineArrayMember, defineField, defineType} from 'sanity'

import {TargetsInput} from '../components/TargetsInput'
import {ZernioIcon} from '../components/ZernioIcon'
import {SETTINGS_TYPE} from '../lib/settings'

/**
 * Options for {@link createSocialPostType}.
 *
 * @public
 */
export interface SocialPostTypeOptions {
  /** Document type name. Defaults to `socialPost`. */
  name?: string
  /** Label in the Studio. Defaults to `Social post`. */
  title?: string
  /** Document types a post may point at, e.g. `['post', 'release']`. */
  relatedTypes?: string[]
  /** Default timezone offered in new posts. */
  timezone?: string
}

const KINDS = [
  {title: 'Feed', value: 'feed'},
  {title: 'Carousel', value: 'carousel'},
  {title: 'Story', value: 'story'},
  {title: 'Reel', value: 'reel'},
]

const STATUSES = [
  {title: 'Draft', value: 'draft'},
  {title: 'Ready', value: 'ready'},
  {title: 'Scheduled', value: 'scheduled'},
  {title: 'Publishing', value: 'publishing'},
  {title: 'Published', value: 'published'},
  {title: 'Partly published', value: 'partial'},
  {title: 'Failed', value: 'failed'},
]

/**
 * Creates the `socialPost` document type — one post, one or more accounts.
 *
 * @public
 */
export function createSocialPostType(options: SocialPostTypeOptions = {}) {
  const {name = 'socialPost', title = 'Social post', relatedTypes = [], timezone = 'UTC'} = options

  return defineType({
    name,
    title,
    type: 'document',
    icon: ZernioIcon,
    groups: [
      {name: 'content', title: 'Content', default: true},
      {name: 'schedule', title: 'Schedule'},
      {name: 'status', title: 'Status'},
    ],
    fields: [
      defineField({
        name: 'title',
        title: 'Internal name',
        description: 'Only ever shown inside the Studio.',
        type: 'string',
        group: 'content',
        validation: (rule) => rule.required(),
      }),

      defineField({
        name: 'kind',
        title: 'Post type',
        description: 'One type per post — a reel and a story are two posts.',
        type: 'string',
        group: 'content',
        initialValue: 'feed',
        options: {list: KINDS, layout: 'radio', direction: 'horizontal'},
        validation: (rule) => rule.required(),
      }),

      defineField({
        name: 'content',
        title: 'Caption',
        type: 'text',
        rows: 5,
        group: 'content',
      }),

      defineField({
        name: 'media',
        title: 'Media',
        description:
          'Images and videos are handed to the platforms as Sanity CDN URLs, cropped to the format the post type expects.',
        type: 'array',
        group: 'content',
        of: [
          defineArrayMember({
            type: 'image',
            name: 'photo',
            options: {hotspot: true},
            fields: [defineField({name: 'alt', title: 'Alternative text', type: 'string'})],
          }),
          defineArrayMember({type: 'file', name: 'video', title: 'Video'}),
        ],
      }),

      defineField({
        name: 'targets',
        title: 'Accounts',
        description: 'Pick the connected accounts this post goes to.',
        type: 'array',
        group: 'content',
        components: {input: TargetsInput},
        of: [
          defineArrayMember({
            type: 'object',
            name: 'target',
            fields: [
              defineField({name: 'accountId', type: 'string'}),
              defineField({name: 'platform', type: 'string'}),
              defineField({name: 'label', type: 'string'}),
            ],
          }),
        ],
      }),

      defineField({
        name: 'firstComment',
        title: 'First comment',
        description: 'Posted right after publishing. Instagram feed and carousel only.',
        type: 'string',
        group: 'content',
        hidden: ({parent}) => parent?.kind !== 'feed' && parent?.kind !== 'carousel',
      }),

      defineField({
        name: 'shareToFeed',
        title: 'Also show the reel in the feed',
        type: 'boolean',
        group: 'content',
        initialValue: true,
        hidden: ({parent}) => parent?.kind !== 'reel',
      }),

      defineField({
        name: 'collaborators',
        title: 'Collaborators',
        description: 'Up to three public Instagram business or creator accounts.',
        type: 'array',
        of: [defineArrayMember({type: 'string'})],
        options: {layout: 'tags'},
        group: 'content',
        validation: (rule) => rule.max(3),
      }),

      defineField({
        name: 'isAiGenerated',
        title: 'Label as AI generated',
        type: 'boolean',
        group: 'content',
        initialValue: false,
      }),

      ...(relatedTypes.length > 0
        ? [
            defineField({
              name: 'relatedTo',
              title: 'About',
              description: 'The article or release this post belongs to.',
              type: 'reference',
              group: 'content',
              to: relatedTypes.map((type) => ({type})),
            }),
          ]
        : []),

      defineField({
        name: 'publishNow',
        title: 'Publish immediately',
        description: 'Ignores the scheduled time and posts as soon as it is sent.',
        type: 'boolean',
        group: 'schedule',
        initialValue: false,
      }),

      defineField({
        name: 'scheduledFor',
        title: 'Scheduled for',
        type: 'datetime',
        group: 'schedule',
        hidden: ({parent}) => parent?.publishNow === true,
      }),

      defineField({
        name: 'timezone',
        title: 'Timezone',
        description: 'The scheduled time is read in this zone, e.g. Europe/Berlin.',
        type: 'string',
        group: 'schedule',
        initialValue: timezone,
        hidden: ({parent}) => parent?.publishNow === true,
      }),

      defineField({
        name: 'status',
        title: 'Status',
        type: 'string',
        group: 'status',
        initialValue: 'draft',
        options: {list: STATUSES},
        readOnly: true,
      }),

      defineField({
        name: 'zernioPostId',
        title: 'Zernio post id',
        type: 'string',
        group: 'status',
        readOnly: true,
      }),

      defineField({
        name: 'results',
        title: 'Results',
        type: 'array',
        group: 'status',
        readOnly: true,
        of: [
          defineArrayMember({
            type: 'object',
            name: 'result',
            fields: [
              defineField({name: 'platform', type: 'string'}),
              defineField({name: 'accountId', type: 'string'}),
              defineField({name: 'status', type: 'string'}),
              defineField({name: 'url', title: 'Published post', type: 'url'}),
              defineField({name: 'error', type: 'string'}),
            ],
            preview: {
              select: {title: 'platform', subtitle: 'status'},
            },
          }),
        ],
      }),

      defineField({
        name: 'lastError',
        title: 'Last error',
        type: 'text',
        rows: 2,
        group: 'status',
        readOnly: true,
      }),
    ],

    preview: {
      select: {
        title: 'title',
        kind: 'kind',
        status: 'status',
        when: 'scheduledFor',
        media: 'media.0',
      },
      prepare(selection) {
        const parts = [selection.kind, selection.status].filter(
          (entry): entry is string => typeof entry === 'string' && entry.length > 0,
        )
        const when =
          typeof selection.when === 'string' ? selection.when.slice(0, 16).replace('T', ' ') : ''
        return {
          title: typeof selection.title === 'string' ? selection.title : 'Social post',
          subtitle: [parts.join(' · '), when].filter(Boolean).join(' — '),
          media: selection.media ?? ZernioIcon,
        }
      },
    },
  })
}

/**
 * Creates the settings singleton type. Hidden from the create menu — there is
 * exactly one, and the tool writes it.
 *
 * @public
 */
export function createSettingsType() {
  return defineType({
    name: SETTINGS_TYPE,
    title: 'Zernio settings',
    type: 'document',
    icon: ZernioIcon,
    // Not something anyone should create by hand; the tool owns this document.
    __experimental_omnisearch_visibility: false,
    fields: [
      defineField({name: 'apiKey', title: 'API key', type: 'string'}),
      defineField({name: 'profileId', title: 'Profile id', type: 'string'}),
      defineField({name: 'timezone', title: 'Timezone', type: 'string'}),
      defineField({
        name: 'accounts',
        title: 'Cached accounts',
        type: 'array',
        of: [
          defineArrayMember({
            type: 'object',
            name: 'account',
            fields: [
              defineField({name: 'accountId', title: 'Account id', type: 'string'}),
              defineField({name: 'platform', type: 'string'}),
              defineField({name: 'name', type: 'string'}),
              defineField({name: 'username', type: 'string'}),
              defineField({name: 'profileId', type: 'string'}),
              defineField({name: 'disconnected', type: 'boolean'}),
            ],
          }),
        ],
      }),
      defineField({name: 'accountsRefreshedAt', title: 'Accounts refreshed at', type: 'datetime'}),
    ],
  })
}
