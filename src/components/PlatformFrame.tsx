import {deliveryUrl, isVideo, KIND_GEOMETRY} from '../lib/media'
import {rulesFor, usableMedia} from '../lib/rules'
import type {PostKind, SocialPostValue} from '../lib/types'

/**
 * How a post will look in the app it is going to.
 *
 * Everything inside is sized in `em` against the root font size, which is set
 * from the requested width — so one frame is one design at any size, instead of
 * a second set of numbers for every place it is shown.
 *
 * @public
 */
export interface PlatformFrameProps {
  platform: string
  kind: PostKind
  value: SocialPostValue
  /** Rendered width in pixels. */
  width: number
}

const BASE = 320

const FONT =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'

/** Instagram's own action glyphs, drawn at 24×24 like the app's. */
function Glyph(props: {name: string; filled?: boolean; size?: string; color?: string}) {
  const {name, filled = false, size = '1.5em', color = 'currentColor'} = props
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: filled ? color : 'none',
    stroke: color,
    strokeWidth: 1.7,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  }

  if (name === 'heart') {
    return (
      <svg {...common}>
        <path d="M12 20.2 4.3 12.6a4.6 4.6 0 0 1 0-6.5 4.6 4.6 0 0 1 6.5 0l1.2 1.2 1.2-1.2a4.6 4.6 0 0 1 6.5 0 4.6 4.6 0 0 1 0 6.5z" />
      </svg>
    )
  }

  if (name === 'comment') {
    return (
      <svg {...common}>
        <path d="M20.5 11.5a8 8 0 0 1-11.6 7.1L3.5 20.5l1.9-5.4A8 8 0 1 1 20.5 11.5z" />
      </svg>
    )
  }

  if (name === 'share') {
    return (
      <svg {...common}>
        <path d="M21 3 10.5 13.5M21 3l-6.8 18-3.7-7.5L3 10.1z" />
      </svg>
    )
  }

  if (name === 'bookmark') {
    return (
      <svg {...common}>
        <path d="M18 21l-6-4.4L6 21V4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5z" />
      </svg>
    )
  }

  if (name === 'more') {
    return (
      <svg {...common}>
        <circle cx="5" cy="12" r="1.3" fill={color} stroke="none" />
        <circle cx="12" cy="12" r="1.3" fill={color} stroke="none" />
        <circle cx="19" cy="12" r="1.3" fill={color} stroke="none" />
      </svg>
    )
  }

  if (name === 'close') {
    return (
      <svg {...common}>
        <path d="M6 6l12 12M18 6 6 18" />
      </svg>
    )
  }

  if (name === 'audio') {
    return (
      <svg {...common}>
        <path d="M9 18V6l10-2v12" />
        <circle cx="7" cy="18" r="2" />
        <circle cx="17" cy="16" r="2" />
      </svg>
    )
  }

  if (name === 'thumb') {
    return (
      <svg {...common}>
        <path d="M7 21V10l4-7a2 2 0 0 1 2 2v4h5.2a2 2 0 0 1 2 2.4l-1.4 7A2 2 0 0 1 16.8 21z" />
        <path d="M7 10H4v11h3" />
      </svg>
    )
  }

  if (name === 'globe') {
    return (
      <svg {...common} strokeWidth={1.5}>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M3.5 12h17M12 3.5c2.5 2.6 2.5 14.4 0 17-2.5-2.6-2.5-14.4 0-17z" />
      </svg>
    )
  }

  return <svg {...common} />
}

function Avatar(props: {label: string; ring?: boolean; size?: string}) {
  const {label, ring = false, size = '2em'} = props
  const letter = (label.trim()[0] ?? '?').toUpperCase()

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        flex: 'none',
        display: 'grid',
        placeItems: 'center',
        background: ring
          ? 'linear-gradient(45deg, #f9ce34, #ee2a7b, #6228d7)'
          : 'linear-gradient(135deg, #b7bcc4, #8c939c)',
        padding: ring ? '0.12em' : 0,
      }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          borderRadius: '50%',
          background: '#8e959e',
          color: '#fff',
          display: 'grid',
          placeItems: 'center',
          fontSize: '0.75em',
          fontWeight: 600,
          border: ring ? '0.12em solid #fff' : 'none',
        }}
      >
        {letter}
      </div>
    </div>
  )
}

