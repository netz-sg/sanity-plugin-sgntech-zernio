import type {SanityClient} from 'sanity'

import {postPayload, type ZernioClient} from './client'
import {canSend, validatePost} from './rules'
import type {PostStatus, SocialPostValue} from './types'

/**
 * What happened when a post was handed to Zernio.
 *
 * @public
 */
export interface SendOutcome {
  ok: boolean
  status?: PostStatus
  zernioPostId?: string
  message: string
}

const STATUSES: PostStatus[] = [
  'draft',
  'ready',
  'scheduled',
  'publishing',
  'published',
  'partial',
  'failed',
]

/** Zernio's status string, or `undefined` when it is one we do not know. */
function toStatus(value: unknown): PostStatus | undefined {
  return STATUSES.find((status) => status === value)
}

function publishedId(id: string | undefined): string {
  return (id ?? '').replace(/^drafts\./, '')
}

/**
 * Sends a post to Zernio and writes the outcome back onto the document.
 *
 * Refuses to send when validation finds an error — the same rules the editor
 * sees, so nothing is rejected by the API that the Studio could have caught.
 *
 * @public
 */
export async function sendPost(
  sanity: SanityClient,
  zernio: ZernioClient,
  value: SocialPostValue,
): Promise<SendOutcome> {
  const problems = validatePost(value).filter((issue) => issue.level === 'error')
  if (!canSend(value)) {
    return {ok: false, message: problems.map((issue) => issue.message).join(' · ')}
  }

  const id = publishedId(value._id)
  if (!id) return {ok: false, message: 'The post has to be saved before it can be sent'}

  try {
    const created = await zernio.createPost(postPayload(value))
    const status = toStatus(created.status) ?? 'scheduled'

    await sanity
      .patch(id)
      .set({status, zernioPostId: created.id})
      .unset(['lastError'])
      .commit({visibility: 'async'})

    return {
      ok: true,
      status,
      zernioPostId: created.id,
      message: value.publishNow ? 'Publishing now' : 'Scheduled with Zernio',
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    await sanity
      .patch(id)
      .set({status: 'failed', lastError: message})
      .commit({visibility: 'async'})
      .catch(() => undefined)

    return {ok: false, message}
  }
}

/**
 * Asks Zernio how a post is doing and writes status, links and errors back.
 *
 * Returns `true` when the document changed, so a polling loop can stop once
 * everything has settled.
 *
 * @public
 */
export async function refreshStatus(
  sanity: SanityClient,
  zernio: ZernioClient,
  value: SocialPostValue,
): Promise<boolean> {
  const id = publishedId(value._id)
  if (!id || !value.zernioPostId) return false

  const {status: raw, results} = await zernio.getPost(value.zernioPostId)
  const status = toStatus(raw)
  if (!status || status === value.status) return false

  await sanity
    .patch(id)
    .set({
      status,
      results: results.map((result, index) =>
        Object.assign({_key: `r${index}`, _type: 'result'}, result),
      ),
    })
    .commit({visibility: 'async'})

  return true
}

/**
 * Posts that are worth asking about — everything that has been handed over but
 * has not reached a final state.
 *
 * @public
 */
export function isPending(value: SocialPostValue | undefined): boolean {
  if (!value?.zernioPostId) return false
  return value.status === 'scheduled' || value.status === 'publishing'
}
