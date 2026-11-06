import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { toPng } from 'html-to-image'
import { Check, Download, Image, Layout, Palette, Sparkles, Type } from 'lucide-react'

const CARD_W = 1200
const CARD_H = 630
const EXPORT_SCALE = 2
const SANS = '"Outfit", "Segoe UI", ui-sans-serif, system-ui, sans-serif'
const MONO = '"IBM Plex Mono", "Cascadia Code", ui-monospace, monospace'

type TemplateId = 'minimal' | 'mesh' | 'showcase'
type GradientId = 'indigo' | 'sunset' | 'emerald' | 'midnight'
type BackgroundId = GradientId | 'custom'
type CardTheme = 'dark' | 'light'
type ExportStatus = 'idle' | 'working' | 'done' | 'error'

type Ink = {
  title: string
  body: string
  muted: string
  badgeBg: string
  badgeBorder: string
  badgeText: string
  line: string
  chrome: string
}

const TEMPLATES: { id: TemplateId; name: string; hint: string }[] = [
  { id: 'minimal', name: 'Tech Minimal', hint: 'Editorial type and a quiet footer' },
  { id: 'mesh', name: 'Gradient Mesh', hint: 'Centered poster with soft color orbs' },
  { id: 'showcase', name: 'Dev Showcase', hint: 'Editor chrome and a stack panel' },
]

const GRADIENTS = {
  indigo: {
    label: 'Indigo',
    swatch: 'linear-gradient(135deg, #312e81, #818cf8)',
    accent: { dark: '#a5b4fc', light: '#4338ca' },
    dark: 'linear-gradient(145deg, #07091a 0%, #1e1b4b 52%, #312e81 100%)',
    light: 'linear-gradient(145deg, #eef2ff 0%, #c7d2fe 48%, #a5b4fc 100%)',
  },
  sunset: {
    label: 'Sunset',
    swatch: 'linear-gradient(135deg, #9f1239, #fb923c)',
    accent: { dark: '#fda4af', light: '#be123c' },
    dark: 'linear-gradient(145deg, #14080d 0%, #4c1d3a 48%, #7c2d12 100%)',
    light: 'linear-gradient(145deg, #fff7ed 0%, #fecdd3 46%, #fdba74 100%)',
  },
  emerald: {
    label: 'Emerald',
    swatch: 'linear-gradient(135deg, #064e3b, #34d399)',
    accent: { dark: '#6ee7b7', light: '#047857' },
    dark: 'linear-gradient(145deg, #021510 0%, #064e3b 50%, #065f46 100%)',
    light: 'linear-gradient(145deg, #ecfdf5 0%, #a7f3d0 50%, #6ee7b7 100%)',
  },
  midnight: {
    label: 'Midnight',
    swatch: 'linear-gradient(135deg, #020617, #38bdf8)',
    accent: { dark: '#7dd3fc', light: '#0369a1' },
    dark: 'linear-gradient(160deg, #020617 0%, #0f172a 58%, #1e293b 100%)',
    light: 'linear-gradient(160deg, #f8fafc 0%, #e2e8f0 55%, #cbd5e1 100%)',
  },
} as const

const GRADIENT_IDS = Object.keys(GRADIENTS) as GradientId[]

const NOISE = createNoiseUri()

const fieldClass =
  'w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-2.5 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-indigo-400/80 focus:ring-2 focus:ring-indigo-500/20'