/** The picture, or the placeholder that stands in for one. */
function Media(props: {value: SocialPostValue; kind: PostKind; dark?: boolean; fill?: boolean}) {
  const {value, kind, dark = false, fill = false} = props
  const media = usableMedia(value.media)
  const first = media[0]
  const source = deliveryUrl(first, kind)
  const geometry = KIND_GEOMETRY[kind]

  const frame: React.CSSProperties = fill
    ? {position: 'absolute', inset: 0}
    : {width: '100%', aspectRatio: `${geometry.width} / ${geometry.height}`}

  return (
    <div
      style={{
        ...frame,
        background: dark ? '#1c1c1e' : '#eceef1',
        overflow: 'hidden',
        display: 'grid',
        placeItems: 'center',
      }}
    >
      {source && !isVideo(first) && (
        <img
          src={source}
          alt=""
          style={{width: '100%', height: '100%', objectFit: 'cover', display: 'block'}}
        />
      )}
      {source && isVideo(first) && (
        <span style={{color: dark ? '#fff' : '#8e959e', fontSize: '0.8em'}}>video</span>
      )}
      {!source && (
        <span style={{color: dark ? '#8e959e' : '#a3a9b1', fontSize: '0.8em'}}>no media</span>
      )}

      {media.length > 1 && !fill && (
        <span
          style={{
            position: 'absolute',
            top: '0.75em',
            right: '0.75em',
            background: 'rgba(0,0,0,.6)',
            color: '#fff',
            borderRadius: '1em',
            padding: '0.15em 0.6em',
            fontSize: '0.75em',
            fontWeight: 600,
          }}
        >
          1/{media.length}
        </span>
      )}
    </div>
  )
}

/** Caption text with the platform's fold. */
function Caption(props: {text: string; foldAt: number; username?: string; light?: boolean}) {
  const {text, foldAt, username, light = false} = props
  if (!text && !username) return null

  const visible = text.slice(0, foldAt)
  const hidden = text.slice(foldAt)

  return (
    <span style={{color: light ? '#fff' : 'inherit'}}>
      {username && <strong style={{fontWeight: 600, marginRight: '0.4em'}}>{username}</strong>}
      {visible}
      {hidden && (
        <>
          <span style={{opacity: light ? 0.75 : 0.35}}>{hidden}</span>
          <span style={{color: light ? 'rgba(255,255,255,.7)' : '#8e959e'}}> … more</span>
        </>
      )}
    </span>
  )
}

function accountName(value: SocialPostValue, platform: string): string {
  const target = (value.targets ?? []).find(
    (entry) => (entry.platform ?? '').toLowerCase() === platform,
  )
  return target?.label ?? (platform === 'facebook' ? 'Your page' : 'your.account')
}

function InstagramFeed(props: PlatformFrameProps): React.JSX.Element {
  const {value, kind} = props
  const name = accountName(value, 'instagram')
  const rules = rulesFor('instagram', kind)

  return (
    <div style={{background: '#fff', color: '#000'}}>
      <div style={{display: 'flex', alignItems: 'center', gap: '0.6em', padding: '0.7em 0.8em'}}>
        <Avatar label={name} ring />
        <strong style={{fontSize: '0.8em', fontWeight: 600, flex: 1}}>{name}</strong>
        <Glyph name="more" size="1.2em" />
      </div>

      <div style={{position: 'relative'}}>
        <Media value={value} kind={kind} />
      </div>

      <div style={{display: 'flex', alignItems: 'center', gap: '0.7em', padding: '0.6em 0.8em'}}>
        <Glyph name="heart" />
        <Glyph name="comment" />
        <Glyph name="share" />
        <span style={{flex: 1}} />
        <Glyph name="bookmark" />
      </div>

      <div style={{padding: '0 0.8em 0.9em', fontSize: '0.8em', lineHeight: 1.4}}>
        <Caption text={(value.content ?? '').trim()} foldAt={rules.foldAt} username={name} />
        {value.firstComment && (
          <div style={{color: '#8e959e', marginTop: '0.5em'}}>View 1 comment</div>
        )}
        <div style={{color: '#8e959e', marginTop: '0.5em', fontSize: '0.85em'}}>Just now</div>
      </div>
    </div>
  )
}

