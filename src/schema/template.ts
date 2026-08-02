import {defineArrayMember, defineField, defineType} from 'sanity'

import {ZernioIcon} from '../components/ZernioIcon'

/**
 * Options for {@link createTemplateType}.
 *
 * @public
 */
export interface TemplateTypeOptions {
  /** Document type name. Defaults to `zernioTemplate`. */
  name?: string
  /** Label in the Studio. Defaults to `Post template`. */
  title?: string
}

/**
 * Creates the template document type — a reusable caption, first comment and
 * hashtag set.
 *
 * @public
 */
export function createTemplateType(options: TemplateTypeOptions = {}) {
  const {name = 'zernioTemplate', title = 'Post template'} = options

  return defineType({
    name,
    title,
    type: 'document',
    icon: ZernioIcon,
    // Managed in the tool; nobody needs to find these through search.
    __experimental_omnisearch_visibility: false,
    fields: [
      defineField({
        name: 'title',
        title: 'Name',
        description: 'How the template is listed when picking one.',
        type: 'string',
        validation: (rule) => rule.required(),
      }),

      defineField({
        name: 'caption',
        title: 'Caption',
        description:
          'Replaces the caption when applied. Placeholders like {{title}}, {{date}}, {{time}}, {{kind}} and {{accounts}} are filled in; anything else stays visible so it is obvious what is missing.',
        type: 'text',
        rows: 5,
      }),

      defineField({
        name: 'firstComment',
        title: 'First comment',
        description: 'Instagram feed and carousel only. Placeholders work here too.',
        type: 'text',
        rows: 2,
      }),

      defineField({
        name: 'hashtags',
        title: 'Hashtags',
        description: 'With or without the #. Duplicates are dropped when applied.',
        type: 'array',
        of: [defineArrayMember({type: 'string'})],
        options: {layout: 'tags'},
      }),

      defineField({
        name: 'hashtagPlacement',
        title: 'Put the hashtags in',
        type: 'string',
        initialValue: 'caption',
        options: {
          list: [
            {title: 'The caption', value: 'caption'},
            {title: 'The first comment', value: 'firstComment'},
          ],
          layout: 'radio',
          direction: 'horizontal',
        },
      }),
    ],

    preview: {
      select: {title: 'title', caption: 'caption', hashtags: 'hashtags'},
      prepare(selection) {
        const hashtags = Array.isArray(selection.hashtags) ? selection.hashtags.length : 0
        const caption = typeof selection.caption === 'string' ? selection.caption : ''

        return {
          title: typeof selection.title === 'string' ? selection.title : 'Template',
          subtitle: [caption.slice(0, 60), hashtags ? `${hashtags} hashtags` : '']
            .filter(Boolean)
            .join(' · '),
          media: ZernioIcon,
        }
      },
    },
  })
}
