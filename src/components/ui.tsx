import {Badge, Box, Card, Flex, Stack, Text} from '@sanity/ui'
import type {ReactNode} from 'react'

/**
 * One tone per status, used everywhere a status is shown so the same word never
 * changes colour between the list, the calendar and the composer.
 *
 * @public
 */
export const STATUS_TONE: Record<
  string,
  'default' | 'primary' | 'positive' | 'caution' | 'critical'
> = {
  draft: 'default',
  ready: 'primary',
  scheduled: 'primary',
  publishing: 'caution',
  published: 'positive',
  partial: 'caution',
  failed: 'critical',
}

/**
 * A status as a pill.
 *
 * @public
 */
export function StatusPill(props: {status?: string}): React.JSX.Element {
  const status = props.status ?? 'draft'
  return <Badge tone={STATUS_TONE[status] ?? 'default'}>{status}</Badge>
}

/**
 * A titled block of the interface.
 *
 * Everything in the tool is one of these, which is what keeps the panels from
 * reading as a pile of loose form fields.
 *
 * @public
 */
export function Section(props: {
  title?: ReactNode
  description?: ReactNode
  actions?: ReactNode
  tone?: 'default' | 'transparent' | 'primary' | 'caution' | 'critical' | 'positive'
  children: ReactNode
}): React.JSX.Element {
  const {title, description, actions, tone = 'default', children} = props

  return (
    <Card padding={4} radius={3} border tone={tone}>
      <Stack gap={4}>
        {(title || actions) && (
          <Flex align="flex-start" gap={3}>
            <Stack gap={2} flex={1}>
              {title && (
                <Text size={1} weight="semibold">
                  {title}
                </Text>
              )}
              {description && (
                <Text size={1} muted>
                  {description}
                </Text>
              )}
            </Stack>
            {actions && <Flex gap={2}>{actions}</Flex>}
          </Flex>
        )}
        {children}
      </Stack>
    </Card>
  )
}

/**
 * A labelled form field, with room for a hint on the right — a character count,
 * a unit, whatever the field needs said next to it.
 *
 * @public
 */
export function Field(props: {
  label: ReactNode
  description?: ReactNode
  hint?: ReactNode
  children: ReactNode
}): React.JSX.Element {
  const {label, description, hint, children} = props

  return (
    <Stack gap={3}>
      <Flex align="center" gap={2}>
        <Text size={1} weight="medium">
          {label}
        </Text>
        <Box flex={1} />
        {hint && (
          <Text size={0} muted>
            {hint}
          </Text>
        )}
      </Flex>
      {description && (
        <Text size={0} muted>
          {description}
        </Text>
      )}
      {children}
    </Stack>
  )
}

/**
 * What a panel shows before anything exists in it.
 *
 * @public
 */
export function EmptyState(props: {
  icon?: ReactNode
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
}): React.JSX.Element {
  const {icon, title, description, action} = props

  return (
    <Card padding={5} radius={3} border tone="transparent">
      <Stack gap={4}>
        <Flex justify="center">
          <Box style={{opacity: 0.4, fontSize: 28, lineHeight: 1}}>{icon}</Box>
        </Flex>
        <Stack gap={3} style={{textAlign: 'center'}}>
          <Text size={1} weight="medium">
            {title}
          </Text>
          {description && (
            <Text size={1} muted>
              {description}
            </Text>
          )}
        </Stack>
        {action && <Flex justify="center">{action}</Flex>}
      </Stack>
    </Card>
  )
}

/**
 * The bar above a list: filters on the left, counts and actions on the right.
 *
 * @public
 */
export function Toolbar(props: {children: ReactNode}): React.JSX.Element {
  return (
    <Card padding={2} radius={3} border tone="transparent">
      <Flex align="center" gap={2} wrap="wrap">
        {props.children}
      </Flex>
    </Card>
  )
}