function createNoiseUri() {
  let seed = 1337
  const rand = () => {
    seed = (seed * 16807) % 2147483647
    return (seed - 1) / 2147483646
  }
  const dots: string[] = []
  for (let index = 0; index < 240; index += 1) {
    const x = (rand() * 160).toFixed(1)
    const y = (rand() * 160).toFixed(1)
    const radius = (rand() * 0.95 + 0.25).toFixed(2)
    const opacity = (rand() * 0.5 + 0.18).toFixed(2)
    dots.push(`<circle cx="${x}" cy="${y}" r="${radius}" fill="white" fill-opacity="${opacity}"/>`)
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160">${dots.join('')}</svg>`
  return `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}")`
}

function hexToRgb(hex: string) {
  const value = hex.trim().replace('#', '')
  const full = value.length === 3 ? value.split('').map((channel) => channel + channel).join('') : value
  const parsed = Number.parseInt(full, 16)
  if (!Number.isFinite(parsed) || full.length !== 6) return { r: 99, g: 102, b: 241 }
  return { r: (parsed >> 16) & 255, g: (parsed >> 8) & 255, b: parsed & 255 }
}

function mix(hex: string, target: string, amount: number) {
  const start = hexToRgb(hex)
  const end = hexToRgb(target)
  const channel = (from: number, to: number) => Math.round(from + (to - from) * amount)
  const part = (value: number) => value.toString(16).padStart(2, '0')
  return `#${part(channel(start.r, end.r))}${part(channel(start.g, end.g))}${part(channel(start.b, end.b))}`
}

function rgba(hex: string, alpha: number) {
  const { r, g, b } = hexToRgb(hex)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function isLight(hex: string) {
  const { r, g, b } = hexToRgb(hex)
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.64
}

function customBackground(hex: string, theme: CardTheme) {
  if (theme === 'dark') {
    return `linear-gradient(145deg, #05060c 0%, ${mix(hex, '#020617', 0.62)} 46%, ${mix(hex, '#020617', 0.22)} 100%)`
  }
  return `linear-gradient(145deg, #f8fafc 0%, ${mix(hex, '#ffffff', 0.55)} 52%, ${mix(hex, '#ffffff', 0.18)} 100%)`
}

function resolveLook(id: BackgroundId, theme: CardTheme, customColor: string) {
  if (id === 'custom') {
    return { accent: customColor, background: customBackground(customColor, theme) }
  }
  const preset = GRADIENTS[id]
  return { accent: preset.accent[theme], background: preset[theme] }
}

function inkFor(theme: CardTheme): Ink {
  if (theme === 'dark') {
    return {
      title: '#f8fafc',
      body: 'rgba(248,250,252,0.78)',
      muted: 'rgba(248,250,252,0.58)',
      badgeBg: 'rgba(255,255,255,0.08)',
      badgeBorder: 'rgba(255,255,255,0.16)',
      badgeText: '#f8fafc',
      line: 'rgba(255,255,255,0.12)',
      chrome: 'rgba(0,0,0,0.35)',
    }
  }
  return {
    title: '#0f172a',
    body: 'rgba(15,23,42,0.76)',
    muted: 'rgba(15,23,42,0.58)',
    badgeBg: 'rgba(255,255,255,0.66)',
    badgeBorder: 'rgba(15,23,42,0.12)',
    badgeText: '#0f172a',
    line: 'rgba(15,23,42,0.12)',
    chrome: 'rgba(255,255,255,0.55)',
  }
}

function formatHandle(handle: string) {
  const trimmed = handle.trim()
  if (!trimmed) return ''
  return trimmed.startsWith('@') ? trimmed : `@${trimmed}`
}

function initials(value: string) {
  const clean = value.replace(/^@/, '').trim()
  if (!clean) return 'OG'
  return clean
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] ?? '')
    .join('')
    .toUpperCase()
}

function fileSlug(value: string) {
  const slug = value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  return slug || 'og-image'
}

function fontSizeFor(text: string, base: number) {
  const length = text.trim().length
  if (length > 90) return Math.round(base * 0.58)
  if (length > 64) return Math.round(base * 0.7)
  if (length > 42) return Math.round(base * 0.82)
  return base
}

function subtitleSize(text: string, base: number) {
  const length = text.trim().length
  if (length > 160) return base - 6
  if (length > 110) return base - 2
  return base
}

