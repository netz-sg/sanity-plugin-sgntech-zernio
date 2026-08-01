import {Box, Button, Card, Flex, Stack, Switch, Text} from '@sanity/ui'
import {useRef, useState} from 'react'

import {
  baseRect,
  cropFromView,
  type CropView,
  type ImageCrop,
  SAFE_ZONES,
  viewFromCrop,
} from '../lib/crop'
import {KIND_GEOMETRY} from '../lib/media'
import type {PostKind, SocialMediaItem} from '../lib/types'

/** How wide the editing frame is drawn, per orientation. */
const FRAME_WIDTH = {portrait: 240, tall: 200}

/**
 * Move and zoom an image inside the frame the post type will show, with the
 * areas Instagram covers with its own interface drawn on top.
 *
 * Lives in the tool only: the safe zones are an editing aid, not part of the
 * post, and nothing of them is stored or sent.
 *
 * @public
 */
export function MediaEditor(props: {
  item: SocialMediaItem
  kind: PostKind
  onChange: (crop: ImageCrop | undefined) => void
  onClose: () => void
}): React.JSX.Element {
  const {item, kind, onChange, onClose} = props
  const geometry = KIND_GEOMETRY[kind]
  const aspect = geometry.width / geometry.height
  const dimensions = item.asset?.metadata?.dimensions
  const source = {width: dimensions?.width ?? 0, height: dimensions?.height ?? 0}

  const [view, setView] = useState<CropView>(() => viewFromCrop(source, aspect, item.crop))
  const [safeZones, setSafeZones] = useState(true)
  const drag = useRef<{x: number; y: number; cx: number; cy: number} | undefined>(undefined)

  const zones = SAFE_ZONES[kind]
  const frameWidth = kind === 'story' || kind === 'reel' ? FRAME_WIDTH.tall : FRAME_WIDTH.portrait
  const frameHeight = frameWidth / aspect

  const usable = source.width > 0 && source.height > 0 && Boolean(item.asset?.url)
  const base = baseRect(source, aspect)

  // How large the whole image is drawn so the visible rectangle fills the frame.
  const visibleWidth = base.width / view.zoom / source.width
  const visibleHeight = base.height / view.zoom / source.height
  const imageWidth = frameWidth / (visibleWidth || 1)
  const imageHeight = frameHeight / (visibleHeight || 1)

  const move = (next: CropView) => {
    const crop = cropFromView(source, aspect, next)
    // Read back what was actually possible, so the image cannot be dragged
    // past its own edge and then snap when it is saved.
    setView(viewFromCrop(source, aspect, crop))
    onChange(crop)
  }

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!usable) return
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = {x: event.clientX, y: event.clientY, cx: view.cx, cy: view.cy}
  }

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const start = drag.current
    if (!start) return

    move({
      zoom: view.zoom,
      cx: start.cx - (event.clientX - start.x) / imageWidth,
      cy: start.cy - (event.clientY - start.y) / imageHeight,
    })
  }

  const onPointerUp = () => {
    drag.current = undefined
  }

  return (
    <Card padding={3} radius={2} border>
      <Flex gap={4} wrap="wrap">
        <Box
          style={{
            width: frameWidth,
            height: frameHeight,
            position: 'relative',
            overflow: 'hidden',
            borderRadius: 4,
            background: 'var(--card-muted-bg-color, rgba(127,127,127,.15))',
            cursor: usable ? 'grab' : 'default',
            touchAction: 'none',
            flex: 'none',
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {usable && (
            <img
              src={item.asset?.url}
              alt=""
              draggable={false}
              style={{
                position: 'absolute',
                width: imageWidth,
                height: imageHeight,
                left: -(view.cx - visibleWidth / 2) * imageWidth,
                top: -(view.cy - visibleHeight / 2) * imageHeight,
                maxWidth: 'none',
                userSelect: 'none',
              }}
            />
          )}

          {!usable && (
            <Flex align="center" justify="center" style={{height: '100%'}}>
              <Text size={0} muted>
                no image size known
              </Text>
            </Flex>
          )}

          {safeZones &&
            (zones ?? []).map((zone) => (
              <Box
                key={zone.label}
                title={zone.label}
                style={{
                  position: 'absolute',
                  top: `${zone.top * 100}%`,
                  bottom: `${zone.bottom * 100}%`,
                  left: `${zone.left * 100}%`,
                  right: `${zone.right * 100}%`,
                  background: 'rgba(255, 64, 64, 0.28)',
                  borderTop: '1px dashed rgba(255,255,255,.7)',
                  borderBottom: '1px dashed rgba(255,255,255,.7)',
                  pointerEvents: 'none',
                }}
              />
            ))}
        </Box>

        <Stack gap={4} flex={1} style={{minWidth: 200}}>
          <Stack gap={2}>
            <Text size={1} weight="medium">
              Zoom
            </Text>
            <input
              type="range"
              min={1}
              max={5}
              step={0.02}
              value={view.zoom}
              disabled={!usable}
              onChange={(event) =>
                move({zoom: Number(event.currentTarget.value), cx: view.cx, cy: view.cy})
              }
              style={{width: '100%'}}
            />
            <Text size={0} muted>
              Drag the image to move it. {geometry.width}×{geometry.height} is what goes out.
            </Text>
          </Stack>

          {zones && (
            <Stack gap={2}>
              <Flex align="center" gap={3}>
                <Switch
                  checked={safeZones}
                  onChange={(event) => setSafeZones(event.currentTarget.checked)}
                />
                <Text size={1}>Show safe zones</Text>
              </Flex>
              <Text size={0} muted>
                {zones.map((zone) => zone.label).join(' · ')} — Instagram draws over these. Only
                shown here, never part of the image.
              </Text>
            </Stack>
          )}

          <Flex gap={2} wrap="wrap">
            <Button
              text="Reset"
              mode="ghost"
              fontSize={1}
              disabled={!usable}
              onClick={() => {
                setView({zoom: 1, cx: 0.5, cy: 0.5})
                onChange(undefined)
              }}
            />
            <Button text="Done" tone="primary" mode="ghost" fontSize={1} onClick={onClose} />
          </Flex>
        </Stack>
      </Flex>
    </Card>
  )
}
