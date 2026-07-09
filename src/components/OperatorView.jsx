import { useMemo } from 'react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Legend, LabelList,
} from 'recharts'
import {
  MENU, MENU_BY_ID, PEER_BENCHMARKS, CO2E_PER_KG_WASTE, CO2E_PER_CAR_KM,
} from '../data/seedData.js'
import { Card, SectionLabel, OnboardingHint, fmtG } from './ui.jsx'

/* Chart chrome per the dataviz guidance: recessive grid, muted axis ink,
 * thin marks, validated series colors (teal #0d9488 / amber #bf7407). */
const INK_MUTED = '#7d857a'
const GRID = '#dbe4d3'
const SERIES_1 = '#23913f'
const SERIES_2 = '#bf7407'
const axisProps = { tick: { fill: INK_MUTED, fontSize: 12 }, axisLine: { stroke: '#c9c6bd' }, tickLine: false }

// Blended menu price ≈ S$ per kg of food — used to convert avoided waste to dollars
const SGD_PER_KG =
  MENU.reduce((s, d) => s + d.price, 0) / (MENU.reduce((s, d) => s + d.portionWeightG, 0) / 1000)
const MEAL_G = 400 // one meal's worth of food ≈ 400 g
const SUBSCRIPTION_SGD = 99 // illustrative Mottainai price point, per outlet/month