function InstagramStory(props: PlatformFrameProps): React.JSX.Element {
  const {value, kind} = props
  const name = accountName(value, 'instagram')
  const caption = (value.content ?? '').trim()

  return (
    <div style={{position: 'relative', aspectRatio: '9 / 16', background: '#000'}}>
      <Media value={value} kind={kind} dark fill />

      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(180deg, rgba(0,0,0,.55) 0%, rgba(0,0,0,0) 22%, rgba(0,0,0,0) 62%, rgba(0,0,0,.6) 100%)',
        }}
      />

      <div style={{position: 'absolute', top: '0.7em', left: '0.7em', right: '0.7em'}}>
        <div style={{display: 'flex', gap: '0.25em'}}>
          {[0, 1, 2].map((index) => (
            <span
              key={index}
              style={{
                flex: 1,
                height: '0.18em',
                borderRadius: '0.2em',
                background: index === 0 ? '#fff' : 'rgba(255,255,255,.4)',
              }}
            />
          ))}
        </div>

        <div style={{display: 'flex', alignItems: 'center', gap: '0.5em', marginTop: '0.7em'}}>
          <Avatar label={name} size="1.7em" />
          <strong style={{color: '#fff', fontSize: '0.75em', fontWeight: 600}}>{name}</strong>
          <span style={{color: 'rgba(255,255,255,.75)', fontSize: '0.7em'}}>now</span>
          <span style={{flex: 1}} />
          <Glyph name="more" size="1.1em" color="#fff" />
          <Glyph name="close" size="1.1em" color="#fff" />
        </div>
      </div>

      {caption && (
        <div
          style={{
            position: 'absolute',
            left: '0.9em',
            right: '0.9em',
            bottom: '3.4em',
            fontSize: '0.8em',
            lineHeight: 1.35,
            textShadow: '0 1px 3px rgba(0,0,0,.6)',
          }}
        >
          <Caption text={caption} foldAt={200} light />
        </div>
      )}

      <div
        style={{
          position: 'absolute',
          left: '0.7em',
          right: '0.7em',
          bottom: '0.8em',
          display: 'flex',
          alignItems: 'center',
          gap: '0.6em',
        }}
      >
        <span
          style={{
            flex: 1,
            border: '0.09em solid rgba(255,255,255,.7)',
            borderRadius: '2em',
            color: 'rgba(255,255,255,.85)',
            fontSize: '0.72em',
            padding: '0.55em 0.9em',
          }}
        >
          Send message
        </span>
        <Glyph name="heart" size="1.35em" color="#fff" />
        <Glyph name="share" size="1.35em" color="#fff" />
      </div>
    </div>
  )
}

function InstagramReel(props: PlatformFrameProps): React.JSX.Element {
  const {value, kind} = props
  const name = accountName(value, 'instagram')
  const caption = (value.content ?? '').trim()

  return (
    <div style={{position: 'relative', aspectRatio: '9 / 16', background: '#000'}}>
      <Media value={value} kind={kind} dark fill />

      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(180deg, rgba(0,0,0,.45) 0%, rgba(0,0,0,0) 25%, rgba(0,0,0,0) 55%, rgba(0,0,0,.7) 100%)',
        }}
      />

      <div
        style={{
          position: 'absolute',
          top: '0.8em',
          left: '0.9em',
          right: '0.9em',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <strong style={{color: '#fff', fontSize: '0.85em', fontWeight: 600}}>Reels</strong>
      </div>

      <div
        style={{
          position: 'absolute',
          right: '0.6em',
          bottom: '3.5em',
          display: 'grid',
          justifyItems: 'center',
          gap: '1.1em',
        }}
      >
        <Glyph name="heart" size="1.6em" color="#fff" />
        <Glyph name="comment" size="1.6em" color="#fff" />
        <Glyph name="share" size="1.6em" color="#fff" />
        <Glyph name="more" size="1.4em" color="#fff" />
      </div>

      <div style={{position: 'absolute', left: '0.9em', right: '4em', bottom: '0.9em'}}>
        <div style={{display: 'flex', alignItems: 'center', gap: '0.5em'}}>
          <Avatar label={name} size="1.6em" />
          <strong style={{color: '#fff', fontSize: '0.75em', fontWeight: 600}}>{name}</strong>
          <span
            style={{
              border: '0.08em solid rgba(255,255,255,.8)',
              borderRadius: '0.4em',
              color: '#fff',
              fontSize: '0.65em',
              padding: '0.1em 0.5em',
            }}
          >
            Follow
          </span>
        </div>

        {caption && (
          <div style={{marginTop: '0.55em', fontSize: '0.75em', lineHeight: 1.35}}>
            <Caption text={caption} foldAt={100} light />
          </div>
        )}

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4em',
            marginTop: '0.55em',
            color: '#fff',
            fontSize: '0.7em',
          }}
        >
          <Glyph name="audio" size="1em" color="#fff" />
          <span style={{opacity: 0.9}}>Original audio</span>
        </div>
      </div>
    </div>
  )
}

