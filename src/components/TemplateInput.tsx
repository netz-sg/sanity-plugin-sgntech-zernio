import {useCallback} from 'react'
import {PatchEvent, set, useFormCallbacks, useFormValue} from 'sanity'

import type {SocialPostValue} from '../lib/types'
import {TemplateBar} from './TemplateBar'

function readString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

/**
 * The template picker inside the document form.
 *
 * Writes straight into the caption and first comment fields of the document it
 * sits in — the field it is attached to never stores anything itself.
 *
 * @public
 */
export function TemplateInput(props: {templateType: string}): React.JSX.Element {
  const {templateType} = props
  const {onChange} = useFormCallbacks()

  const title = useFormValue(['title'])
  const content = useFormValue(['content'])
  const firstComment = useFormValue(['firstComment'])
  const kind = useFormValue(['kind'])
  const scheduledFor = useFormValue(['scheduledFor'])

  const post: SocialPostValue = {
    title: readString(title),
    content: readString(content),
    firstComment: readString(firstComment),
    kind: kind === 'carousel' || kind === 'story' || kind === 'reel' ? kind : 'feed',
    scheduledFor: readString(scheduledFor),
  }

  const apply = useCallback(
    (patch: Partial<SocialPostValue>) => {
      // Patches go to the document root, not to this field: the picker edits the
      // caption and the first comment, and stores nothing of its own.
      const patches = Object.entries(patch).map(([field, value]) => set(value, [field]))
      onChange(PatchEvent.from(patches))
    },
    [onChange],
  )

  return <TemplateBar templateType={templateType} post={post} onApply={apply} />
}

/**
 * Binds {@link TemplateInput} to a template type, for use as a field input.
 *
 * Built once when the schema is created — a component defined inline in the
 * schema would be a new type on every render and remount the picker.
 *
 * @public
 */
export function createTemplateInput(templateType: string): () => React.JSX.Element {
  return function BoundTemplateInput() {
    return <TemplateInput templateType={templateType} />
  }
}