export default function OperatorView({ visits }) {
  const m = useMemo(() => computeDashboard(visits), [visits])

  return (
    <div className="animate-rise space-y-6">
      <OnboardingHint>
        This dashboard reads the <strong>same in-memory history</strong> the diner flow writes to —
        confirm an order in the Diner View and watch it appear in the live feed below.
      </OnboardingHint>

      {/* Header stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Food waste · last 4 weeks" value={`${m.recentWasteKg.toFixed(1)} kg`} sub={`${m.recentVisits} table visits`} />
        <StatTile
          label="Waste rate vs baseline"
          value={`−${Math.round(m.reductionPct)}%`}
          sub={`${Math.round(m.baselineRate * 100)}% → ${Math.round(m.recentRate * 100)}% of food ordered`}
          accent
        />
        <StatTile label="Est. cost saved · 4 weeks" value={`S$${Math.round(m.costSaved).toLocaleString()}`} sub={`at ~S$${SGD_PER_KG.toFixed(0)}/kg blended menu price`} />
        <StatTile label="Meals'-worth saved" value={`${Math.round(m.mealsSaved)}`} sub={`≈ ${MEAL_G} g per meal`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Waste trend */}
        <Card className="p-5">
          <SectionLabel>Waste trend</SectionLabel>
          <h3 className="font-display mt-1 text-lg font-semibold">Share of food wasted, by week</h3>
          <p className="mt-0.5 text-xs text-stone-500">
            The pilot began week 7 — nudges + portion choices pull the rate down.
          </p>
          <div className="mt-4 h-64">
            <ResponsiveContainer>
              <LineChart data={m.weekly} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
                <CartesianGrid stroke={GRID} strokeDasharray="0" vertical={false} />
                <XAxis dataKey="label" {...axisProps} />
                <YAxis {...axisProps} unit="%" domain={[0, 40]} />
                <Tooltip content={<ChartTip unit="%" />} cursor={{ stroke: INK_MUTED, strokeDasharray: '3 3' }} />
                <Legend wrapperStyle={{ fontSize: 12, color: '#52514e' }} iconType="plainline" />
                <ReferenceLine x="W7" stroke={INK_MUTED} strokeDasharray="4 4"
                  label={{ value: 'pilot starts', fill: INK_MUTED, fontSize: 11, position: 'insideTopLeft' }} />
                <Line name="Actual waste rate" type="monotone" dataKey="rate" stroke={SERIES_1}
                  strokeWidth={2} dot={{ r: 3, fill: SERIES_1, strokeWidth: 0 }} activeDot={{ r: 5 }} />
                <Line name="Pre-pilot baseline" type="monotone" dataKey="baseline" stroke={SERIES_2}
                  strokeWidth={2} strokeDasharray="6 4" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Waste by party size */}
        <Card className="p-5">
          <SectionLabel>Who over-orders?</SectionLabel>
          <h3 className="font-display mt-1 text-lg font-semibold">Average waste rate by party size</h3>
          <p className="mt-0.5 text-xs text-stone-500">
            Mid-size groups (3–5) over-order the most — exactly where nudges pay off.
          </p>
          <div className="mt-4 h-64">
            <ResponsiveContainer>
              <BarChart data={m.byPartySize} margin={{ top: 18, right: 12, left: -18, bottom: 0 }}>
                <CartesianGrid stroke={GRID} vertical={false} />
                <XAxis dataKey="size" {...axisProps} />
                <YAxis {...axisProps} unit="%" domain={[0, 40]} />
                <Tooltip content={<ChartTip unit="%" />} cursor={{ fill: 'rgba(35,145,63,0.07)' }} />
                <Bar dataKey="rate" name="Avg waste rate" fill={SERIES_1} radius={[4, 4, 0, 0]} maxBarSize={36}>
                  <LabelList dataKey="rate" position="top" formatter={(v) => `${v}%`}
                    style={{ fill: '#52514e', fontSize: 11, fontWeight: 600 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* The business case row */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* ROI */}
        <Card className="border-brand-200 bg-brand-50/40 p-5">
          <SectionLabel>Return on investment</SectionLabel>
          <h3 className="font-display mt-1 text-lg font-semibold">Pays for itself in {m.paybackDays} days</h3>
          <div className="mt-4 space-y-2.5 text-sm">
            <div className="flex justify-between text-stone-600">
              <span>Mottainai subscription</span>
              <span className="font-data text-[13px] font-semibold">S${SUBSCRIPTION_SGD}/mo</span>
            </div>
            <div className="flex justify-between text-stone-600">
              <span>Modelled savings (4 wks)</span>
              <span className="font-data text-[13px] font-semibold text-brand-700">S${Math.round(m.costSaved)}</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-stone-200/70" aria-hidden>
              <div className="meter-fill h-full rounded-full bg-brand-600" style={{ width: `${Math.min((m.costSaved / SUBSCRIPTION_SGD) * 100, 100) / 4}%` }} />
            </div>
            <p className="text-xs text-stone-500">
              ≈ <strong className="text-brand-700">{(m.costSaved / SUBSCRIPTION_SGD).toFixed(1)}×</strong> return
              per month at this outlet's volume — before counting reduced disposal fees.
            </p>
          </div>
        </Card>

        {/* Peer benchmark */}
        <Card className="p-5">
          <SectionLabel>Peer benchmark</SectionLabel>
          <h3 className="font-display mt-1 text-lg font-semibold">You vs. similar restaurants</h3>
          <div className="mt-4 space-y-3">
            <BenchmarkBar name="You (this outlet)" rate={m.recentRate} you />
            {PEER_BENCHMARKS.map((p) => (
              <BenchmarkBar key={p.name} name={p.name} rate={p.rate} />
            ))}
          </div>
          <p className="mt-3 text-xs text-stone-400">
            Peer rates are simulated reference points; every connected outlet sharpens the benchmark —
            that's the network effect.
          </p>
        </Card>

        {/* CO2e + regulation */}
        <Card className="p-5">
          <SectionLabel>Sustainability & compliance</SectionLabel>
          <h3 className="font-display mt-1 text-lg font-semibold">
            {m.co2eSavedKg.toFixed(0)} kg CO₂e avoided
          </h3>
          <p className="mt-2 text-sm text-stone-600">
            Waste avoided in the last 4 weeks ≈ <strong>{m.avoidedKg.toFixed(1)} kg</strong> of food
            — about <strong>{Math.round(m.carKmEquiv)} km</strong> of car travel in emissions terms
            (at ~{CO2E_PER_KG_WASTE} kg CO₂e per kg of food waste).
          </p>
          <p className="mt-3 rounded-xl bg-amber-50 px-3.5 py-2.5 text-xs leading-relaxed text-amber-900">
            <strong>Why now:</strong> under Singapore's Resource Sustainability Act, large commercial
            food-waste generators must segregate and report food waste — Mottainai produces the
            measurement trail as a by-product.
          </p>
        </Card>
      </div>

      {/* Learning loop — the moat, made visual */}
      <Card className="p-6">
        <SectionLabel>The learning loop</SectionLabel>
        <h3 className="font-display mt-1 text-lg font-semibold">Every table makes the next recommendation better</h3>
        <div className="mt-5 flex flex-col items-stretch gap-2 md:flex-row md:items-center">
          <LoopNode icon="📥" title="Data in" text="Party size + dishes + measured waste per service" />
          <LoopArrow />
          <LoopNode icon="⚙️" title="Model updates" text="Waste rates recomputed live per party-size band" />
          <LoopArrow />
          <LoopNode icon="💡" title="Better nudges" text="Right-size suggestions grounded in real history" />
          <LoopArrow />
          <LoopNode icon="🌱" title="Less waste" text="Smaller orders, smaller bills, less in the bin" highlight />
        </div>
        <p className="mt-4 flex items-center gap-2 text-xs text-stone-500">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-brand-500" aria-hidden />
          Live in this demo: a confirmed diner order updates the stats behind every chart on this page.
        </p>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        {/* Dish waste leaderboard */}
        <Card className="p-5">
          <SectionLabel>Menu engineering</SectionLabel>
          <h3 className="font-display mt-1 text-lg font-semibold">Which dishes come back unfinished?</h3>
          <p className="mt-0.5 text-xs text-stone-500">
            Waste attributed across each visit's dishes by weight and finish history.
          </p>
          <ul className="mt-4 space-y-3">
            {m.dishLeaderboard.map((d) => (
              <li key={d.id}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-semibold">{MENU_BY_ID[d.id].emoji} {MENU_BY_ID[d.id].name}</span>
                  <span className="whitespace-nowrap font-data text-[12px] text-stone-500">
                    {Math.round(d.rate * 100)}% left · {d.wasteKg.toFixed(1)} kg
                  </span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-stone-100" aria-hidden>
                  <div
                    className="meter-fill h-full rounded-full"
                    style={{ width: `${Math.min((d.rate / 0.4) * 100, 100)}%`, background: d.rate >= 0.25 ? 'var(--color-status-warn)' : SERIES_1 }}
                  />
                </div>
                <p className="mt-1 text-xs text-stone-400">{d.action}</p>
              </li>
            ))}
          </ul>
        </Card>

        {/* Honest measurement card */}
        <Card className="h-fit border-amber-200/70 bg-amber-50/40 p-5">
          <SectionLabel>How waste is measured</SectionLabel>
          <h3 className="font-display mt-1 text-lg font-semibold">Per service, not per plate</h3>
          <p className="mt-2 text-sm leading-relaxed text-stone-600">
            In a real deployment, aggregate waste is <strong>weighed per service</strong> at the
            clearing station (or via smart-bin sensors) — <strong>not</strong> per individual plate.
            Table- and dish-level figures are attributed estimates, and every number in this demo is
            simulated data calibrated to published research, not a measured result.
          </p>
          <ul className="mt-3 space-y-1.5 text-xs text-stone-500">
            <li>• Food service ≈ 28% of food waste (NEA / UNEP)</li>
            <li>• Up to ~50% of buffet food wasted in high-waste settings (ST, 2025)</li>
            <li>• Portion interventions cut plate waste 12–66% with no satisfaction loss</li>
          </ul>
        </Card>
      </div>

      {/* Live visit feed */}
      <Card className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <SectionLabel>Live table feed</SectionLabel>
            <h3 className="font-display mt-1 text-lg font-semibold">Most recent visits</h3>
          </div>
          <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
            {visits.length} visits on record
          </span>
        </div>
        <ul className="mt-4 divide-y divide-stone-100">
          {m.feed.map((v) => {
            const rate = v.wastedWeightG / v.totalFoodWeightG
            const tone = rate < 0.15 ? 'text-status-good' : rate < 0.28 ? 'text-status-warn' : 'text-status-high'
            return (
              <li key={v.id} className={`flex items-center justify-between gap-3 py-2.5 text-sm ${v.source === 'live' ? 'animate-pop' : ''}`}>
                <div className="flex min-w-0 items-center gap-2.5">
                  {v.source === 'live' && (
                    <span className="rounded-full bg-brand-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                      New
                    </span>
                  )}
                  {v.verified && (
                    <span
                      className="rounded-full border border-brand-200 bg-brand-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-700"
                      title="Leftovers measured at table check-out — not an estimate"
                    >
                      ✓ Checked-out
                    </span>
                  )}
                  <span className="font-semibold whitespace-nowrap">Table of {v.partySize}</span>
                  <span className="truncate text-stone-400" title={v.dishIds.map((id) => MENU_BY_ID[id].name).join(', ')}>
                    {v.dishIds.map((id) => MENU_BY_ID[id].emoji).join(' ')}
                  </span>
                </div>
                <div className="flex items-center gap-3 whitespace-nowrap">
                  <span className="text-stone-400">{v.date}</span>
                  <span className={`font-data text-[13px] font-semibold ${tone}`}>
                    {fmtG(v.wastedWeightG)} · {Math.round(rate * 100)}%
                  </span>
                </div>
              </li>
            )
          })}
        </ul>
      </Card>
    </div>
  )
}