function FacebookFeed(props: PlatformFrameProps): React.JSX.Element {
  const {value, kind} = props
  const name = accountName(value, 'facebook')
  const rules = rulesFor('facebook', kind)

  return (
    <div style={{background: '#fff', color: '#050505'}}>
      <div style={{display: 'flex', alignItems: 'center', gap: '0.6em', padding: '0.8em 0.9em'}}>
        <Avatar label={name} size="2.4em" />
        <div style={{flex: 1, lineHeight: 1.25}}>
          <strong style={{fontSize: '0.85em', fontWeight: 600}}>{name}</strong>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.3em',
              color: '#65676b',
              fontSize: '0.72em',
            }}
          >
            <span>Just now</span>
            <span>·</span>
            <Glyph name="globe" size="0.9em" color="#65676b" />
          </div>
        </div>
        <Glyph name="more" size="1.2em" color="#65676b" />
      </div>

      {(value.content ?? '').trim() && (
        <div style={{padding: '0 0.9em 0.7em', fontSize: '0.85em', lineHeight: 1.4}}>
          <Caption text={(value.content ?? '').trim()} foldAt={rules.foldAt} />
        </div>
      )}

      <div style={{position: 'relative'}}>
        <Media value={value} kind={kind} />
      </div>

      <div
        style={{
          display: 'flex',
          borderTop: '1px solid #e4e6eb',
          margin: '0 0.9em',
          padding: '0.45em 0',
          color: '#65676b',
          fontSize: '0.78em',
          fontWeight: 600,
        }}
      >
        {[
          {label: 'Like', icon: 'thumb'},
          {label: 'Comment', icon: 'comment'},
          {label: 'Share', icon: 'share'},
        ].map((action) => (
          <span
            key={action.label}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4em',
              padding: '0.35em 0',
            }}
          >
            <Glyph name={action.icon} size="1.15em" color="#65676b" />
            {action.label}
          </span>
        ))}
      </div>
    </div>
  )
}

function FacebookStory(props: PlatformFrameProps): React.JSX.Element {
  const {value, kind} = props
  const name = accountName(value, 'facebook')
  const caption = (value.content ?? '').trim()

  return (
    <div style={{position: 'relative', aspectRatio: '9 / 16', background: '#000'}}>
      <Media value={value} kind={kind} dark fill />

      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(180deg, rgba(0,0,0,.5) 0%, rgba(0,0,0,0) 25%, rgba(0,0,0,0) 60%, rgba(0,0,0,.6) 100%)',
        }}
      />

      <div style={{position: 'absolute', top: '0.7em', left: '0.7em', right: '0.7em'}}>
        <span
          style={{
            display: 'block',
            height: '0.18em',
            borderRadius: '0.2em',
            background: 'rgba(255,255,255,.9)',
          }}
        />
        <div style={{display: 'flex', alignItems: 'center', gap: '0.5em', marginTop: '0.7em'}}>
          <Avatar label={name} size="1.7em" />
          <strong style={{color: '#fff', fontSize: '0.75em', fontWeight: 600}}>{name}</strong>
          <span style={{color: 'rgba(255,255,255,.75)', fontSize: '0.7em'}}>now</span>
          <span style={{flex: 1}} />
          <Glyph name="close" size="1.1em" color="#fff" />
        </div>
      </div>

      {caption && (
        <div
          style={{
            position: 'absolute',
            left: '0.9em',
            right: '0.9em',
            bottom: '3.2em',
            fontSize: '0.8em',
            lineHeight: 1.35,
            textShadow: '0 1px 3px rgba(0,0,0,.6)',
          }}
        >
          <Caption text={caption} foldAt={200} light />
        </div>
      )}

      <div
        style={{
          position: 'absolute',
          left: '0.7em',
          right: '0.7em',
          bottom: '0.8em',
          display: 'flex',
          alignItems: 'center',
          gap: '0.6em',
        }}
      >
        <span
          style={{
            flex: 1,
            background: 'rgba(255,255,255,.16)',
            borderRadius: '2em',
            color: 'rgba(255,255,255,.9)',
            fontSize: '0.72em',
            padding: '0.55em 0.9em',
          }}
        >
          Send message
        </span>
        <Glyph name="thumb" size="1.35em" color="#fff" />
      </div>
    </div>
  )
}

/**
 * One post as the platform will draw it.
 *
 * @public
 */
export function PlatformFrame(props: PlatformFrameProps): React.JSX.Element {
  const {platform, kind, width} = props
  const tall = kind === 'story' || kind === 'reel'
  const facebook = platform.toLowerCase() === 'facebook'

  // Reels look the same on both apps, so Facebook borrows Instagram's frame.
  const Body = facebook
    ? kind === 'story'
      ? FacebookStory
      : kind === 'reel'
        ? InstagramReel
        : FacebookFeed
    : kind === 'story'
      ? InstagramStory
      : kind === 'reel'
        ? InstagramReel
        : InstagramFeed

  return (
    <div
      style={{
        width,
        // Everything inside is em-based, so one font size scales the whole frame.
        fontSize: (width / BASE) * 16,
        fontFamily: FONT,
        borderRadius: tall ? '0.9em' : '0.6em',
        overflow: 'hidden',
        border: '1px solid rgba(0,0,0,.12)',
        boxShadow: '0 2px 12px rgba(0,0,0,.18)',
        lineHeight: 1.3,
      }}
    >
      <Body {...props} />
    </div>
  )
}
