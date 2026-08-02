import {Box, Card, Flex, Stack, Text} from '@sanity/ui'
import type {ReactNode} from 'react'

import {ensureZernioStyles} from './styles'

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
 * A status as a pill with a dot — readable at a glance in a dense list, and the
 * same colour wherever it appears.
 *
 * @public
 */
export function StatusPill(props: {status?: string}): React.JSX.Element {
  ensureZernioStyles()
  const status = props.status ?? 'draft'

  return (
    <span className="zn-status" data-tone={status}>
      <i />
      {status}
    </span>
  )
}

/**
 * A small all-caps label. Section titles and field labels use it, which is what
 * gives the panels a rhythm instead of a wall of same-sized text.
 *
 * @public
 */
export function Label(props: {children: ReactNode}): React.JSX.Element {
  ensureZernioStyles()
  return <p className="zn-label">{props.children}</p>
}

/**
 * A titled block of the interface.
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
  const {title, description, actions, tone, children} = props
  ensureZernioStyles()

  const inner = (
    <Stack gap={4}>
      {(title || actions) && (
        <Flex align="flex-start" gap={3}>
          <Stack gap={3} flex={1}>
            {title && <Label>{title}</Label>}
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
  )

  // A tone means the block is saying something — a warning, a result — and then
  // the Studio's own card colours are the right ones.
  if (tone && tone !== 'default') {
    return (
      <Card padding={4} radius={3} border tone={tone}>
        {inner}
      </Card>
    )
  }

  return (
    <Box className="zn-card" padding={4}>
      {inner}
    </Box>
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
  ensureZernioStyles()

  return (
    <Stack gap={3}>
      <Flex align="center" gap={2}>
        <Label>{label}</Label>
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
  ensureZernioStyles()

  return (
    <Box className="zn-card zn-card--flush" padding={5}>
      <Stack gap={4}>
        {icon && (
          <Flex justify="center">
            <Box style={{opacity: 0.35, fontSize: 30, lineHeight: 1}}>{icon}</Box>
          </Flex>
        )}
        <Stack gap={3} style={{textAlign: 'center'}}>
          <Text size={1} weight="semibold">
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
    </Box>
  )
}

/**
 * The bar above a list: filters on the left, counts and actions on the right.
 *
 * @public
 */
export function Toolbar(props: {children: ReactNode}): React.JSX.Element {
  ensureZernioStyles()

  return (
    <Box className="zn-card" padding={2}>
      <Flex align="center" gap={2} wrap="wrap">
        {props.children}
      </Flex>
    </Box>
  )
}

/**
 * A segmented control — two or three exclusive choices that belong together.
 *
 * @public
 */
export function Segmented<T extends string>(props: {
  value: T
  options: {value: T; label: string}[]
  onChange: (value: T) => void
}): React.JSX.Element {
  const {value, options, onChange} = props
  ensureZernioStyles()

  return (
    <div className="zn-seg">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

/**
 * A toggle shaped like a tag — used for accounts, where several can be on.
 *
 * @public
 */
export function Chip(props: {
  pressed?: boolean
  icon?: ReactNode
  children: ReactNode
  onClick: () => void
}): React.JSX.Element {
  const {pressed = false, icon, children, onClick} = props
  ensureZernioStyles()

  return (
    <button type="button" className="zn-chip" aria-pressed={pressed} onClick={onClick}>
      {icon}
      {children}
    </button>
  )
}
