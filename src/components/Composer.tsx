import {CropIcon} from '@sanity/icons/Crop'
import {ImageIcon} from '@sanity/icons/Image'
import {PublishIcon} from '@sanity/icons/Publish'
import {TrashIcon} from '@sanity/icons/Trash'
import {
  Badge,
  Box,
  Button,
  Card,
  Dialog,
  Flex,
  Stack,
  Switch,
  Text,
  TextArea,
  TextInput,
} from '@sanity/ui'
import {useCallback, useMemo, useRef, useState} from 'react'
import {useClient} from 'sanity'

import {useZernioClient, useZernioSettings} from '../hooks/useZernio'
import {deliveryUrl, isVideo} from '../lib/media'
import {canSend, rulesFor, validatePost} from '../lib/rules'
import {sendPost} from '../lib/send'
import type {PostKind, PostStatus, SocialMediaItem, SocialPostValue} from '../lib/types'
import {MediaEditor} from './MediaEditor'
import {PlatformIcon} from './PlatformIcon'
import {PostPreview} from './PostPreview'
import {TemplateBar} from './TemplateBar'
import {StatusPill} from './ui'

const API_VERSION = '2024-10-01'

const KINDS: {value: PostKind; label: string; note: string}[] = [
  {value: 'feed', label: 'Feed', note: '4:5 · one image'},
  {value: 'carousel', label: 'Carousel', note: '4:5 · 2–10 images'},
  {value: 'story', label: 'Story', note: '9:16 · 24 hours'},
  {value: 'reel', label: 'Reel', note: '9:16 · video'},
]

/** The fields the composer owns. Everything else on the document is left alone. */
const OWNED = [
  'title',
  'kind',
  'content',
  'firstComment',
  'media',
  'targets',
  'publishNow',
  'scheduledFor',
  'timezone',
] as const