// ------------------------------------------------------------------ helpers

function computeDashboard(visits) {
  // Weekly waste-rate series (weight-weighted, so big tables count properly)
  const weeks = Array.from({ length: 12 }, (_, i) => ({ food: 0, waste: 0, i }))
  for (const v of visits) {
    const w = weeks[Math.min(v.week, 11)]
    w.food += v.totalFoodWeightG
    w.waste += v.wastedWeightG
  }
  const preRates = weeks.slice(0, 6).map((w) => w.waste / w.food)
  const baselineRate = preRates.reduce((a, b) => a + b, 0) / preRates.length
  const weekly = weeks.map((w) => ({
    label: `W${w.i + 1}`,
    rate: Math.round((w.waste / w.food) * 1000) / 10,
    baseline: Math.round(baselineRate * 1000) / 10,
  }))

  // Last-4-weeks headline numbers vs the pre-pilot baseline rate
  const recent = visits.filter((v) => v.week >= 8)
  const recentFood = recent.reduce((s, v) => s + v.totalFoodWeightG, 0)
  const recentWaste = recent.reduce((s, v) => s + v.wastedWeightG, 0)
  const recentRate = recentWaste / recentFood
  const avoidedKg = Math.max(0, (baselineRate - recentRate) * recentFood) / 1000
  const costSaved = avoidedKg * SGD_PER_KG

  // Waste rate by party size (1–8)
  const bySize = {}
  for (const v of visits) {
    bySize[v.partySize] ??= { food: 0, waste: 0 }
    bySize[v.partySize].food += v.totalFoodWeightG
    bySize[v.partySize].waste += v.wastedWeightG
  }
  const byPartySize = Object.keys(bySize)
    .map(Number)
    .sort((a, b) => a - b)
    .map((size) => ({
      size: size === 8 ? '8+' : String(size),
      rate: Math.round((bySize[size].waste / bySize[size].food) * 100),
    }))

  // Dish leaderboard: attribute each visit's waste across its dishes by
  // weight × waste propensity (same rule the prediction engine uses).
  const dishAcc = {}
  for (const v of visits) {
    const parts = v.dishIds.map((id) => ({
      id,
      w: MENU_BY_ID[id].portionWeightG,
      share: MENU_BY_ID[id].portionWeightG * MENU_BY_ID[id].wastePropensity,
    }))
    const shareTotal = parts.reduce((s, p) => s + p.share, 0)
    for (const p of parts) {
      dishAcc[p.id] ??= { foodG: 0, wasteG: 0 }
      dishAcc[p.id].foodG += p.w
      dishAcc[p.id].wasteG += (v.wastedWeightG * p.share) / shareTotal
    }
  }
  const ACTIONS = {
    'rice/noodle': 'Consider a smaller default portion — most of this comes back as bulk carbs.',
    soup: 'Offer a small-pot option for tables under 4.',
    vegetable: 'Batch smaller during quiet services; dressed veg doesn\'t keep.',
    meat: 'Holding steady — portion size looks right.',
    seafood: 'Premium protein gets finished — a good upsell candidate.',
    tofu: 'Portion size looks right for most tables.',
  }
  const dishLeaderboard = Object.entries(dishAcc)
    .map(([id, a]) => ({
      id,
      rate: a.wasteG / a.foodG,
      wasteKg: a.wasteG / 1000,
      action: ACTIONS[MENU_BY_ID[id].category],
    }))
    .sort((a, b) => b.rate - a.rate)
    .slice(0, 6)

  return {
    weekly,
    byPartySize,
    baselineRate,
    recentRate,
    recentWasteKg: recentWaste / 1000,
    recentVisits: recent.length,
    reductionPct: ((baselineRate - recentRate) / baselineRate) * 100,
    costSaved,
    avoidedKg,
    mealsSaved: (avoidedKg * 1000) / MEAL_G,
    paybackDays: Math.max(1, Math.round(SUBSCRIPTION_SGD / (costSaved / 28))),
    co2eSavedKg: avoidedKg * CO2E_PER_KG_WASTE,
    carKmEquiv: (avoidedKg * CO2E_PER_KG_WASTE) / CO2E_PER_CAR_KM,
    dishLeaderboard,
    feed: [...visits].reverse().slice(0, 9),
  }
}

