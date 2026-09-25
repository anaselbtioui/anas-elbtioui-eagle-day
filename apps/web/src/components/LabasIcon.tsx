import { Icon, loadIcon, type IconifyIcon } from '@iconify/react'
import { useEffect, useState, type CSSProperties } from 'react'
import { cn } from '@/lib/utils'

/** Streamline Color — remapped to Med Assurance palette. */
export const labasIcons = {
  car: 'streamline-color:car-taxi-1',
  briefcase: 'streamline-color:bag-suitcase-1',
  warning: 'streamline-color:warning-triangle',
  clipboard: 'streamline-color:clipboard-check',
  wrench: 'streamline-color:wrench',
  close: 'streamline-color:delete-1',
  archive: 'streamline-color:archive-box',
  trash: 'streamline-color:recycle-bin-2',
  inbox: 'streamline-color:inbox-tray-1',
  eye: 'streamline-color:eye-optic',
  eyeOff: 'streamline-color:invisible-1',
  device: 'streamline-color:phone-mobile-phone',
  skip: 'streamline-color:button-next',
  later: 'streamline-color:watch-circle-time',
  user: 'streamline-color:user-circle-single',
  mail: 'streamline-color:mail-send-email-message',
  lock: 'streamline-color:padlock-square-1',
  settings: 'streamline-color:cog',
  logout: 'streamline-color:logout-1',
  location: 'streamline-color:location-pin-3',
  camera: 'streamline-color:camera-1',
  search: 'streamline-color:magnifying-glass',
} as const

export type LabasIconName = keyof typeof labasIcons

/** Streamline Color stock palette. */
const STREAMLINE_PRIMARY = /#4147d5/gi
const STREAMLINE_SECONDARY = /#d7e0ff/gi

/**
 * onSand — light surfaces: navy strokes + mint fill
 * onInk — dark navy / primary: moss strokes + mint fill (one green glyph, no cream halo)
 * alert — danger: red + soft wash
 */
const tones = {
  onSand: { primary: '#102860', secondary: '#90d0b0' },
  onInk: { primary: '#209070', secondary: '#90d0b0' },
  alert: { primary: '#b3261e', secondary: '#f8e8e7' },
} as const

export type LabasIconTone = keyof typeof tones

type LabasIconProps = {
  name: LabasIconName
  tone?: LabasIconTone
  className?: string
  size?: number | string
  style?: CSSProperties
  'aria-hidden'?: boolean | 'true' | 'false'
  'aria-label'?: string
}

function recolor(body: string, tone: LabasIconTone): string {
  const { primary, secondary } = tones[tone]
  return body
    .replace(STREAMLINE_PRIMARY, primary)
    .replace(STREAMLINE_SECONDARY, secondary)
    // wheels / accents: keep light on dark, soft mint wash on sand
    .replace(/#fff(?:fff)?\b/gi, tone === 'onInk' ? '#f4efe6' : '#ffffff')
}

const cache = new Map<string, IconifyIcon>()
const CACHE_VER = 'v7'

function cacheKey(name: LabasIconName, tone: LabasIconTone) {
  return `${CACHE_VER}:${name}:${tone}`
}

export function LabasIcon({
  name,
  tone = 'onSand',
  className,
  size,
  style,
  ...a11y
}: LabasIconProps) {
  const key = cacheKey(name, tone)
  const [icon, setIcon] = useState<IconifyIcon | null>(() => cache.get(key) ?? null)

  useEffect(() => {
    let alive = true
    const hit = cache.get(key)
    if (hit) {
      setIcon(hit)
      return
    }
    void loadIcon(labasIcons[name])
      .then((data) => {
        const remapped: IconifyIcon = { ...data, body: recolor(data.body, tone) }
        cache.set(key, remapped)
        if (alive) setIcon(remapped)
      })
      .catch(() => {
        if (alive) setIcon(null)
      })
    return () => {
      alive = false
    }
  }, [key, name, tone])

  if (!icon) {
    return (
      <span
        className={cn('labas-icon inline-block shrink-0', className)}
        style={{ width: size, height: size, ...style }}
        aria-hidden
      />
    )
  }

  return (
    <Icon
      icon={icon}
      className={cn('labas-icon shrink-0', className)}
      width={size}
      height={size}
      style={style}
      {...a11y}
    />
  )
}