function titleStyle(size: number, align: 'left' | 'center' = 'left'): CSSProperties {
  return {
    margin: 0,
    maxWidth: align === 'center' ? 960 : 980,
    fontSize: size,
    fontWeight: 800,
    letterSpacing: '-0.04em',
    lineHeight: 0.98,
    textAlign: align,
    overflowWrap: 'anywhere',
  }
}

function bodyStyle(size: number, color: string, align: 'left' | 'center' = 'left'): CSSProperties {
  return {
    margin: '20px 0 0',
    maxWidth: align === 'center' ? 740 : 780,
    fontSize: size,
    fontWeight: 500,
    lineHeight: 1.35,
    color,
    textAlign: align,
    overflowWrap: 'anywhere',
  }
}

function orb(left: number, top: number, size: number, color: string): CSSProperties {
  return {
    position: 'absolute',
    left,
    top,
    width: size,
    height: size,
    background: `radial-gradient(circle, ${color} 0%, rgba(0,0,0,0) 68%)`,
  }
}

type CardProps = {
  template: TemplateId
  title: string
  subtitle: string
  author: string
  handle: string
  tags: string[]
  theme: CardTheme
  background: string
  accent: string
  pattern: boolean
}

function OgCard(props: CardProps) {
  const ink = inkFor(props.theme)
  const edge = props.theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.08)'
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        fontFamily: SANS,
        color: ink.title,
        background: props.background,
        boxShadow: `inset 0 0 0 1px ${edge}`,
      }}
    >
      <CardBackdrop
        background={props.background}
        accent={props.accent}
        theme={props.theme}
        pattern={props.pattern}
        mesh={props.template === 'mesh'}
      />
      {props.template === 'minimal' && <MinimalLayout {...props} ink={ink} />}
      {props.template === 'mesh' && <MeshLayout {...props} ink={ink} />}
      {props.template === 'showcase' && <ShowcaseLayout {...props} ink={ink} />}
    </div>
  )
}

function CardBackdrop({
  background,
  accent,
  theme,
  pattern,
  mesh,
}: {
  background: string
  accent: string
  theme: CardTheme
  pattern: boolean
  mesh: boolean
}) {
  const grid = theme === 'dark' ? 'rgba(255,255,255,0.09)' : 'rgba(15,23,42,0.08)'
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div style={{ position: 'absolute', inset: 0, background }} />
      <div style={orb(760, 250, 560, rgba(accent, theme === 'dark' ? 0.5 : 0.36))} />
      {mesh && (
        <>
          <div style={orb(-180, -240, 760, rgba(accent, theme === 'dark' ? 0.72 : 0.48))} />
          <div style={orb(860, -160, 460, rgba(accent, theme === 'dark' ? 0.34 : 0.26))} />
          <div
            style={orb(340, 300, 400, theme === 'dark' ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.72)')}
          />
        </>
      )}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            theme === 'dark'
              ? 'linear-gradient(180deg, rgba(255,255,255,0.05), transparent 28%, rgba(0,0,0,0.28))'
              : 'linear-gradient(180deg, rgba(255,255,255,0.28), transparent 42%, rgba(15,23,42,0.05))',
        }}
      />
      {pattern && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `linear-gradient(${grid} 1px, transparent 1px), linear-gradient(90deg, ${grid} 1px, transparent 1px)`,
            backgroundSize: '48px 48px',
          }}
        />
      )}
      {pattern && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: NOISE,
            backgroundSize: '160px 160px',
            opacity: theme === 'dark' ? 0.42 : 0.24,
          }}
        />
      )}
    </div>
  )
}

function Kicker({ color, children }: { color: string; children: string }) {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10,
        fontFamily: MONO,
        fontSize: 15,
        fontWeight: 500,
        letterSpacing: '0.2em',
        textTransform: 'uppercase',
        color,
      }}
    >
      <span style={{ width: 8, height: 8, borderRadius: 99, background: color, display: 'block' }} />
      {children}
    </div>
  )
}

