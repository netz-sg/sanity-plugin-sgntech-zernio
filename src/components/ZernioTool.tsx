import {
  Box,
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
import {useRouter} from 'sanity/router'

import {usePosts} from '../hooks/usePosts'
import {useZernioSettings} from '../hooks/useZernio'
import type {SocialPostValue} from '../lib/types'
import {CalendarView} from './CalendarView'
import {PostList} from './PostList'
import {SettingsPanel} from './SettingsPanel'

/**
 * Props the plugin hands to the tool.
 *
 * @public
 */
export interface ZernioToolProps {
  documentType: string
}

/**
 * The cockpit: calendar, list and settings in one place.
 *
 * @public
 */
export function ZernioTool(props: {options?: ZernioToolProps}): React.JSX.Element {
  const documentType = props.options?.documentType ?? 'socialPost'
  const router = useRouter()

  const [tab, setTab] = useState<'calendar' | 'posts' | 'settings'>('calendar')
  const {settings, loading: settingsLoading} = useZernioSettings()
  const {posts, loading, reload} = usePosts(documentType)

  const open = useCallback(
    (post: SocialPostValue) => {
      if (!post._id) return
      // Same route the desk uses, so the post opens in the normal editor.
      router.navigateIntent('edit', {id: post._id, type: documentType})
    },
    [documentType, router],
  )

  const configured = Boolean(settings.apiKey)

  return (
    <Container width={5} padding={4}>
      <Stack gap={5}>
        <Flex align="center" gap={3}>
          <Heading size={2}>Zernio</Heading>
          <Box flex={1} />
          {(loading || settingsLoading) && <Spinner muted />}
        </Flex>

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

        <TabList gap={2}>
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
            id="settings-tab"
            aria-controls="settings-panel"
            label="Settings"
            selected={tab === 'settings'}
            onClick={() => setTab('settings')}
          />
        </TabList>

        <TabPanel id="calendar-panel" aria-labelledby="calendar-tab" hidden={tab !== 'calendar'}>
          <CalendarView posts={posts} onOpen={open} onChanged={reload} />
        </TabPanel>

        <TabPanel id="posts-panel" aria-labelledby="posts-tab" hidden={tab !== 'posts'}>
          <PostList posts={posts} onOpen={open} onChanged={reload} />
        </TabPanel>

        <TabPanel id="settings-panel" aria-labelledby="settings-tab" hidden={tab !== 'settings'}>
          <SettingsPanel />
        </TabPanel>
      </Stack>
    </Container>
  )
}
