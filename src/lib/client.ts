import {mediaItemsFor} from './media'
import type {
  PublishResult,
  RemotePost,
  SocialPostValue,
  ZernioAccount,
  ZernioProfile,
} from './types'

/**
 * Base URL of the Zernio API.
 *
 * @public
 */
export const ZERNIO_BASE_URL = 'https://zernio.com/api/v1'

/**
 * An error carrying what the API actually said, so the Studio can show it
 * instead of a generic failure.
 *
 * @public
 */
export class ZernioError extends Error {
  readonly status: number
  readonly body: unknown

  constructor(message: string, status: number, body: unknown) {
    super(message)
    this.name = 'ZernioError'
    this.status = status
    this.body = body
  }
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined
  return Object.fromEntries(Object.entries(value))
}

function readString(source: unknown, key: string): string | undefined {
  const record = asRecord(source)
  const value = record?.[key]
  return typeof value === 'string' && value.trim() ? value : undefined
}

function readBoolean(source: unknown, key: string): boolean | undefined {
  const record = asRecord(source)
  const value = record?.[key]
  return typeof value === 'boolean' ? value : undefined
}

function readArray(source: unknown, key: string): unknown[] {
  const record = asRecord(source)
  const value = record?.[key]
  return Array.isArray(value) ? value : []
}

function messageFrom(body: unknown, fallback: string): string {
  for (const key of ['message', 'error', 'detail']) {
    const value = readString(body, key)
    if (value) return value
  }
  return fallback
}

/**
 * Options for {@link ZernioClient}.
 *
 * @public
 */
export interface ZernioClientOptions {
  apiKey: string
  baseUrl?: string
  /** Swapped out in tests. */
  fetch?: typeof globalThis.fetch
}

/**
 * A thin client over the parts of the Zernio API this plugin uses.
 *
 * Every response is read field by field instead of being trusted wholesale —
 * an API that changes shape should make a field disappear, not crash a Studio.
 *
 * @public
 */
export class ZernioClient {
  private readonly apiKey: string
  private readonly baseUrl: string
  private readonly doFetch: typeof globalThis.fetch

  constructor(options: ZernioClientOptions) {
    this.apiKey = options.apiKey
    this.baseUrl = options.baseUrl ?? ZERNIO_BASE_URL
    this.doFetch = options.fetch ?? globalThis.fetch.bind(globalThis)
  }

  private async request(
    path: string,
    init: {method?: string; body?: unknown; query?: Record<string, string | undefined>} = {},
  ): Promise<unknown> {
    const url = new URL(`${this.baseUrl}${path}`)
    for (const [key, value] of Object.entries(init.query ?? {})) {
      if (value) url.searchParams.set(key, value)
    }

    const response = await this.doFetch(url.toString(), {
      method: init.method ?? 'GET',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    })

    const text = await response.text()
    let body: unknown
    if (text) {
      try {
        body = JSON.parse(text)
      } catch {
        body = text
      }
    }

    if (!response.ok) {
      throw new ZernioError(
        messageFrom(body, `Zernio responded with ${response.status}`),
        response.status,
        body,
      )
    }

    return body
  }

  /** Verifies the key and reports what it is allowed to do. */
  async checkKey(): Promise<{ok: boolean; scope?: string; permission?: string}> {
    try {
      const body = await this.request('/api-keys')
      const first = readArray(body, 'apiKeys')[0]
      return {
        ok: true,
        scope: readString(first, 'scope'),
        permission: readString(first, 'permission'),
      }
    } catch (error) {
      if (error instanceof ZernioError && error.status === 401) return {ok: false}
      // A key without permission to list keys is still a working key.
      if (error instanceof ZernioError && error.status === 403) return {ok: true}
      throw error
    }
  }

  async listProfiles(): Promise<ZernioProfile[]> {
    const body = await this.request('/profiles')
    return readArray(body, 'profiles').flatMap((entry) => {
      const id = readString(entry, '_id')
      return id
        ? [
            {
              _id: id,
              name: readString(entry, 'name'),
              description: readString(entry, 'description'),
            },
          ]
        : []
    })
  }

  async createProfile(name: string, description?: string): Promise<ZernioProfile | undefined> {
    const body = await this.request('/profiles', {method: 'POST', body: {name, description}})
    const record = asRecord(body)?.profile
    const id = readString(record, '_id')
    return id ? {_id: id, name: readString(record, 'name')} : undefined
  }

  async listAccounts(profileId?: string): Promise<ZernioAccount[]> {
    const body = await this.request('/accounts', {query: {profileId}})
    return readArray(body, 'accounts').flatMap((entry) => {
      const id = readString(entry, '_id')
      if (!id) return []
      return [
        {
          _id: id,
          platform: readString(entry, 'platform') ?? '',
          name: readString(entry, 'name'),
          username: readString(entry, 'username'),
          profileId: readString(entry, 'profileId'),
          disconnected: readBoolean(entry, 'disconnected'),
        },
      ]
    })
  }