function Badge({ label, ink }: { label: string; ink: Ink }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        maxWidth: 280,
        borderRadius: 999,
        padding: '9px 14px',
        fontSize: 16,
        fontWeight: 600,
        lineHeight: 1,
        color: ink.badgeText,
        background: ink.badgeBg,
        border: `1px solid ${ink.badgeBorder}`,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}
    >
      {label}
    </span>
  )
}

function TagRow({ tags, ink, align }: { tags: string[]; ink: Ink; align: 'start' | 'center' | 'end' }) {
  if (tags.length === 0) return null
  const justifyContent = align === 'end' ? 'flex-end' : align === 'center' ? 'center' : 'flex-start'
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent, maxWidth: 620 }}>
      {tags.map((tag, index) => (
        <Badge key={`${tag}-${index}`} label={tag} ink={ink} />
      ))}
    </div>
  )
}

function AuthorLockup({
  author,
  handle,
  accent,
  ink,
  size = 'lg',
}: {
  author: string
  handle: string
  accent: string
  ink: Ink
  size?: 'md' | 'lg'
}) {
  const name = author.trim()
  const handleText = formatHandle(handle)
  if (!name && !handleText) return null
  const avatar = size === 'lg' ? 68 : 56
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: size === 'lg' ? 16 : 14, minWidth: 0 }}>
      <div
        style={{
          width: avatar,
          height: avatar,
          borderRadius: 999,
          flex: 'none',
          display: 'grid',
          placeItems: 'center',
          fontWeight: 700,
          fontSize: Math.round(avatar * 0.34),
          color: isLight(accent) ? '#0b1020' : '#ffffff',
          background: `linear-gradient(135deg, ${accent}, ${mix(accent, '#ffffff', 0.28)})`,
          boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.28)',
        }}
      >
        {initials(name || handleText)}
      </div>
      <div style={{ minWidth: 0 }}>
        {name && (
          <div
            style={{
              fontSize: size === 'lg' ? 26 : 22,
              fontWeight: 600,
              lineHeight: 1.1,
              color: ink.title,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: 420,
            }}
          >
            {name}
          </div>
        )}
        {handleText && (
          <div
            style={{
              marginTop: name ? 4 : 0,
              fontFamily: MONO,
              fontSize: size === 'lg' ? 18 : 16,
              color: ink.muted,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: 420,
            }}
          >
            {handleText}
          </div>
        )}
      </div>
    </div>
  )
}

type LayoutProps = CardProps & { ink: Ink }

function MinimalLayout(props: LayoutProps) {
  const showFooter = Boolean(props.author.trim() || formatHandle(props.handle) || props.tags.length)
  return (
    <div
      style={{
        position: 'relative',
        zIndex: 1,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        padding: '60px 72px 52px 84px',
      }}
    >
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 8, background: props.accent }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <Kicker color={props.accent}>Open Graph</Kicker>
        <div style={{ marginLeft: 'auto', fontFamily: MONO, fontSize: 16, color: props.ink.muted }}>1200 × 630</div>
      </div>
      <div style={{ width: 72, height: 4, marginTop: 26, borderRadius: 99, background: props.accent }} />
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', marginTop: 26 }}>
        <div style={titleStyle(fontSizeFor(props.title, 74))}>{props.title}</div>
        {props.subtitle.trim() && (
          <p style={bodyStyle(subtitleSize(props.subtitle, 26), props.ink.body)}>{props.subtitle}</p>
        )}
      </div>
      {showFooter && (
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 20,
            paddingTop: 28,
          }}
        >
          <AuthorLockup author={props.author} handle={props.handle} accent={props.accent} ink={props.ink} />
          <TagRow tags={props.tags} ink={props.ink} align="end" />
        </div>
      )}
    </div>
  )
}