function StatTile({ label, value, sub, accent }) {
  return (
    <Card className={`p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lift ${accent ? 'border-brand-200 bg-brand-50/50' : ''}`}>
      <p className="kicker !text-[10px]">{label}</p>
      <p className={`font-display mt-2.5 text-[40px] font-semibold leading-none tracking-tight ${accent ? 'text-brand-700' : 'text-stone-900'}`}>
        {value}
      </p>
      <p className="mt-2 text-xs text-stone-500">{sub}</p>
    </Card>
  )
}

function BenchmarkBar({ name, rate, you }) {
  return (
    <div>
      <div className="flex items-baseline justify-between text-xs">
        <span className={you ? 'font-bold text-brand-800' : 'text-stone-500'}>{name}</span>
        <span className={`font-data text-[12px] font-semibold ${you ? 'text-brand-800' : 'text-stone-500'}`}>
          {Math.round(rate * 100)}%
        </span>
      </div>
      <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-stone-100" aria-hidden>
        <div
          className="meter-fill h-full rounded-full"
          style={{ width: `${(rate / 0.45) * 100}%`, background: you ? SERIES_1 : '#d6d3cd' }}
        />
      </div>
    </div>
  )
}

function ChartTip({ active, payload, label, unit }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs shadow-lift">
      <p className="font-bold text-stone-700">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="mt-0.5 flex items-center gap-1.5 text-stone-600">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: p.stroke ?? p.fill }} aria-hidden />
          {p.name}: <strong>{p.value}{unit}</strong>
        </p>
      ))}
    </div>
  )
}

function LoopNode({ icon, title, text, highlight }) {
  return (
    <div className={`flex-1 rounded-2xl border p-4 text-center ${
      highlight ? 'border-brand-300 bg-brand-50' : 'border-stone-200 bg-stone-50/60'
    }`}>
      <div className="text-2xl" aria-hidden>{icon}</div>
      <p className="mt-1 text-sm font-bold">{title}</p>
      <p className="mt-1 text-xs leading-relaxed text-stone-500">{text}</p>
    </div>
  )
}

function LoopArrow() {
  return (
    <div className="flex items-center justify-center text-xl text-brand-500" aria-hidden>
      <span className="rotate-90 md:rotate-0">→</span>
    </div>
  )
}