  /** The OAuth URL a user opens to connect an account. */
  async connectUrl(platform: string, profileId: string): Promise<string | undefined> {
    const body = await this.request(`/connect/${platform}`, {query: {profileId}})
    return readString(body, 'authUrl')
  }

  async createPost(body: Record<string, unknown>): Promise<{id?: string; status?: string}> {
    const response = await this.request('/posts', {method: 'POST', body})
    const post = asRecord(response)?.post
    return {id: readString(post, '_id'), status: readString(post, 'status')}
  }

  /**
   * Everything Zernio has, not only what this Studio sent — the dashboard, a
   * second tool or a colleague's phone all end up here too.
   */
  async listPosts(
    options: {limit?: number; dateFrom?: string; dateTo?: string; profileId?: string} = {},
  ): Promise<RemotePost[]> {
    const body = await this.request('/posts', {
      query: {
        limit: String(options.limit ?? 200),
        sortBy: 'scheduled-desc',
        dateFrom: options.dateFrom,
        dateTo: options.dateTo,
        profileId: options.profileId,
      },
    })

    return readArray(body, 'posts').flatMap((entry) => {
      const id = readString(entry, '_id')
      if (!id) return []

      // The list response is not documented down to the media field, and it has
      // carried different names. Read every plausible one instead of guessing.
      const rawMedia = [
        ...readArray(entry, 'mediaItems'),
        ...readArray(entry, 'media'),
        ...readArray(entry, 'attachments'),
      ]
      const media = rawMedia.flatMap((item) => {
        const url =
          readString(item, 'thumbnailUrl') ??
          readString(item, 'thumbnail') ??
          readString(item, 'url') ??
          (typeof item === 'string' ? item : undefined)
        if (!url) return []
        const kind = readString(item, 'type') ?? ''
        return [{url, type: kind.startsWith('video') ? ('video' as const) : ('image' as const)}]
      })

      return [
        {
          id,
          content: readString(entry, 'content') ?? readString(entry, 'title'),
          status: readString(entry, 'status'),
          scheduledFor: readString(entry, 'scheduledFor'),
          platforms: readArray(entry, 'platforms').map((platform) => {
            const account = asRecord(platform)?.accountId
            return {
              platform: readString(platform, 'platform'),
              account:
                readString(account, 'displayName') ??
                readString(account, 'username') ??
                readString(platform, 'accountId'),
              status: readString(platform, 'status'),
              url: readString(platform, 'platformPostUrl'),
            }
          }),
          media,
        },
      ]
    })
  }

  async getPost(postId: string): Promise<{status?: string; results: PublishResult[]}> {
    const response = await this.request(`/posts/${postId}`)
    const post = asRecord(response)?.post

    return {
      status: readString(post, 'status'),
      results: readArray(post, 'platforms').map((entry) => ({
        accountId: readString(entry, 'accountId'),
        platform: readString(entry, 'platform'),
        status: readString(entry, 'status'),
        url: readString(entry, 'platformPostUrl'),
        error: readString(entry, 'error'),
      })),
    }
  }
}

/**
 * Turns a `socialPost` document into the body Zernio expects.
 *
 * Kept separate from the client so it can be tested without a network, and so
 * the exact payload is visible in one place.
 *
 * @public
 */
export function postPayload(value: SocialPostValue): Record<string, unknown> {
  const platforms = (value.targets ?? [])
    .filter((target) => target?.accountId && target?.platform)
    .map((target) => {
      const entry: Record<string, unknown> = {
        platform: target.platform,
        accountId: target.accountId,
      }

      const specific: Record<string, unknown> = {}
      if (value.kind === 'story') specific.contentType = 'story'
      if (value.kind === 'reel' && typeof value.shareToFeed === 'boolean') {
        specific.shareToFeed = value.shareToFeed
      }
      if (value.isAiGenerated) specific.isAiGenerated = true
      if (value.firstComment?.trim() && (value.kind === 'feed' || value.kind === 'carousel')) {
        specific.firstComment = value.firstComment.trim()
      }
      const collaborators = (value.collaborators ?? []).map((name) => name.trim()).filter(Boolean)
      if (collaborators.length > 0 && target.platform === 'instagram') {
        specific.collaborators = collaborators
      }

      if (Object.keys(specific).length > 0) entry.platformSpecificData = specific
      return entry
    })

  const body: Record<string, unknown> = {
    content: (value.content ?? '').trim(),
    mediaItems: mediaItemsFor(value.media, value.kind),
    platforms,
  }

  if (value.publishNow) {
    body.publishNow = true
  } else if (value.scheduledFor) {
    // Zernio wants a local timestamp plus the zone, not an instant.
    body.scheduledFor = value.scheduledFor.replace(/Z$/, '').slice(0, 19)
    body.timezone = value.timezone || 'UTC'
  }

  return body
}