function MeshLayout(props: LayoutProps) {
  const hasAuthor = Boolean(props.author.trim() || formatHandle(props.handle))
  return (
    <div
      style={{
        position: 'relative',
        zIndex: 1,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        overflow: 'hidden',
        padding: '56px 84px',
      }}
    >
      <Kicker color={props.accent}>Social banner</Kicker>
      <div style={{ width: 72, height: 4, marginTop: 22, borderRadius: 99, background: props.accent }} />
      <div style={{ marginTop: 28 }}>
        <div style={titleStyle(fontSizeFor(props.title, 82), 'center')}>{props.title}</div>
      </div>
      {props.subtitle.trim() && (
        <p style={bodyStyle(subtitleSize(props.subtitle, 26), props.ink.body, 'center')}>{props.subtitle}</p>
      )}
      {props.tags.length > 0 && (
        <div style={{ marginTop: 28 }}>
          <TagRow tags={props.tags} ink={props.ink} align="center" />
        </div>
      )}
      {hasAuthor && (
        <div
          style={{
            marginTop: 36,
            display: 'inline-flex',
            borderRadius: 999,
            padding: '8px 18px 8px 8px',
            background: props.ink.badgeBg,
            border: `1px solid ${props.ink.badgeBorder}`,
          }}
        >
          <AuthorLockup
            author={props.author}
            handle={props.handle}
            accent={props.accent}
            ink={props.ink}
            size="md"
          />
        </div>
      )}
    </div>
  )
}

function ShowcaseLayout(props: LayoutProps) {
  return (
    <div style={{ position: 'relative', zIndex: 1, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          height: 70,
          flex: 'none',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '0 28px',
          background: props.ink.chrome,
          borderBottom: `1px solid ${props.ink.line}`,
        }}
      >
        <Dot color="#fb7185" />
        <Dot color="#fbbf24" />
        <Dot color="#34d399" />
        <span style={{ marginLeft: 12, fontFamily: MONO, fontSize: 16, color: props.ink.muted }}>og-image.tsx</span>
        <span
          style={{
            marginLeft: 'auto',
            fontFamily: MONO,
            fontSize: 13,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            color: props.ink.muted,
          }}
        >
          Dev showcase
        </span>
      </div>
      <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', gap: 36, padding: '32px 48px' }}>
        <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
          <Kicker color={props.accent}>Featured</Kicker>
          <div style={{ ...titleStyle(fontSizeFor(props.title, 58)), marginTop: 22 }}>{props.title}</div>
          {props.subtitle.trim() && (
            <p style={bodyStyle(subtitleSize(props.subtitle, 22), props.ink.body)}>{props.subtitle}</p>
          )}
        </div>
        {props.tags.length > 0 && (
          <div
            style={{
              width: 360,
              flex: 'none',
              minHeight: 0,
              overflow: 'hidden',
              borderRadius: 28,
              padding: 24,
              background: props.theme === 'dark' ? 'rgba(2,6,23,0.55)' : 'rgba(255,255,255,0.58)',
              border: `1px solid ${props.ink.line}`,
            }}
          >
            <div
              style={{
                fontFamily: MONO,
                fontSize: 13,
                fontWeight: 500,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: props.ink.muted,
              }}
            >
              Tech stack
            </div>
            <div style={{ marginTop: 18 }}>
              <TagRow tags={props.tags} ink={props.ink} align="start" />
            </div>
          </div>
        )}
      </div>
      <div
        style={{
          flex: 'none',
          minHeight: 78,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 20,
          padding: '12px 36px',
          borderTop: `1px solid ${props.ink.line}`,
          background: props.theme === 'dark' ? 'rgba(0,0,0,0.28)' : 'rgba(255,255,255,0.42)',
        }}
      >
        <AuthorLockup
          author={props.author}
          handle={props.handle}
          accent={props.accent}
          ink={props.ink}
          size="md"
        />
        <div style={{ marginLeft: 'auto', flex: 'none', fontFamily: MONO, fontSize: 16, color: props.ink.muted }}>
          1200 × 630
        </div>
      </div>
    </div>
  )
}

function Dot({ color }: { color: string }) {
  return <span style={{ width: 12, height: 12, borderRadius: 99, background: color, display: 'block', flex: 'none' }} />
}

