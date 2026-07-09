/* Small shared UI primitives — keeps the two views visually coherent. */

export function Card({ children, className = '' }) {
  return (
    <div className={`rounded-2xl bg-card shadow-card border border-stone-900/5 ${className}`}>
      {children}
    </div>
  )
}

export function SectionLabel({ children, accent = false }) {
  return <p className={`kicker ${accent ? 'kicker-dot' : ''}`}>{children}</p>
}

/* Status is never color-alone: each level pairs a color, an icon, and a label. */
export const LEVELS = {
  none:   { label: 'No order yet', icon: '·',  fg: 'text-stone-500',      bg: 'bg-stone-100',   ring: 'border-stone-200' },
  low:    { label: 'Low waste',    icon: '✓',  fg: 'text-status-good',    bg: 'bg-green-50',    ring: 'border-green-200' },
  medium: { label: 'Medium waste', icon: '△',  fg: 'text-status-warn',    bg: 'bg-amber-50',    ring: 'border-amber-200' },
  high:   { label: 'High waste',   icon: '⚠',  fg: 'text-status-high',    bg: 'bg-red-50',      ring: 'border-red-200' },
}

export function TrafficLight({ level }) {
  const dot = (on, color) => (
    <span
      className={`traffic-swatch inline-block h-3.5 w-3.5 rounded-full ${on ? color : 'bg-stone-200'}`}
    />
  )
  const l = LEVELS[level] ?? LEVELS.none
  return (
    <div
      className={`traffic-swatch inline-flex items-center gap-2.5 rounded-full border px-4 py-2 ${l.bg} ${l.ring}`}
      role="status"
      aria-label={`Waste level: ${l.label}`}
    >
      <span className="flex items-center gap-1.5">
        {dot(level === 'low', 'bg-status-good')}
        {dot(level === 'medium', 'bg-status-warn')}
        {dot(level === 'high', 'bg-status-high')}
      </span>
      <span className={`text-sm font-semibold ${l.fg}`}>
        {l.icon} {l.label}
      </span>
    </div>
  )
}

export function OnboardingHint({ children }) {
  return (
    <div className="animate-rise flex items-start gap-3 rounded-2xl border border-stone-900/8 bg-card px-4.5 py-3.5 text-sm leading-relaxed text-stone-600 shadow-card">
      <span
        aria-hidden
        className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs text-brand-700"
      >
        ✦
      </span>
      <span>{children}</span>
    </div>
  )
}

/* The honesty badge — visible on both views, per the credibility framing. */
export function SimulatedDataBadge() {
  return (
    <p className="inline-flex items-center gap-2 rounded-full bg-stone-100 border border-stone-200 px-4 py-1.5 text-xs text-stone-600">
      <span aria-hidden>ⓘ</span>
      Demo runs on <strong className="font-semibold">simulated data</strong> modelled on published
      food-waste research (NEA/UNEP ~28% food-service share; ~50% buffet waste; 12–66% portion-intervention reductions).
    </p>
  )
}

export function fmtG(g) {
  return g >= 1000 ? `${(g / 1000).toFixed(1)} kg` : `${Math.round(g)} g`
}

export function fmtSGD(x) {
  return `S$${x.toFixed(2)}`
}
