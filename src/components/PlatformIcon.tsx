/**
 * Small platform glyphs, drawn rather than imported: recognisable at 16 px,
 * monochrome, and no brand assets to keep in sync.
 *
 * @public
 */
export function PlatformIcon(props: {platform?: string; size?: number}): React.JSX.Element {
  const {platform = '', size = 14} = props
  const name = platform.toLowerCase()

  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.6,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    role: 'img' as const,
  }

  if (name === 'instagram') {
    return (
      <svg {...common} data-platform="instagram">
        <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17" cy="7" r="1" fill="currentColor" stroke="none" />
      </svg>
    )
  }

  if (name === 'facebook') {
    return (
      <svg {...common} data-platform="facebook">
        <rect x="3.5" y="3.5" width="17" height="17" rx="4" />
        <path d="M15 8h-1.5A1.5 1.5 0 0 0 12 9.5V21M9.5 13h5" />
      </svg>
    )
  }

  if (name === 'x' || name === 'twitter') {
    return (
      <svg {...common} data-platform="x">
        <path d="M4 4l16 16M20 4L4 20" />
      </svg>
    )
  }

  if (name === 'tiktok') {
    return (
      <svg {...common} data-platform="tiktok">
        <path d="M14 4v10.5a3.5 3.5 0 1 1-3.5-3.5" />
        <path d="M14 6.5c.8 1.6 2.2 2.6 4 2.7" />
      </svg>
    )
  }

  if (name === 'linkedin') {
    return (
      <svg {...common} data-platform="linkedin">
        <rect x="3.5" y="3.5" width="17" height="17" rx="3" />
        <path d="M8 10.5V17M8 7.5v.01M12 17v-3.5a2 2 0 0 1 4 0V17" />
      </svg>
    )
  }

  if (name === 'youtube') {
    return (
      <svg {...common} data-platform="youtube">
        <rect x="3" y="6" width="18" height="12" rx="3" />
        <path d="M11 10l3.5 2-3.5 2z" fill="currentColor" stroke="none" />
      </svg>
    )
  }

  if (name === 'pinterest') {
    return (
      <svg {...common} data-platform="pinterest">
        <circle cx="12" cy="12" r="8.5" />
        <path d="M10.5 18l2-7.5M10 10.5c0-1.4 1.1-2.5 2.5-2.5S15 9 15 10.4c0 1.8-1.2 3.1-2.6 3.1" />
      </svg>
    )
  }

  if (name === 'threads') {
    return (
      <svg {...common} data-platform="threads">
        <path d="M15.5 9.5C14.8 8.2 13.5 7.5 12 7.5c-2.5 0-4.5 2-4.5 4.5s2 4.5 4.5 4.5c2.2 0 3.5-1.3 3.5-2.8 0-1.4-1.2-2.2-2.6-2.2-1.1 0-2 .6-2 1.4" />
      </svg>
    )
  }

  if (name === 'bluesky') {
    return (
      <svg {...common} data-platform="bluesky">
        <path d="M12 13c-2-3.5-5-5.5-6.5-5.5S3.5 9 4.5 11.5 8 15 12 13zM12 13c2-3.5 5-5.5 6.5-5.5S20.5 9 19.5 11.5 16 15 12 13z" />
      </svg>
    )
  }

  // Anything Zernio adds later still gets a marker rather than a blank space.
  return (
    <svg {...common} data-platform={name || 'unknown'}>
      <circle cx="12" cy="12" r="7.5" />
    </svg>
  )
}
