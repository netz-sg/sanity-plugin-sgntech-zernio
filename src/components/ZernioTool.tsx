import {ComposeIcon} from '@sanity/icons/Compose'
import {RefreshIcon} from '@sanity/icons/Refresh'
import {
  Badge,
  Button,
  Card,
  Container,
  Flex,
  Heading,
  Spinner,
  Stack,
  TabList,
  Tab,
  TabPanel,
  Text,
} from '@sanity/ui'
import {useCallback, useState} from 'react'

import {usePosts} from '../hooks/usePosts'
import {useRemotePosts} from '../hooks/useRemotePosts'
import {useZernioSettings} from '../hooks/useZernio'
import type {SocialPostValue} from '../lib/types'
import {CalendarView} from './CalendarView'
import {Composer} from './Composer'
import {PostDetail} from './PostDetail'
import {PostList} from './PostList'
import {SettingsPanel} from './SettingsPanel'
import {TemplatePanel} from './TemplatePanel'
import {ZernioIcon} from './ZernioIcon'

/**
 * Props the plugin hands to the tool.
 *
 * @public
 */
export interface ZernioToolProps {
  documentType: string
  templateType: string
}

/**
 * The cockpit: calendar, list and settings in one place.
 *
 * @public
 */
export function ZernioTool(props: {options?: ZernioToolProps}): React.JSX.Element {
  const documentType = props.options?.documentType ?? 'socialPost'
  const templateType = props.options?.templateType ?? 'zernioTemplate'
  const [tab, setTab] = useState<'compose' | 'calendar' | 'posts' | 'templates' | 'settings'>(
    'compose',
  )
  const [composeDay, setComposeDay] = useState<string | undefined>()
  const [editingPost, setEditingPost] = useState<SocialPostValue | undefined>()
  const [detailId, setDetailId] = useState<string | undefined>()
  // Bumped to start the composer over — its fields are local state.
  const [composeKey, setComposeKey] = useState(0)
  const [generation, setGeneration] = useState(0)
  const {settings, loading: settingsLoading} = useZernioSettings()
  const {posts, loading, reload} = usePosts(documentType)
  const {remote, error: remoteError} = useRemotePosts(posts, generation)

  const refresh = useCallback(() => {
    reload()
    setGeneration((current) => current + 1)
  }, [reload])

  /** Opens the composer empty, on a day when the calendar asked for one. */
  const create = useCallback((dayKey?: string) => {
    setDetailId(undefined)
    setEditingPost(undefined)
    setComposeDay(dayKey)
    setComposeKey((current) => current + 1)
    setTab('compose')
  }, [])

  /** Opens the detail page of a post — the calendar and the list both land here. */
  const open = useCallback((post: SocialPostValue) => {
    setDetailId(post._id)
  }, [])

  /** Detail page to composer, with the post loaded. */
  const edit = useCallback((post: SocialPostValue) => {
    setDetailId(undefined)
    setEditingPost(post)
    setComposeDay(undefined)
    setComposeKey((current) => current + 1)
    setTab('compose')
  }, [])

  /** A copy of a post, opened in the composer as a fresh draft. */
  const duplicate = useCallback((post: SocialPostValue) => {
    // Everything that ties a post to Zernio is dropped: a copy is a new post.
    const rest = {
      title: post.title,
      kind: post.kind,
      content: post.content,
      firstComment: post.firstComment,
      media: post.media,
      targets: post.targets,
      publishNow: post.publishNow,
      scheduledFor: post.scheduledFor,
      timezone: post.timezone,
    }
    setDetailId(undefined)
    setEditingPost({...rest, title: `${post.title ?? 'Untitled'} (copy)`, status: 'draft'})
    setComposeDay(undefined)
    setComposeKey((current) => current + 1)
    setTab('compose')
  }, [])

  // Read from the live list, so a status that comes back from Zernio while the
  // page is open shows up without reopening it.
  const detailPost = detailId ? posts.find((entry) => entry._id === detailId) : undefined

  const configured = Boolean(settings.apiKey)

  return (
    <Container width={5} padding={4}>
      <Stack gap={4}>
        <Flex align="center" gap={3} wrap="wrap">
          <Card padding={2} radius={2} tone="primary">
            <Text size={2}>
              <ZernioIcon />
            </Text>
          </Card>
          <Stack gap={2} flex={1} style={{minWidth: 200}}>
            <Flex align="center" gap={2}>
              <Heading size={2}>Zernio</Heading>
              {configured ? (
                <Badge tone="positive">connected</Badge>
              ) : (
                <Badge tone="caution">not set up</Badge>
              )}
            </Flex>
            <Text size={1} muted>
              {posts.length} post{posts.length === 1 ? '' : 's'} in this Studio
              {remote.length > 0 ? ` · ${remote.length} more in Zernio` : ''}
            </Text>
          </Stack>
          {(loading || settingsLoading) && <Spinner muted />}
          <Button text="Refresh" icon={RefreshIcon} mode="bleed" onClick={refresh} />
          <Button text="New post" icon={ComposeIcon} tone="primary" onClick={() => create()} />
        </Flex>

        {remoteError && (
          <Card padding={3} radius={2} border tone="caution">
            <Text size={1}>Zernio could not be read: {remoteError}</Text>
          </Card>
        )}

        {!configured && !settingsLoading && (
          <Card padding={4} radius={2} border tone="caution">
            <Stack gap={3}>
              <Text weight="medium">Not set up yet</Text>
              <Text size={1}>
                Enter your Zernio API key under Settings, pick a profile and connect an Instagram or
                Facebook account. Posts can be written before that — they just cannot be sent.
              </Text>
            </Stack>
          </Card>
        )}

        {detailPost ? (
          <PostDetail
            post={detailPost}
            onBack={() => setDetailId(undefined)}
            onEdit={edit}
            onDuplicate={duplicate}
            onChanged={refresh}
            onDeleted={() => {
              setDetailId(undefined)
              refresh()
            }}
          />
        ) : (
          <>
            <TabList gap={2}>
              <Tab
                id="compose-tab"
                aria-controls="compose-panel"
                label="Compose"
                selected={tab === 'compose'}
                onClick={() => setTab('compose')}
              />
              <Tab
                id="calendar-tab"
                aria-controls="calendar-panel"
                label="Calendar"
                selected={tab === 'calendar'}
                onClick={() => setTab('calendar')}
              />
              <Tab
                id="posts-tab"
                aria-controls="posts-panel"
                label={`Posts (${posts.length})`}
                selected={tab === 'posts'}
                onClick={() => setTab('posts')}
              />
              <Tab
                id="templates-tab"
                aria-controls="templates-panel"
                label="Templates"
                selected={tab === 'templates'}
                onClick={() => setTab('templates')}
              />
              <Tab
                id="settings-tab"
                aria-controls="settings-panel"
                label="Settings"
                selected={tab === 'settings'}
                onClick={() => setTab('settings')}
              />
            </TabList>

            <TabPanel id="compose-panel" aria-labelledby="compose-tab" hidden={tab !== 'compose'}>
              <Composer
                key={composeKey}
                documentType={documentType}
                templateType={templateType}
                post={editingPost}
                initialDay={composeDay}
                onSent={refresh}
                onChanged={refresh}
                onDeleted={() => {
                  refresh()
                  create()
                }}
                onNewTemplate={() => setTab('templates')}
              />
            </TabPanel>

            <TabPanel
              id="calendar-panel"
              aria-labelledby="calendar-tab"
              hidden={tab !== 'calendar'}
            >
              <CalendarView
                posts={posts}
                remote={remote}
                onOpen={open}
                onChanged={refresh}
                onCreate={create}
              />
            </TabPanel>

            <TabPanel id="posts-panel" aria-labelledby="posts-tab" hidden={tab !== 'posts'}>
              <PostList
                posts={posts}
                remote={remote}
                onOpen={open}
                onChanged={refresh}
                onCreate={() => create()}
              />
            </TabPanel>

            <TabPanel
              id="templates-panel"
              aria-labelledby="templates-tab"
              hidden={tab !== 'templates'}
            >
              <TemplatePanel templateType={templateType} />
            </TabPanel>

            <TabPanel
              id="settings-panel"
              aria-labelledby="settings-tab"
              hidden={tab !== 'settings'}
            >
              <SettingsPanel />
            </TabPanel>
          </>
        )}
      </Stack>
    </Container>
  )
}