function Panel({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold tracking-[0.16em] text-zinc-400 uppercase">
        {icon}
        {title}
      </div>
      {children}
    </section>
  )
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  rows,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder: string
  rows?: number
}) {
  const id = label.toLowerCase().replace(/[^a-z]+/g, '-')
  const shared = {
    id,
    value,
    placeholder,
    autoComplete: 'off' as const,
    spellCheck: false,
    onChange: (event: { target: { value: string } }) => onChange(event.target.value),
    className: rows ? `${fieldClass} resize-none leading-5` : fieldClass,
  }
  return (
    <label htmlFor={id} className="block">
      <span className="mb-1.5 block text-xs font-medium text-zinc-400">{label}</span>
      {rows ? <textarea {...shared} rows={rows} /> : <input {...shared} />}
    </label>
  )
}

function App() {
  const frameRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const resetTimer = useRef<number | null>(null)
  const [scale, setScale] = useState(1)
  const [template, setTemplate] = useState<TemplateId>('minimal')
  const [backgroundId, setBackgroundId] = useState<BackgroundId>('indigo')
  const [customColor, setCustomColor] = useState('#6366f1')
  const [theme, setTheme] = useState<CardTheme>('dark')
  const [pattern, setPattern] = useState(true)
  const [title, setTitle] = useState('Cards that travel well')
  const [subtitle, setSubtitle] = useState('A tighter way to design social banners, docs covers, and launch images.')
  const [author, setAuthor] = useState('Aria Lang')
  const [handle, setHandle] = useState('aria')
  const [tagsInput, setTagsInput] = useState('React, TypeScript, Tailwind, Vite')
  const [status, setStatus] = useState<ExportStatus>('idle')
  const [exportError, setExportError] = useState('')

  const tags = useMemo(
    () =>
      tagsInput
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean)
        .slice(0, 8),
    [tagsInput],
  )
  const look = useMemo(
    () => resolveLook(backgroundId, theme, customColor),
    [backgroundId, theme, customColor],
  )

  useLayoutEffect(() => {
    const frame = frameRef.current
    if (!frame) return
    const update = () => {
      const next = frame.clientWidth / CARD_W
      setScale(next > 0 ? next : 1)
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(frame)
    return () => observer.disconnect()
  }, [])

  useLayoutEffect(() => {
    return () => {
      if (resetTimer.current !== null) window.clearTimeout(resetTimer.current)
    }
  }, [])

  async function downloadPng() {
    const node = cardRef.current
    if (!node || status === 'working') return
    setStatus('working')
    setExportError('')
    try {
      if (document.fonts?.ready) await document.fonts.ready
      const dataUrl = await toPng(node, {
        cacheBust: true,
        pixelRatio: EXPORT_SCALE,
        preferredFontFormat: 'woff2',
        width: CARD_W,
        height: CARD_H,
        style: {
          transform: 'scale(1)',
          transformOrigin: 'top left',
        },
      })
      const link = document.createElement('a')
      link.href = dataUrl
      link.download = `${fileSlug(title)}-og.png`
      link.click()
      setStatus('done')
      if (resetTimer.current !== null) window.clearTimeout(resetTimer.current)
      resetTimer.current = window.setTimeout(() => setStatus('idle'), 2000)
    } catch {
      setExportError('Could not export the PNG. Try again.')
      setStatus('error')
    }
  }

  const exportLabel = status === 'working' ? 'Exporting…' : status === 'done' ? 'Saved' : 'Download PNG'

  return (
    <div className="relative min-h-screen bg-[#07080c] text-zinc-100">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0"
        style={{
          backgroundImage:
            'radial-gradient(ellipse 60% 40% at 10% -10%, rgba(99,102,241,0.22), transparent 60%), radial-gradient(ellipse 40% 30% at 100% 0%, rgba(244,114,182,0.12), transparent 55%)',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 opacity-40"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)',
          backgroundSize: '72px 72px',
          maskImage: 'radial-gradient(ellipse at top, black, transparent 78%)',
        }}
      />

      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#07080c]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500 text-white shadow-lg shadow-indigo-950/50">
              <Sparkles size={18} />
            </div>
            <div>
              <h1 className="text-base font-semibold tracking-tight text-white sm:text-lg">OG Image Studio</h1>
              <p className="text-xs text-zinc-400 sm:text-sm">Open Graph images and social banners</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void downloadPng()}
            disabled={status === 'working'}
            aria-busy={status === 'working'}
            className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-indigo-500 px-4 text-sm font-semibold text-white shadow-lg shadow-indigo-950/40 transition hover:bg-indigo-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-300 disabled:cursor-wait disabled:opacity-70"
          >
            {status === 'done' ? <Check size={16} /> : <Download size={16} />}
            {exportLabel}
          </button>
        </div>
      </header>

      <main className="relative mx-auto grid w-full max-w-[1440px] gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start">
        <section className="min-w-0 rounded-3xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-medium text-zinc-200">
              <Image size={16} className="text-indigo-300" />
              Preview
            </div>
            <p className="font-mono text-xs text-zinc-500">
              1200 × 630 layout · {EXPORT_SCALE}× PNG ({CARD_W * EXPORT_SCALE} × {CARD_H * EXPORT_SCALE})
            </p>
          </div>
          <div className="mx-auto w-full max-w-[1200px]">
            <div
              ref={frameRef}
              className="relative w-full overflow-hidden rounded-2xl shadow-[0_40px_120px_-48px_rgba(0,0,0,0.9)] ring-1 ring-white/15"
              style={{ aspectRatio: `${CARD_W} / ${CARD_H}` }}
            >
              <div
                ref={cardRef}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: CARD_W,
                  height: CARD_H,
                  transform: `scale(${scale})`,
                  transformOrigin: 'top left',
                }}
              >
                <OgCard
                  template={template}
                  title={title}
                  subtitle={subtitle}
                  author={author}
                  handle={handle}
                  tags={tags}
                  theme={theme}
                  background={look.background}
                  accent={look.accent}
                  pattern={pattern}
                />
              </div>
            </div>
          </div>
          {exportError && (
            <p className="mt-3 text-sm text-rose-300" role="alert">
              {exportError}
            </p>
          )}
          <p className="sr-only" aria-live="polite">
            {status === 'done' ? 'PNG downloaded' : exportError}
          </p>
        </section>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-[5.5rem] lg:max-h-[calc(100vh-6.5rem)] lg:overflow-y-auto lg:pr-1 [scrollbar-color:rgba(255,255,255,0.16)_transparent] [scrollbar-width:thin]">
          <Panel icon={<Layout size={14} />} title="Templates">
            <div className="flex flex-col gap-2">
              {TEMPLATES.map((item) => {
                const active = template === item.id
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setTemplate(item.id)}
                    className={`flex w-full cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-300 ${
                      active
                        ? 'border-indigo-400/50 bg-indigo-500/10'
                        : 'border-white/10 bg-black/20 hover:border-white/20 hover:bg-white/[0.04]'
                    }`}
                  >
                    <span
                      className="relative h-10 w-[72px] shrink-0 overflow-hidden rounded-md ring-1 ring-white/10"
                      style={{ background: look.background }}
                    >
                      {item.id === 'minimal' && (
                        <span className="absolute inset-y-0 left-0 w-1" style={{ background: look.accent }} />
                      )}
                      {item.id === 'mesh' && (
                        <span
                          className="absolute -top-2 -left-2 h-8 w-8 rounded-full"
                          style={{ background: look.accent, opacity: 0.85 }}
                        />
                      )}
                      {item.id === 'showcase' && (
                        <>
                          <span className="absolute inset-x-0 top-0 h-2.5 bg-black/40" />
                          <span className="absolute top-4 right-1.5 h-4 w-5 rounded-sm bg-white/25" />
                        </>
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-zinc-100">{item.name}</span>
                      <span className="block text-xs text-zinc-500">{item.hint}</span>
                    </span>
                    {active && <Check size={16} className="shrink-0 text-indigo-300" />}
                  </button>
                )
              })}
            </div>
          </Panel>

          <Panel icon={<Type size={14} />} title="Copy">
            <div className="flex flex-col gap-3">
              <Field label="Title" value={title} onChange={setTitle} placeholder="Headline" rows={2} />
              <Field label="Subtitle" value={subtitle} onChange={setSubtitle} placeholder="Supporting line" rows={3} />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Author name" value={author} onChange={setAuthor} placeholder="Ada Lovelace" />
                <Field label="Handle" value={handle} onChange={setHandle} placeholder="ada" />
              </div>
              <Field
                label="Tech stack"
                value={tagsInput}
                onChange={setTagsInput}
                placeholder="React, TypeScript, Tailwind"
              />
              <p className="text-xs text-zinc-500">Comma-separated tags render as badges. Up to eight are shown.</p>
            </div>
          </Panel>

          <Panel icon={<Palette size={14} />} title="Background">
            <div className="flex flex-col gap-3">
              <div>
                <span className="mb-1.5 block text-xs font-medium text-zinc-400">Card theme</span>
                <div className="grid grid-cols-2 gap-1 rounded-xl bg-black/40 p-1">
                  {(['dark', 'light'] as const).map((option) => {
                    const active = theme === option
                    return (
                      <button
                        key={option}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setTheme(option)}
                        className={`h-9 cursor-pointer rounded-lg text-sm font-medium capitalize transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-300 ${
                          active ? 'bg-white/10 text-white' : 'text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        {option}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <span className="mb-1.5 block text-xs font-medium text-zinc-400">Gradient</span>
                <div className="grid grid-cols-2 gap-2">
                  {GRADIENT_IDS.map((id) => {
                    const preset = GRADIENTS[id]
                    const active = backgroundId === id
                    return (
                      <button
                        key={id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setBackgroundId(id)}
                        className={`flex cursor-pointer items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left text-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-300 ${
                          active
                            ? 'border-white/30 bg-white/10 text-white'
                            : 'border-white/10 bg-black/20 text-zinc-300 hover:border-white/20'
                        }`}
                      >
                        <span className="h-7 w-7 shrink-0 rounded-lg" style={{ background: preset.swatch }} />
                        <span className="min-w-0 flex-1">{preset.label}</span>
                        {active && <Check size={14} className="shrink-0 text-indigo-300" />}
                      </button>
                    )
                  })}
                </div>
              </div>

              <label
                className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 ${
                  backgroundId === 'custom' ? 'border-white/30 bg-white/10' : 'border-white/10 bg-black/20'
                }`}
              >
                <input
                  type="color"
                  aria-label="Custom background color"
                  value={customColor}
                  onChange={(event) => {
                    setCustomColor(event.target.value)
                    setBackgroundId('custom')
                  }}
                  className="h-9 w-12 cursor-pointer overflow-hidden rounded-lg border border-white/10 bg-transparent p-1"
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm text-zinc-100">Custom color</span>
                  <span className="block font-mono text-xs tracking-wide text-zinc-500 uppercase">{customColor}</span>
                </span>
                {backgroundId === 'custom' && <Check size={15} className="shrink-0 text-indigo-300" />}
              </label>

              <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2.5">
                <div>
                  <div className="text-sm text-zinc-100">Noise and grid</div>
                  <div className="text-xs text-zinc-500">Accent pattern over the background</div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={pattern}
                  aria-label="Toggle noise and grid overlay"
                  onClick={() => setPattern((value) => !value)}
                  className={`relative h-6 w-11 shrink-0 cursor-pointer rounded-full transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-300 ${
                    pattern ? 'bg-indigo-500' : 'bg-zinc-700'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition ${
                      pattern ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          </Panel>
        </aside>
      </main>
    </div>
  )
}

export default App