/** `YYYY-MM-DDTHH:mm` for the datetime input, in local time. */
function toLocalInput(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function startTime(post: SocialPostValue | undefined, initialDay: string | undefined): string {
  const raw = (post?.scheduledFor ?? '').trim()
  if (raw) {
    const parsed = new Date(raw)
    if (!Number.isNaN(parsed.getTime())) return toLocalInput(parsed)
  }
  return toLocalInput(
    initialDay ? new Date(`${initialDay}T12:00:00`) : new Date(Date.now() + 3600_000),
  )
}

/**
 * Write, edit and publish a post without leaving the tool.
 *
 * The document is still written — that is what keeps history, roles and the
 * status write-back working — but nothing here sends anyone to the desk.
 *
 * @public
 */
export function Composer(props: {
  documentType: string
  templateType: string
  /** The post being edited, or nothing for a new one. */
  post?: SocialPostValue
  initialDay?: string
  onSent: () => void
  onChanged: () => void
  onDeleted?: () => void
  onNewTemplate?: () => void
}): React.JSX.Element {
  const {
    documentType,
    templateType,
    post,
    initialDay,
    onSent,
    onChanged,
    onDeleted,
    onNewTemplate,
  } = props
  const client = useClient({apiVersion: API_VERSION})
  const {settings} = useZernioSettings()
  const zernio = useZernioClient(settings.apiKey)
  const fileInput = useRef<HTMLInputElement>(null)

  const [postId, setPostId] = useState(post?._id)
  const [title, setTitle] = useState(post?.title ?? '')
  const [kind, setKind] = useState<PostKind>(post?.kind ?? 'feed')
  const [content, setContent] = useState(post?.content ?? '')
  const [firstComment, setFirstComment] = useState(post?.firstComment ?? '')
  const [media, setMedia] = useState<SocialMediaItem[]>(post?.media ?? [])
  const [accountIds, setAccountIds] = useState<string[]>(
    (post?.targets ?? []).map((target) => target.accountId ?? '').filter(Boolean),
  )
  const [publishNow, setPublishNow] = useState(post?.publishNow ?? false)
  const [when, setWhen] = useState(() => startTime(post, initialDay))
  const [editing, setEditing] = useState<string | undefined>()
  const [busy, setBusy] = useState<string | undefined>()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [note, setNote] = useState<{tone: 'positive' | 'critical'; text: string} | undefined>()

  const status: PostStatus = post?.status ?? 'draft'
  const sent = Boolean(post?.zernioPostId)
  const editingItem = media.find((item) => (item._key ?? '') === editing)

  const accounts = useMemo(
    () =>
      (settings.accounts ?? []).filter((account) =>
        ['instagram', 'facebook'].includes((account.platform ?? '').toLowerCase()),
      ),
    [settings.accounts],
  )

  const value: SocialPostValue = useMemo(
    () => ({
      _id: postId,
      title: title.trim() || 'Untitled',
      kind,
      content,
      // Only Instagram feed and carousel have one; sending it elsewhere is noise.
      firstComment:
        (kind === 'feed' || kind === 'carousel') && firstComment.trim() ? firstComment : undefined,
      media,
      publishNow,
      scheduledFor: publishNow ? undefined : new Date(when).toISOString(),
      timezone: settings.timezone || 'UTC',
      targets: accountIds.map((id) => {
        const account = accounts.find((entry) => entry.accountId === id)
        return {
          _key: id,
          accountId: id,
          platform: (account?.platform ?? '').toLowerCase(),
          label: account?.name ?? account?.username ?? id,
        }
      }),
      status,
      zernioPostId: post?.zernioPostId,
    }),
    [
      accountIds,
      accounts,
      content,
      firstComment,
      kind,
      media,
      post?.zernioPostId,
      postId,
      publishNow,
      settings.timezone,
      status,
      title,
      when,
    ],
  )

  /** Writes the post and returns its id, creating the document the first time. */
  const store = useCallback(
    async (nextStatus: PostStatus) => {
      const fields = Object.fromEntries(OWNED.map((field) => [field, value[field] ?? null]))

      if (postId) {
        // Only the fields the composer owns are touched — results, the Zernio id
        // and anything a project added to the type stay as they are.
        await client
          .patch(postId)
          .set({...fields, status: nextStatus})
          .commit({visibility: 'async'})
        return postId
      }

      const created = await client.create({_type: documentType, ...value, status: nextStatus})
      setPostId(created._id)
      return created._id
    },
    [client, documentType, postId, value],
  )

  const save = useCallback(async () => {
    setBusy('save')
    setNote(undefined)

    try {
      await store(sent ? status : 'draft')
      setNote({tone: 'positive', text: 'Saved'})
      onChanged()
    } catch (error) {
      setNote({tone: 'critical', text: error instanceof Error ? error.message : 'Could not save'})
    } finally {
      setBusy(undefined)
    }
  }, [onChanged, sent, status, store])

  const send = useCallback(async () => {
    if (!zernio) {
      setNote({tone: 'critical', text: 'No API key stored — see Settings.'})
      return
    }

    setBusy('send')
    setNote(undefined)

    try {
      const id = await store('ready')
      const outcome = await sendPost(client, zernio, {...value, _id: id})

      setNote({tone: outcome.ok ? 'positive' : 'critical', text: outcome.message})
      if (outcome.ok) onSent()
    } catch (error) {
      setNote({tone: 'critical', text: error instanceof Error ? error.message : 'Unknown error'})
    } finally {
      setBusy(undefined)
    }
  }, [client, onSent, store, value, zernio])

  const remove = useCallback(async () => {
    if (!postId) return
    setBusy('delete')

    try {
      // The draft goes too, otherwise the post reappears the next time anyone
      // opens it in the desk.
      await client.delete(postId)
      await client.delete(`drafts.${postId.replace(/^drafts\./, '')}`).catch(() => undefined)
      onDeleted?.()
    } catch (error) {
      setNote({tone: 'critical', text: error instanceof Error ? error.message : 'Could not delete'})
    } finally {
      setBusy(undefined)
    }
  }, [client, onDeleted, postId])

  const upload = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return
      setBusy('upload')
      setNote(undefined)

      try {
        const uploaded = await Promise.all(
          Array.from(files).map(async (file) => {
            const video = file.type.startsWith('video/')
            const asset = await client.assets.upload(video ? 'file' : 'image', file, {
              filename: file.name,
            })

            return {
              _key: asset._id,
              _type: video ? 'video' : 'photo',
              asset: {
                _id: asset._id,
                url: asset.url,
                size: asset.size,
                mimeType: asset.mimeType,
                metadata: asset.metadata,
              },
            }
          }),
        )

        setMedia((current) => [...current, ...uploaded])
      } catch (error) {
        setNote({
          tone: 'critical',
          text: error instanceof Error ? error.message : 'Upload failed',
        })
      } finally {
        setBusy(undefined)
      }
    },
    [client],
  )

  const limits = rulesFor(value.targets?.[0]?.platform, kind)
  const problems = validatePost(value).filter((issue) => issue.level === 'error')
  const canPost = kind === 'feed' || kind === 'carousel'

  return (
    <Box
      style={{
        // The page itself never scrolls: the two columns are sized to the
        // viewport and only the caption grows into what is left.
        height: 'calc(100vh - 190px)',
        minHeight: 460,
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) auto',
        gap: 16,
        alignItems: 'stretch',
      }}
    >
      <Card
        padding={3}
        radius={3}
        border
        style={{display: 'flex', flexDirection: 'column', minHeight: 0, gap: 12}}
      >
        <Flex align="center" gap={2} wrap="wrap">
          <Box flex={1} style={{minWidth: 160}}>
            <TextInput
              value={title}
              onChange={(event) => setTitle(event.currentTarget.value)}
              placeholder="Internal name — only shown in the Studio"
              fontSize={1}
            />
          </Box>
          {postId && <StatusPill status={status} />}
          {sent && <Badge tone="primary">in Zernio</Badge>}
        </Flex>

        <Flex gap={2} align="center" wrap="wrap">
          <Card padding={1} radius={2} border tone="transparent">
            <Flex gap={1}>
              {KINDS.map((entry) => (
                <Button
                  key={entry.value}
                  text={entry.label}
                  mode={kind === entry.value ? 'default' : 'bleed'}
                  tone={kind === entry.value ? 'primary' : 'default'}
                  fontSize={1}
                  padding={2}
                  onClick={() => setKind(entry.value)}
                />
              ))}
            </Flex>
          </Card>
          <Text size={0} muted>
            {KINDS.find((entry) => entry.value === kind)?.note}
          </Text>
        </Flex>

        <TemplateBar
          templateType={templateType}
          post={value}
          onCreate={onNewTemplate}
          onApply={(patch) => {
            if (patch.content !== undefined) setContent(patch.content)
            if (patch.firstComment !== undefined) setFirstComment(patch.firstComment)
          }}
        />

        <Box flex={1} style={{minHeight: 90, display: 'flex', flexDirection: 'column', gap: 6}}>
          <Flex align="center" gap={2}>
            <Text size={1} weight="medium">
              Caption
            </Text>
            <Box flex={1} />
            <Text size={0} muted>
              {content.length} / {limits.maxContent} · fold at {limits.foldAt}
            </Text>
          </Flex>
          <Box flex={1} style={{minHeight: 0}}>
            <TextArea
              value={content}
              onChange={(event) => setContent(event.currentTarget.value)}
              placeholder="What goes out…"
              style={{height: '100%', resize: 'none'}}
            />
          </Box>
        </Box>

        {canPost && (
          <Flex align="center" gap={2}>
            <Box style={{width: 96, flex: 'none'}}>
              <Text size={0} muted>
                First comment
              </Text>
            </Box>
            <Box flex={1}>
              <TextInput
                value={firstComment}
                onChange={(event) => setFirstComment(event.currentTarget.value)}
                placeholder="Posted right after publishing"
                fontSize={1}
              />
            </Box>
          </Flex>
        )}

        <input
          ref={fileInput}
          type="file"
          accept="image/*,video/*"
          multiple
          hidden
          onChange={(event) => void upload(event.currentTarget.files)}
        />

        <Flex gap={2} align="center" style={{overflowX: 'auto', paddingBottom: 2}}>
          {media.map((item, index) => {
            const key = item._key ?? String(index)
            const video = isVideo(item)

            return (
              <Card key={key} radius={2} border overflow="hidden" style={{flex: 'none'}}>
                <Box style={{width: 64, height: 64, position: 'relative'}}>
                  {!video && deliveryUrl(item, kind) ? (
                    <img
                      src={deliveryUrl(item, kind)}
                      alt=""
                      style={{width: '100%', height: '100%', objectFit: 'cover'}}
                    />
                  ) : (
                    <Flex align="center" justify="center" style={{height: '100%'}}>
                      <Text size={0} muted>
                        video
                      </Text>
                    </Flex>
                  )}
                </Box>
                <Flex>
                  <Button
                    icon={CropIcon}
                    title="Adjust"
                    aria-label="Adjust"
                    mode="bleed"
                    fontSize={0}
                    padding={1}
                    disabled={video}
                    onClick={() => setEditing(key)}
                  />
                  <Button
                    icon={TrashIcon}
                    title="Remove"
                    aria-label="Remove"
                    mode="bleed"
                    tone="critical"
                    fontSize={0}
                    padding={1}
                    onClick={() => setMedia((current) => current.filter((_, i) => i !== index))}
                  />
                </Flex>
              </Card>
            )
          })}

          <Card
            as="button"
            radius={2}
            tone="transparent"
            onClick={() => fileInput.current?.click()}
            style={{
              flex: 'none',
              width: 64,
              height: 88,
              cursor: 'pointer',
              border: '1px dashed var(--card-border-color)',
            }}
          >
            <Stack gap={2} paddingY={2}>
              <Flex justify="center">
                <Text size={2} muted>
                  <ImageIcon />
                </Text>
              </Flex>
              <Flex justify="center">
                <Text size={0} muted>
                  {busy === 'upload' ? '…' : 'add'}
                </Text>
              </Flex>
            </Stack>
          </Card>

          <Box flex={1} />
          <Text size={0} muted style={{whiteSpace: 'nowrap'}}>
            {media.length === 0 ? 'Add media, then Adjust to move and zoom it' : ''}
          </Text>
        </Flex>

        <Flex gap={2} wrap="wrap" style={{maxHeight: 76, overflowY: 'auto'}}>
          {accounts.length === 0 && (
            <Text size={0} muted>
              No accounts loaded — open Settings and press “Reload”.
            </Text>
          )}
          {accounts.map((account) => {
            const checked = accountIds.includes(account.accountId)
            return (
              <Card
                key={account.accountId}
                as="button"
                padding={2}
                radius={4}
                border
                tone={checked ? 'primary' : 'default'}
                pressed={checked}
                style={{cursor: 'pointer'}}
                onClick={() =>
                  setAccountIds((current) =>
                    checked
                      ? current.filter((id) => id !== account.accountId)
                      : [...current, account.accountId],
                  )
                }
              >
                <Flex align="center" gap={2} paddingX={1}>
                  <PlatformIcon platform={account.platform} size={13} />
                  <Text size={0}>{account.name ?? account.username ?? account.accountId}</Text>
                  {checked && <Text size={0}>✓</Text>}
                </Flex>
              </Card>
            )
          })}
        </Flex>

        <Card padding={2} radius={2} tone="transparent" border>
          <Flex align="center" gap={2} wrap="wrap">
            <Flex align="center" gap={2}>
              <Switch
                checked={publishNow}
                onChange={(event) => setPublishNow(event.currentTarget.checked)}
              />
              <Text size={0}>Now</Text>
            </Flex>

            {!publishNow && (
              <Box style={{width: 210}}>
                <TextInput
                  type="datetime-local"
                  value={when}
                  onChange={(event) => setWhen(event.currentTarget.value)}
                  fontSize={1}
                />
              </Box>
            )}

            <Text size={0} muted>
              {settings.timezone || 'UTC'}
            </Text>

            <Box flex={1} />

            {postId &&
              (confirmDelete ? (
                <Flex gap={1}>
                  <Button
                    text="Really delete"
                    tone="critical"
                    fontSize={1}
                    padding={2}
                    disabled={busy === 'delete'}
                    onClick={() => void remove()}
                  />
                  <Button
                    text="Keep"
                    mode="bleed"
                    fontSize={1}
                    padding={2}
                    onClick={() => setConfirmDelete(false)}
                  />
                </Flex>
              ) : (
                <Button
                  icon={TrashIcon}
                  title="Delete"
                  aria-label="Delete"
                  mode="bleed"
                  tone="critical"
                  padding={2}
                  onClick={() => setConfirmDelete(true)}
                />
              ))}

            <Button
              text={postId ? 'Save' : 'Save draft'}
              mode="ghost"
              fontSize={1}
              padding={3}
              disabled={busy === 'save'}
              loading={busy === 'save'}
              onClick={() => void save()}
            />
            <Button
              text={publishNow ? 'Publish now' : 'Schedule'}
              icon={PublishIcon}
              tone="primary"
              fontSize={1}
              padding={3}
              disabled={!canSend(value) || busy === 'send'}
              loading={busy === 'send'}
              onClick={() => void send()}
            />
          </Flex>
        </Card>

        {(note || problems.length > 0) && (
          <Card
            padding={2}
            radius={2}
            border
            tone={note ? note.tone : 'caution'}
            style={{flex: 'none'}}
          >
            <Text size={0}>
              {note ? note.text : problems.map((issue) => issue.message).join(' · ')}
            </Text>
          </Card>
        )}
      </Card>

      <Box style={{overflowY: 'auto', overflowX: 'hidden', paddingRight: 4}}>
        <PostPreview value={value} size="large" showIssues={false} />
      </Box>

      {editingItem && (
        <Dialog
          id="zernio-media-editor"
          header="Adjust the picture"
          width={1}
          onClose={() => setEditing(undefined)}
        >
          <Box padding={3}>
            <MediaEditor
              item={editingItem}
              kind={kind}
              onChange={(crop) =>
                setMedia((current) =>
                  current.map((entry) =>
                    (entry._key ?? '') === editing ? {...entry, crop} : entry,
                  ),
                )
              }
              onClose={() => setEditing(undefined)}
            />
          </Box>
        </Dialog>
      )}
    </Box>
  )
}
