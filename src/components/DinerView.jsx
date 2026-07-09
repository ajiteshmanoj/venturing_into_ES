import { useMemo, useState } from 'react'
import {
  BarChart, Bar, Cell, LabelList, ReferenceLine, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from 'recharts'
import {
  MENU, MENU_BY_ID, PORTIONS, SERVICE_CHARGE, GST, DINER_PAST_VISITS,
  DINER_NAME, DINER_POINTS_BALANCE, REWARD_TIERS,
  dishPhoto, finishChip,
} from '../data/seedData.js'
import {
  predictWaste, nudgeFor, recommendedDishCount, rightSizingSavings,
  checkoutOutcomes, checkoutPoints, smartServeSplit,
} from '../engine/recommend.js'
import { Card, SectionLabel, TrafficLight, OnboardingHint, LEVELS, fmtG, fmtSGD } from './ui.jsx'

/* The fictional restaurant this deployment is "installed" at — the diner flow
 * is framed as its QR-ordering experience, powered by Mottainai. */
const RESTAURANT = { name: 'Golden Wok Zi Char', nameZh: '金锅小炒', table: 12 }

let lineKey = 0

export default function DinerView({ stats, addVisit, updateVisit, goToOperator }) {
  const [partySize, setPartySize] = useState(null)
  const [order, setOrder] = useState([]) // [{ key, dishId, portion }]
  const [tapau, setTapau] = useState(false)
  const [smartServe, setSmartServe] = useState(false)
  const [confirmed, setConfirmed] = useState(null)
  const [checkingIn, setCheckingIn] = useState(false)
  const [checkingOut, setCheckingOut] = useState(false)
  const [whyOpen, setWhyOpen] = useState(false)
  const [flash, setFlash] = useState(false)

  /* Smart serve: when the order exceeds appetite the engine proposes a split —
   * fire round 1 now, hold the excess. With the toggle on, everything below
   * (prediction, nudge, bill, the kitchen ticket) runs on round 1 only. */
  const split = useMemo(
    () => smartServeSplit(stats, partySize, order, { tapau }),
    [stats, partySize, order, tapau],
  )
  const activeOrder = smartServe && split ? split.now : order
  const heldLines = smartServe && split ? split.later : []

  const prediction = useMemo(
    () => predictWaste(stats, partySize, activeOrder, { tapau }),
    [stats, partySize, activeOrder, tapau],
  )
  const nudge = useMemo(
    () => nudgeFor(stats, partySize, activeOrder),
    [stats, partySize, activeOrder],
  )

  const addDish = (dishId) => setOrder((o) => [...o, { key: ++lineKey, dishId, portion: 'regular' }])
  const removeLine = (key) => setOrder((o) => o.filter((l) => l.key !== key))
  const setPortion = (key, portion) =>
    setOrder((o) => o.map((l) => (l.key === key ? { ...l, portion } : l)))

  /*
   * "Right-size for me" — one tap that acts on the engine's advice:
   * halve regular portions (largest dish first) until the prediction turns
   * green, then trim whole dishes if halving alone isn't enough.
   */
  const rightSize = () => {
    let next = [...order]
    const evaluate = (o) => predictWaste(stats, partySize, o, { tapau })
    let guard = 20
    while (evaluate(next).level !== 'low' && guard-- > 0) {
      const candidates = next
        .filter((l) => l.portion !== 'half' && MENU_BY_ID[l.dishId].portionable)
        .sort((a, b) => MENU_BY_ID[b.dishId].portionWeightG - MENU_BY_ID[a.dishId].portionWeightG)
      if (candidates.length > 0) {
        const target = candidates[0].key
        next = next.map((l) => (l.key === target ? { ...l, portion: 'half' } : l))
      } else if (next.length > 1) {
        next = next.slice(0, -1) // trim the most recently added dish
      } else break
    }
    setOrder(next)
    setFlash(true)
    setTimeout(() => setFlash(false), 900)
  }

  /* KEY DEMO MOMENT — pre-fill an over-order for a table of 3 (5 large shared
   * dishes ≈ 1.7 dishes/person → firmly red), then fix it live. */
  const loadOverOrderScenario = () => {
    setPartySize(3)
    setConfirmed(null)
    setTapau(false)
    setSmartServe(false)
    setOrder([
      { key: ++lineKey, dishId: 'fried-rice', portion: 'regular' },
      { key: ++lineKey, dishId: 'hor-fun', portion: 'regular' },
      { key: ++lineKey, dishId: 'ss-pork', portion: 'regular' },
      { key: ++lineKey, dishId: 'se-prawns', portion: 'regular' },
      { key: ++lineKey, dishId: 'kungpao', portion: 'regular' },
    ])
    setWhyOpen(true)
  }

  const confirmOrder = () => {
    // Only round 1 goes to the kitchen (and into history) — held dishes are
    // not cooked yet, so they can't be wasted yet.
    const savings = rightSizingSavings(stats, partySize, activeOrder, { tapau })
    const visit = {
      id: `live-${Date.now()}`,
      date: new Date().toISOString().slice(0, 10),
      week: 11,
      partySize,
      dishIds: activeOrder.map((l) => l.dishId),
      dishCount: Math.round(prediction.effectiveDishes * 10) / 10,
      totalFoodWeightG: Math.round(prediction.totalWeightG),
      wastedWeightG: prediction.predictedWasteG,
      source: 'live',
    }
    addVisit(visit)
    setConfirmed({ visit, prediction, order: activeOrder, heldLines, savings })
  }

  const startOver = () => {
    setConfirmed(null)
    setCheckingIn(false)
    setCheckingOut(false)
    setOrder([])
    setPartySize(null)
    setTapau(false)
    setSmartServe(false)
    setWhyOpen(false)
  }

  // ---------------------------------------------------------------- screens
  if (confirmed && checkingIn) {
    return (
      <MidMealCheckin
        confirmed={confirmed}
        stats={stats}
        tapau={tapau}
        updateVisit={updateVisit}
        onContinue={(updated) => {
          setConfirmed(updated)
          setCheckingIn(false)
          setCheckingOut(true)
        }}
        goToOperator={goToOperator}
        startOver={startOver}
      />
    )
  }
  if (confirmed && checkingOut) {
    return (
      <TableCheckout
        confirmed={confirmed}
        updateVisit={updateVisit}
        startOver={startOver}
        goToOperator={goToOperator}
      />
    )
  }
  if (confirmed) {
    return (
      <GreenReceipt
        confirmed={confirmed}
        startOver={startOver}
        goToOperator={goToOperator}
        onCheckout={() => setCheckingOut(true)}
        onCheckin={() => setCheckingIn(true)}
      />
    )
  }

  return (
    <div className="animate-rise">
      <RestaurantStrip />

      {!partySize ? (
        <PartyPicker setPartySize={setPartySize} loadOverOrderScenario={loadOverOrderScenario} />
      ) : (
        <OrderScreen
          partySize={partySize}
          setPartySize={setPartySize}
          order={order}
          addDish={addDish}
          removeLine={removeLine}
          setPortion={setPortion}
          prediction={prediction}
          nudge={nudge}
          tapau={tapau}
          setTapau={setTapau}
          split={split}
          smartServe={smartServe}
          setSmartServe={setSmartServe}
          heldLines={heldLines}
          whyOpen={whyOpen}
          setWhyOpen={setWhyOpen}
          flash={flash}
          rightSize={rightSize}
          confirmOrder={confirmOrder}
          loadOverOrderScenario={loadOverOrderScenario}
        />
      )}
    </div>
  )
}

/* The "you scanned the QR at your table" framing. */
function RestaurantStrip() {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-[22px] border border-stone-700/50 bg-gradient-to-br from-stone-900 via-stone-900 to-stone-800 px-5 py-4 text-stone-100 shadow-lift">
      <div className="flex items-center gap-3.5">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-amber-400/90 text-xl shadow-card" aria-hidden>
          🔥
        </div>
        <div>
          <p className="font-display text-lg font-semibold leading-tight">
            {RESTAURANT.name} <span className="ml-1 font-normal text-stone-400">{RESTAURANT.nameZh}</span>
          </p>
          <p className="text-xs text-stone-400">Blk 214 Serangoon Ave 4 · Open daily 11am–10pm</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className="rounded-full border border-stone-600/60 bg-stone-800/90 px-3.5 py-1.5 font-data text-[13px] font-semibold tracking-wide">
          TABLE {RESTAURANT.table}
        </span>
        <span className="hidden font-data text-[10px] uppercase tracking-[0.24em] text-stone-500 sm:block">
          Powered by Mottainai
        </span>
      </div>
    </div>
  )
}

function PartyPicker({ setPartySize, loadOverOrderScenario }) {
  return (
    <div className="dot-grid -mx-5 -mt-2 px-5 pb-16 pt-10 sm:pt-14">
      <div className="mx-auto max-w-2xl text-center">
        <p className="kicker kicker-dot">Step 1 of 3 · Your table</p>
        <h2 className="font-display mt-5 text-[42px] font-semibold leading-[1.04] tracking-tight sm:text-[54px]">
          How many are dining{' '}
          <em className="italic text-brand-700">today</em>?
        </h2>
        <p className="mx-auto mt-5 max-w-md text-[15px] leading-relaxed text-stone-500">
          This menu helps your table order <strong className="font-semibold text-stone-700">just the right amount</strong>,
          using the restaurant's own dining history.
        </p>

        <div className="mx-auto mt-10 grid max-w-md grid-cols-4 gap-3">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
            <button
              key={n}
              onClick={() => setPartySize(n)}
              className="aspect-square rounded-2xl border border-stone-900/8 bg-card font-display text-3xl font-semibold text-stone-700 shadow-card transition-all hover:-translate-y-1 hover:border-brand-400 hover:text-brand-700 hover:shadow-lift active:translate-y-0 active:scale-[0.97]"
            >
              {n === 8 ? '8+' : n}
            </button>
          ))}
        </div>
        <p className="mt-7 text-[13px] text-stone-400">
          We'll suggest the right number of dishes as you go — you always stay in control.
        </p>
        <div className="mt-9">
          <DemoScenarioButton onClick={loadOverOrderScenario} />
        </div>
      </div>
    </div>
  )
}

function OrderScreen(props) {
  const {
    partySize, setPartySize, order, addDish, removeLine, setPortion,
    prediction, nudge, tapau, setTapau, split, smartServe, setSmartServe,
    heldLines, whyOpen, setWhyOpen, flash,
    rightSize, confirmOrder, loadOverOrderScenario,
  } = props
  const rec = recommendedDishCount(partySize)
  const heldKeys = new Set(heldLines.map((l) => l.key))
  const heldPrice = heldLines.reduce(
    (sum, l) => sum + MENU_BY_ID[l.dishId].price * PORTIONS[l.portion].priceFactor,
    0,
  )

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <SectionLabel accent>Step 2 of 3 · Build your order</SectionLabel>
          <h2 className="font-display mt-2 text-3xl font-semibold tracking-tight">
            Table of {partySize}
            <button
              onClick={() => setPartySize(null)}
              className="ml-3 align-middle font-sans text-sm font-medium text-brand-700 underline decoration-brand-300 underline-offset-4 hover:text-brand-800"
            >
              change
            </button>
          </h2>
          <p className="mt-1 text-sm text-stone-500">
            Tables your size usually finish about <strong>{rec.ideal} dishes</strong> — order what
            you like, we'll flag it gently if it drifts.
          </p>
        </div>
        <DemoScenarioButton onClick={loadOverOrderScenario} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
        {/* Menu */}
        <div className="grid content-start gap-4 sm:grid-cols-2">
          {MENU.map((dish) => (
            <DishCard
              key={dish.id}
              dish={dish}
              count={order.filter((l) => l.dishId === dish.id).length}
              onAdd={() => addDish(dish.id)}
              onRemove={() => {
                const last = [...order].reverse().find((l) => l.dishId === dish.id)
                if (last) removeLine(last.key)
              }}
            />
          ))}
        </div>

        {/* Sticky order rail: summary + live checker + prediction */}
        <div id="order-rail" className="lg:sticky lg:top-24 lg:self-start">
          <Card className={`p-5 ${flash ? 'pulse-once' : ''}`}>
            <div className="flex items-baseline justify-between">
              <h3 className="font-display text-xl font-semibold">Your order</h3>
              <span className="text-sm text-stone-500">
                {order.length} {order.length === 1 ? 'dish' : 'dishes'}
              </span>
            </div>

            {order.length === 0 ? (
              <p className="mt-4 rounded-xl border border-dashed border-stone-200 px-4 py-8 text-center text-sm text-stone-400">
                Nothing yet — tap <span className="font-semibold text-brand-700">Add</span> on a dish
                to start. We'll estimate leftovers as you go.
              </p>
            ) : (
              <ul className="mt-3 space-y-2.5">
                {order.map((line) => {
                  const dish = MENU_BY_ID[line.dishId]
                  const portion = PORTIONS[line.portion]
                  const held = heldKeys.has(line.key)
                  return (
                    <li
                      key={line.key}
                      className={`animate-pop rounded-xl border p-3 ${
                        held
                          ? 'border-dashed border-stone-300 bg-white opacity-70'
                          : 'border-stone-100 bg-stone-50/60'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold">
                          {dish.emoji} {dish.name}
                          {held && (
                            <span className="ml-2 rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-stone-500">
                              ⏸ Round 2 · on hold
                            </span>
                          )}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="font-data text-[13px] font-medium text-stone-600">
                            {fmtSGD(dish.price * portion.priceFactor)}
                          </span>
                          <button
                            onClick={() => removeLine(line.key)}
                            aria-label={`Remove ${dish.name}`}
                            className="text-stone-400 transition-colors hover:text-red-600"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                      {dish.portionable ? (
                        <div className="mt-2 flex gap-1" role="radiogroup" aria-label={`${dish.name} portion size`}>
                          {Object.entries(PORTIONS)
                            // Solo diners have no one to share with — hide the
                            // Sharing size (unless it's somehow already selected)
                            .filter(([key]) => partySize > 1 || key !== 'sharing' || line.portion === 'sharing')
                            .map(([key, p]) => (
                            <button
                              key={key}
                              role="radio"
                              aria-checked={line.portion === key}
                              onClick={() => setPortion(line.key, key)}
                              className={`rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${
                                line.portion === key
                                  ? 'bg-brand-600 text-white'
                                  : 'bg-white text-stone-500 border border-stone-200 hover:border-brand-300 hover:text-brand-700'
                              }`}
                            >
                              {p.label}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-1.5 text-xs text-stone-400">One size (whole fish)</p>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}

            {/* Live Order Checker: soft nudge, never a block */}
            {nudge && (
              <div
                className={`animate-rise mt-4 flex items-start gap-2 rounded-xl border px-3.5 py-3 text-sm ${
                  nudge.tone === 'high'
                    ? 'border-red-200 bg-red-50 text-red-900'
                    : nudge.tone === 'info'
                      ? 'border-brand-200 bg-brand-50 text-brand-900'
                      : 'border-amber-200 bg-amber-50 text-amber-900'
                }`}
              >
                <span aria-hidden className="mt-0.5">{nudge.tone === 'high' ? '⚠' : nudge.tone === 'info' ? 'ⓘ' : '△'}</span>
                <span>{nudge.text}</span>
              </div>
            )}

            {/* Smart serve — stage the order: fire round 1, hold the excess */}
            {split && (
              <SmartServeCard
                split={split}
                smartServe={smartServe}
                setSmartServe={setSmartServe}
              />
            )}

            {/* Waste prediction */}
            {order.length > 0 && (
              <WastePrediction
                prediction={prediction}
                partySize={partySize}
                tapau={tapau}
                setTapau={setTapau}
                whyOpen={whyOpen}
                setWhyOpen={setWhyOpen}
                onRightSize={rightSize}
              />
            )}

            <div className="mt-5 space-y-1 border-t border-stone-100 pt-4">
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-medium text-stone-500">Subtotal</span>
                <span className="font-display text-[26px] font-semibold tabular-nums tracking-tight">
                  {fmtSGD(prediction.totalPrice)}
                </span>
              </div>
              <p className="text-right font-data text-[10.5px] text-stone-400">
                + 10% svc &amp; 9% GST at checkout
              </p>
              {heldLines.length > 0 && (
                <p className="text-right font-data text-[10.5px] font-medium text-brand-700">
                  + {fmtSGD(heldPrice)} on hold — billed only if round 2 is served
                </p>
              )}
            </div>

            <button
              onClick={confirmOrder}
              disabled={order.length === 0}
              className="btn-primary mt-4 w-full rounded-full bg-brand-600 py-3.5 text-base font-bold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-stone-200 disabled:text-stone-400"
            >
              {heldLines.length > 0
                ? `Send round 1 (${order.length - heldLines.length} dishes) to kitchen`
                : 'Send order to kitchen'}{' '}
              <span className="btn-arrow" aria-hidden>→</span>
            </button>
          </Card>
        </div>
      </div>

      {/* Mobile sticky bar — jump to the order rail */}
      {order.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-stone-900/8 bg-card/95 px-5 py-3 shadow-float backdrop-blur lg:hidden">
          <button
            onClick={() => document.getElementById('order-rail')?.scrollIntoView({ behavior: 'smooth' })}
            className="flex w-full items-center justify-between"
          >
            <span className="flex items-center gap-2 text-sm font-semibold">
              <span
                className={`inline-block h-2.5 w-2.5 rounded-full ${
                  prediction.level === 'low' ? 'bg-status-good' : prediction.level === 'medium' ? 'bg-status-warn' : 'bg-status-high'
                }`}
                aria-hidden
              />
              {order.length} {order.length === 1 ? 'dish' : 'dishes'} · ~{fmtG(prediction.predictedWasteG)} leftover est.
            </span>
            <span className="font-display text-lg font-semibold tabular-nums">{fmtSGD(prediction.totalPrice)}</span>
          </button>
        </div>
      )}
    </>
  )
}

function DishCard({ dish, count, onAdd, onRemove }) {
  const chip = finishChip(dish)
  return (
    <div
      className={`group/dish overflow-hidden rounded-[18px] border bg-card transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lift ${
        count ? 'border-brand-400/70 shadow-lift' : 'border-stone-900/6 shadow-card'
      }`}
    >
      <div className="relative aspect-[10/6.5] overflow-hidden bg-stone-100">
        <img
          src={dishPhoto(dish.id)}
          alt={dish.name}
          loading="lazy"
          className="dish-photo h-full w-full object-cover"
        />
        <div aria-hidden className="pointer-events-none absolute inset-0 rounded-t-[17px] ring-1 ring-inset ring-stone-900/10" />
        {chip && (
          <span
            className={`absolute left-2.5 top-2.5 rounded-full px-2.5 py-1 text-[11px] font-bold shadow-card backdrop-blur ${
              chip.tone === 'good' ? 'bg-white/92 text-status-good' : 'bg-white/92 text-status-warn'
            }`}
          >
            {chip.tone === 'good' ? '✓' : '△'} {chip.label}
          </span>
        )}
        {count > 0 && (
          <span className="animate-pop absolute right-2.5 top-2.5 flex h-7 w-7 items-center justify-center rounded-full bg-brand-600 font-data text-sm font-bold text-white shadow-card">
            {count}
          </span>
        )}
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-display text-[17px] font-semibold leading-snug">{dish.name}</h3>
            <p className="mt-0.5 text-xs text-stone-500">
              <span className="mr-1.5">{dish.nameZh}</span>
              <span className="capitalize">· {dish.category} · feeds ~{dish.typicalServings}</span>
            </p>
          </div>
          <span className="whitespace-nowrap font-data text-[13.5px] font-semibold text-stone-700">
            {fmtSGD(dish.price)}
          </span>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <span className="font-data text-[11px] text-stone-400">~{dish.portionWeightG} g</span>
          <div className="flex items-center gap-2">
            {count > 0 && (
              <button
                onClick={onRemove}
                aria-label={`Remove one ${dish.name}`}
                className="h-9 w-9 rounded-full border border-stone-200 bg-card text-lg leading-none text-stone-600 transition-all hover:border-red-300 hover:text-red-600 active:scale-90"
              >
                −
              </button>
            )}
            <button
              onClick={onAdd}
              aria-label={`Add ${dish.name}`}
              className={`h-9 rounded-full bg-brand-600 text-sm font-bold text-white shadow-card transition-all hover:bg-brand-700 hover:shadow-glow active:scale-90 ${count > 0 ? 'w-9 text-lg leading-none' : 'px-4'}`}
            >
              {count > 0 ? '+' : 'Add'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* Semicircular waste gauge — animates as the order changes. */
function WasteGauge({ rate, level }) {
  const pct = Math.min(rate / 0.55, 1)
  const r = 60
  const circumference = Math.PI * r
  const color =
    level === 'low' ? 'var(--color-status-good)' : level === 'medium' ? 'var(--color-status-warn)' : 'var(--color-status-high)'
  return (
    <svg viewBox="0 0 150 84" className="w-full max-w-[190px]" aria-hidden>
      <path
        d={`M 15 78 A ${r} ${r} 0 0 1 135 78`}
        fill="none" stroke="#e7e5dd" strokeWidth="11" strokeLinecap="round"
      />
      <path
        d={`M 15 78 A ${r} ${r} 0 0 1 135 78`}
        fill="none" stroke={color} strokeWidth="11" strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - pct)}
        className="gauge-arc"
      />
      <text x="75" y="62" textAnchor="middle" fontSize="21" fontWeight="700" fill="#1c1917">
        {Math.round(rate * 100)}%
      </text>
      <text x="75" y="78" textAnchor="middle" fontSize="9.5" fill="#8a8781">
        OF FOOD ORDERED
      </text>
    </svg>
  )
}

/*
 * SMART SERVE suggestion — lever #3. The engine proposed a split (fire
 * round 1 now, hold the excess); this card sells it and hosts the toggle.
 * Ordering happens at the hungriest moment of the meal — smart serve lets
 * the table decide about the last few dishes when they actually know.
 */
function SmartServeCard({ split, smartServe, setSmartServe }) {
  const heldG = split.later.reduce(
    (sum, l) => sum + MENU_BY_ID[l.dishId].portionWeightG * PORTIONS[l.portion].weightFactor,
    0,
  )
  const heldNames = [...new Set(split.later.map((l) => MENU_BY_ID[l.dishId].name))].join(' + ')

  return (
    <div className="animate-rise mt-4 rounded-xl border border-brand-200 bg-brand-50/70 p-4">
      <label className="flex cursor-pointer items-center justify-between gap-3">
        <span className="text-sm font-bold text-brand-900">
          🍽 Smart serve — start with {split.now.length}, hold {split.later.length}
        </span>
        <span
          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${smartServe ? 'bg-brand-600' : 'bg-stone-300'}`}
        >
          <input
            type="checkbox"
            checked={smartServe}
            onChange={(e) => setSmartServe(e.target.checked)}
            className="peer sr-only"
          />
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-card transition-all ${smartServe ? 'left-[22px]' : 'left-0.5'}`}
          />
        </span>
      </label>
      <p className="mt-1.5 text-xs leading-relaxed text-brand-900/80">
        Everyone orders at their hungriest. Fire {split.now.length} dishes now and keep{' '}
        <strong>{heldNames}</strong> (~{fmtG(heldG)}) on hold — near the end of the meal we'll ask:{' '}
        <em>still hungry?</em> One tap fires round 2. Comfortably full? It's never cooked and never
        billed.
      </p>
      {smartServe && (
        <p className="mt-2 rounded-lg bg-white/70 px-3 py-2 text-[11px] font-medium text-brand-800">
          ✓ Round 2 is on hold — the estimate and bill below cover round 1 only.
        </p>
      )}
    </div>
  )
}

/* The estimate, the gauge, the tapau lever, and full transparency. */
function WastePrediction({ prediction, partySize, tapau, setTapau, whyOpen, setWhyOpen, onRightSize }) {
  const {
    predictedWasteG, plateLeftoverG, tapauSavedG, rate, baseRate, floorRate, mix,
    level, ratio, effectiveDishes, n, totalWeightG, coverage, capacityG, ramp,
  } = prediction
  const l = LEVELS[level]

  return (
    <div className="mt-4 rounded-xl border border-stone-100 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <SectionLabel>Estimated leftovers</SectionLabel>
        <TrafficLight level={level} />
      </div>

      <div className="mt-3 flex items-center gap-4">
        <WasteGauge rate={rate} level={level} />
        <p className="text-sm text-stone-600">
          Approximately <strong className={`font-display text-xl ${l.fg}`}>{fmtG(predictedWasteG)}</strong>{' '}
          of the {fmtG(totalWeightG)} you're ordering may go uneaten.
          {tapau && tapauSavedG > 0 && (
            <span className="mt-1 block text-xs text-brand-700">
              🥡 {fmtG(tapauSavedG)} credited — packed leftovers are meals, not waste.
            </span>
          )}
        </p>
      </div>

      {/* Tapau — acting beats warning, lever #2 */}
      <label className="mt-3 flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-stone-150 border-stone-200 bg-stone-50/70 px-3.5 py-2.5">
        <span className="flex items-center gap-2 text-sm font-medium text-stone-700">
          <span aria-hidden>🥡</span> Planning to tapau leftovers?
        </span>
        <span
          className={`relative h-6 w-11 rounded-full transition-colors ${tapau ? 'bg-brand-600' : 'bg-stone-300'}`}
        >
          <input
            type="checkbox"
            checked={tapau}
            onChange={(e) => setTapau(e.target.checked)}
            className="peer sr-only"
          />
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-card transition-all ${tapau ? 'left-[22px]' : 'left-0.5'}`}
          />
        </span>
      </label>

      {(level === 'medium' || level === 'high') && (
        <button
          onClick={onRightSize}
          className="animate-rise mt-3 w-full rounded-full border border-brand-200 bg-brand-50 py-2.5 text-sm font-bold text-brand-800 transition-all hover:border-brand-300 hover:bg-brand-100 active:scale-[0.98]"
        >
          ✨ Right-size it for me — switch to Half portions
        </button>
      )}

      {/* Always-visible transparency panel — no black box */}
      <button
        onClick={() => setWhyOpen(!whyOpen)}
        aria-expanded={whyOpen}
        className="mt-3 flex w-full items-center justify-between text-sm font-semibold text-brand-700 hover:text-brand-800"
      >
        Why this estimate?
        <span className={`transition-transform ${whyOpen ? 'rotate-180' : ''}`} aria-hidden>▾</span>
      </button>
      {whyOpen && (
        <dl className="animate-rise mt-2 space-y-1.5 rounded-xl bg-stone-50 p-3.5 text-sm text-stone-600">
          <Row k="Party size" v={`${partySize} ${partySize === 1 ? 'person' : 'people'}`} />
          <Row k="Dishes ordered" v={`${effectiveDishes.toFixed(1).replace(/\.0$/, '')} (Half counts as 0.6)`} />
          <Row k="Food on the table" v={`${fmtG(totalWeightG)} of ~${fmtG(capacityG)} appetite (${Math.round(coverage * 100)}%)`} />
          {ramp >= 0.05 ? (
            <>
              <Row k="Dishes per person" v={ratio.toFixed(2)} />
              <Row
                k="Historical match"
                v={n > 0 ? `${n} past visits by tables your size ordering like this` : 'calibrated research curve (few similar visits yet)'}
              />
              <Row k="Their average waste" v={`${Math.round(baseRate * 100)}% of food ordered`} />
              <Row
                k="Dish-mix adjustment"
                v={`×${mix.toFixed(2)} ${mix > 1.02 ? '(carb/soup-heavy mixes come back unfinished more)' : mix < 0.98 ? '(premium proteins usually get finished)' : '(typical mix)'}`}
              />
              {ramp < 0.95 && (
                <Row k="Appetite scaling" v={`×${ramp.toFixed(2)} (order is close to what your table can finish)`} />
              )}
            </>
          ) : (
            <>
              <Row k="Within appetite" v="your table can finish this order" />
              <Row
                k="Expected floor"
                v={
                  mix > 1.02
                    ? `~${Math.round(floorRate * 100)}% — scraps (~3%) + residual from often-left-over dishes`
                    : '~3% — unavoidable scraps (bones, shells, sauce)'
                }
              />
            </>
          )}
          {tapau && <Row k="Tapau credit" v={`−${Math.round(prediction.plateLeftoverG ? (tapauSavedG / plateLeftoverG) * 100 : 0)}% of leftovers packed home`} />}
          <p className="pt-1.5 text-xs leading-relaxed text-stone-400">
            Simple rules, no black box: over-ordering waste only applies to food beyond what your
            table can eat (~420 g per person) — past that, we look up how much similar tables left
            behind and adjust for your dish mix. Dishes that often come back unfinished (rice,
            noodles, soup) carry a small residual even within appetite.
          </p>
        </dl>
      )}
    </div>
  )
}

function Row({ k, v }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-stone-500">{k}</dt>
      <dd className="text-right font-semibold text-stone-700">{v}</dd>
    </div>
  )
}

/* Step 3 — the green receipt: real bill anatomy + the sustainability story,
 * and the moment the visit enters shared history. */
function GreenReceipt({ confirmed, startOver, goToOperator, onCheckout, onCheckin }) {
  const { prediction, order, visit, savings, heldLines = [] } = confirmed
  const l = LEVELS[prediction.level]
  const service = prediction.totalPrice * SERVICE_CHARGE
  const gst = (prediction.totalPrice + service) * GST
  const total = prediction.totalPrice + service + gst
  const ecoPoints = Math.round((savings.gramsSaved + savings.tapauSavedG) / 10)

  return (
    <div className="mx-auto max-w-lg animate-pop">
      <Card className="overflow-hidden">
        {/* Receipt header */}
        <div className="bg-stone-900 px-8 pb-6 pt-7 text-center text-stone-100">
          <p className="font-display text-2xl font-semibold">{RESTAURANT.name}</p>
          <p className="mt-0.5 text-xs text-stone-400">
            {RESTAURANT.nameZh} · Table {RESTAURANT.table} · {visit.date}
          </p>
          <p className="mt-3 inline-block rounded-full bg-brand-600/20 px-3 py-1 text-xs font-semibold text-brand-300">
            {prediction.level === 'low' ? '🌱 Right-sized order — nice one.' : '👍 Order sent to kitchen'}
          </p>
        </div>

        <div className="px-8 py-6">
          {/* Line items */}
          <div className="space-y-2 text-sm">
            {order.map((line) => {
              const dish = MENU_BY_ID[line.dishId]
              return (
                <div key={line.key} className="flex items-baseline justify-between gap-3">
                  <span className="font-medium">
                    {dish.name}
                    {line.portion !== 'regular' && (
                      <span className="ml-2 rounded-full bg-brand-100 px-2 py-0.5 text-[11px] font-semibold text-brand-800">
                        {PORTIONS[line.portion].label}
                      </span>
                    )}
                  </span>
                  <span className="font-data text-[13px] text-stone-600">
                    {fmtSGD(dish.price * PORTIONS[line.portion].priceFactor)}
                  </span>
                </div>
              )
            })}
          </div>

          {/* Round 2 on hold — not cooked, not billed (yet) */}
          {heldLines.length > 0 && (
            <div className="mt-4 rounded-xl border border-dashed border-stone-300 bg-stone-50 px-4 py-3">
              <p className="text-[11px] font-bold uppercase tracking-widest text-stone-400">
                ⏸ On hold — round 2
              </p>
              <div className="mt-1.5 space-y-1 text-sm">
                {heldLines.map((line) => {
                  const dish = MENU_BY_ID[line.dishId]
                  return (
                    <div key={line.key} className="flex items-baseline justify-between gap-3 text-stone-500">
                      <span>{dish.emoji} {dish.name}</span>
                      <span className="text-xs">not billed unless served</span>
                    </div>
                  )
                })}
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-stone-400">
                We'll check in near the end of the meal — still hungry? Round 2 fires in one tap.
              </p>
            </div>
          )}

          {/* Bill anatomy */}
          <div className="receipt-rule mt-4 space-y-1.5 pt-3 text-sm text-stone-500">
            <div className="flex justify-between"><span>Subtotal</span><span className="font-data text-[13px]">{fmtSGD(prediction.totalPrice)}</span></div>
            <div className="flex justify-between"><span>Service charge 10%</span><span className="font-data text-[13px]">{fmtSGD(service)}</span></div>
            <div className="flex justify-between"><span>GST 9%</span><span className="font-data text-[13px]">{fmtSGD(gst)}</span></div>
            <div className="flex items-baseline justify-between pt-1.5 text-base font-bold text-stone-900">
              <span>Total</span>
              <span className="font-display text-xl tabular-nums">{fmtSGD(total)}</span>
            </div>
          </div>

          {/* Waste footprint */}
          <div className={`mt-5 flex items-center justify-between gap-3 rounded-xl border px-4 py-3 ${l.bg} ${l.ring}`}>
            <TrafficLight level={prediction.level} />
            <span className="text-sm text-stone-600">
              ~{fmtG(prediction.predictedWasteG)} est. leftovers
              {prediction.tapau && ' (after tapau)'}
            </span>
          </div>

          {/* Green savings */}
          {(savings.gramsSaved > 0 || savings.tapauSavedG > 0) ? (
            <div className="mt-4 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3.5">
              <p className="text-sm font-bold text-brand-900">🌱 Your right-sizing today</p>
              <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                <ReceiptStat v={`${Math.round(savings.gramsSaved + savings.tapauSavedG)} g`} k="waste avoided" />
                <ReceiptStat v={fmtSGD(savings.moneySaved)} k="off your bill" />
                <ReceiptStat v={`+${ecoPoints}`} k="eco-points" />
              </div>
            </div>
          ) : (
            <p className="mt-4 rounded-xl bg-stone-50 px-4 py-3 text-center text-sm text-stone-500">
              🌱 Right-sized from the start — no adjustments needed.
            </p>
          )}

          <p className="mt-4 text-center text-xs text-stone-400">
            This visit was just written into the restaurant's live history — after the meal, check
            out the table to verify the estimate and collect points.
          </p>

          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
            {heldLines.length > 0 ? (
              <button
                onClick={onCheckin}
                className="btn-primary rounded-full bg-brand-600 px-5 py-3 text-sm font-bold text-white hover:bg-brand-700"
              >
                🍽 Mid-meal check-in — still hungry? →
              </button>
            ) : (
              <button
                onClick={onCheckout}
                className="btn-primary rounded-full bg-brand-600 px-5 py-3 text-sm font-bold text-white hover:bg-brand-700"
              >
                📸 Table check-out (after the meal) →
              </button>
            )}
            <button
              onClick={goToOperator}
              className="rounded-full border border-stone-200 bg-card px-5 py-3 text-sm font-semibold text-stone-600 transition-colors hover:border-brand-300 hover:text-brand-700"
            >
              Skip to dashboard
            </button>
            <button
              onClick={startOver}
              className="rounded-full border border-stone-200 bg-card px-5 py-3 text-sm font-semibold text-stone-600 transition-colors hover:border-brand-300 hover:text-brand-700"
            >
              New table
            </button>
          </div>
        </div>
      </Card>
    </div>
  )
}

function ReceiptStat({ v, k }) {
  return (
    <div>
      <p className="font-display text-lg font-semibold text-brand-800">{v}</p>
      <p className="text-[11px] text-brand-700/70">{k}</p>
    </div>
  )
}

/*
 * MID-MEAL CHECK-IN — the smart-reorder moment. Near the end of the meal the
 * system asks the question the table couldn't answer at order time: "Still
 * hungry?" Each held dish is fired (cooked fresh, added to the bill and the
 * prediction) or skipped (never cooked, never billed — waste avoided before
 * it exists). The visit in shared history is updated to the final order, so
 * the operator feed and the model both see what was actually served.
 */
function MidMealCheckin({ confirmed, stats, tapau, updateVisit, onContinue, goToOperator, startOver }) {
  const { visit, order, heldLines, prediction } = confirmed
  const [choices, setChoices] = useState({}) // line key -> 'fire' | 'skip'
  const [resolved, setResolved] = useState(null)

  const decide = (key, choice) => {
    if (!resolved) setChoices((c) => ({ ...c, [key]: choice }))
  }
  const skipAll = () => {
    if (!resolved) setChoices(Object.fromEntries(heldLines.map((l) => [l.key, 'skip'])))
  }
  const allDecided = heldLines.every((l) => choices[l.key])
  const coveragePct = Math.round((prediction.coverage || 0) * 100)

  const confirmChoices = () => {
    const fired = heldLines.filter((l) => choices[l.key] === 'fire')
    const skipped = heldLines.filter((l) => choices[l.key] === 'skip')
    const finalOrder = [...order, ...fired]
    const finalPrediction = predictWaste(stats, visit.partySize, finalOrder, { tapau })
    const lineWeight = (l) => MENU_BY_ID[l.dishId].portionWeightG * PORTIONS[l.portion].weightFactor
    const linePrice = (l) => MENU_BY_ID[l.dishId].price * PORTIONS[l.portion].priceFactor
    const skippedG = Math.round(skipped.reduce((s, l) => s + lineWeight(l), 0))
    const skippedSGD = skipped.reduce((s, l) => s + linePrice(l), 0)

    // The visit in shared history becomes the final order — what the kitchen
    // actually cooked is what the model and the operator feed learn from.
    updateVisit(visit.id, {
      dishIds: finalOrder.map((l) => l.dishId),
      dishCount: Math.round(finalPrediction.effectiveDishes * 10) / 10,
      totalFoodWeightG: Math.round(finalPrediction.totalWeightG),
      wastedWeightG: finalPrediction.predictedWasteG,
    })
    setResolved({ fired, skipped, skippedG, skippedSGD, finalOrder, finalPrediction })
  }

  const continueToCheckout = () =>
    onContinue({
      ...confirmed,
      order: resolved.finalOrder,
      prediction: resolved.finalPrediction,
      heldLines: [],
      visit: { ...visit, wastedWeightG: resolved.finalPrediction.predictedWasteG },
      roundTwo: {
        firedCount: resolved.fired.length,
        skippedCount: resolved.skipped.length,
        skippedG: resolved.skippedG,
        skippedSGD: resolved.skippedSGD,
      },
    })

  return (
    <div className="mx-auto max-w-xl animate-rise">
      <Card className="p-7">
        <SectionLabel>Near the end of the meal</SectionLabel>
        <h2 className="font-display mt-1 text-2xl font-semibold tracking-tight">
          Still hungry? · Table {RESTAURANT.table}
        </h2>
        <p className="mt-1.5 text-sm text-stone-500">
          Round 1 put <strong className="text-stone-700">{fmtG(prediction.totalWeightG)}</strong> on
          the table — about <strong className="text-stone-700">{coveragePct}%</strong> of what a
          table of {visit.partySize} typically eats. {heldLines.length}{' '}
          {heldLines.length === 1 ? 'dish is' : 'dishes are'} still on hold: add another plate only
          if you're genuinely still hungry, instead of having ordered too much up front.
        </p>

        <div className="mt-5 space-y-3">
          {heldLines.map((line) => {
            const dish = MENU_BY_ID[line.dishId]
            const portion = PORTIONS[line.portion]
            const choice = choices[line.key]
            return (
              <div key={line.key} className="rounded-xl border border-stone-200 bg-white p-3.5">
                <div className="flex items-center gap-3">
                  <img
                    src={dishPhoto(line.dishId)}
                    alt={dish.name}
                    className="h-14 w-14 rounded-lg object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold">
                      {dish.emoji} {dish.name}
                      {line.portion !== 'regular' && (
                        <span className="ml-1.5 text-xs font-semibold text-stone-400">
                          {portion.label}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-stone-500">
                      ~{fmtG(dish.portionWeightG * portion.weightFactor)} ·{' '}
                      {fmtSGD(dish.price * portion.priceFactor)} · ready in minutes
                    </p>
                  </div>
                </div>
                <div className="mt-2.5 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => decide(line.key, 'fire')}
                    disabled={!!resolved}
                    aria-pressed={choice === 'fire'}
                    className={`rounded-lg border px-3 py-2 text-xs font-bold transition-all ${
                      choice === 'fire'
                        ? 'border-amber-400 bg-amber-50 text-amber-900 ring-2 ring-amber-300'
                        : 'border-stone-200 bg-white text-stone-600 hover:border-amber-300'
                    } ${resolved && choice !== 'fire' ? 'opacity-40' : ''}`}
                  >
                    🔥 Still hungry — fire it
                  </button>
                  <button
                    onClick={() => decide(line.key, 'skip')}
                    disabled={!!resolved}
                    aria-pressed={choice === 'skip'}
                    className={`rounded-lg border px-3 py-2 text-xs font-bold transition-all ${
                      choice === 'skip'
                        ? 'border-brand-400 bg-brand-50 text-brand-900 ring-2 ring-brand-300'
                        : 'border-stone-200 bg-white text-stone-600 hover:border-brand-300'
                    } ${resolved && choice !== 'skip' ? 'opacity-40' : ''}`}
                  >
                    ✓ We're good — skip it
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {!resolved ? (
          <>
            <div className="mt-4 flex items-center justify-between gap-3">
              <button
                onClick={skipAll}
                className="text-xs font-semibold text-brand-700 underline decoration-brand-300 underline-offset-4 hover:text-brand-800"
              >
                We're all full — skip everything
              </button>
              <button
                onClick={confirmChoices}
                disabled={!allDecided}
                className="btn-primary rounded-full bg-brand-600 px-5 py-3 text-sm font-bold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-stone-200 disabled:text-stone-400"
              >
                Confirm round 2 →
              </button>
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-stone-400">
              Skipped dishes are never cooked and never billed — that's food waste avoided in the
              kitchen, before it can reach a plate or a bin.
            </p>
          </>
        ) : (
          <div className="animate-pop mt-5 rounded-2xl border border-stone-200 bg-stone-50/70 p-5">
            {resolved.skipped.length > 0 && (
              <p className="text-sm text-stone-600">
                🌱 <strong>{resolved.skipped.length}</strong>{' '}
                {resolved.skipped.length === 1 ? 'plate' : 'plates'} never cooked —{' '}
                <strong>{fmtG(resolved.skippedG)}</strong> of food stays out of the bin and{' '}
                <strong>{fmtSGD(resolved.skippedSGD)}</strong> stays off your bill.
              </p>
            )}
            {resolved.fired.length > 0 && (
              <p className={`text-sm text-stone-600 ${resolved.skipped.length > 0 ? 'mt-2' : ''}`}>
                🔥 <strong>{resolved.fired.length}</strong>{' '}
                {resolved.fired.length === 1 ? 'dish' : 'dishes'} fired — arriving hot in a few
                minutes. Updated leftover estimate:{' '}
                <strong>{fmtG(resolved.finalPrediction.predictedWasteG)}</strong>.
              </p>
            )}
            <p className="mt-3 text-xs text-stone-400">
              ✓ The visit history now reflects what the kitchen actually cooked.
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <button
                onClick={continueToCheckout}
                className="btn-primary rounded-full bg-brand-600 px-5 py-3 text-sm font-bold text-white hover:bg-brand-700"
              >
                📸 Table check-out →
              </button>
              <button
                onClick={goToOperator}
                className="rounded-full border border-stone-200 bg-card px-5 py-3 text-sm font-semibold text-stone-600 transition-colors hover:border-brand-300 hover:text-brand-700"
              >
                Skip to dashboard
              </button>
              <button
                onClick={startOver}
                className="rounded-full border border-stone-200 bg-card px-5 py-3 text-sm font-semibold text-stone-600 transition-colors hover:border-brand-300 hover:text-brand-700"
              >
                New table
              </button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}

/*
 * TABLE CHECK-OUT — the verification loop + points, in one screen.
 * Before/after photos stand in for the real measurement (clearing-station
 * weigh or vision-scored after-photo); the presenter taps the outcome so
 * every demo run is deterministic. Beating the prediction earns points,
 * split across every account at the table.
 */
const PARTY_NAMES = [DINER_NAME, 'Wei Ming', 'Priya', 'Sarah', 'Jun Jie', 'Alex', 'Mei Lin', 'Raj']

function TableCheckout({ confirmed, updateVisit, startOver, goToOperator }) {
  const { prediction, order, visit } = confirmed
  const [outcome, setOutcome] = useState(null) // one of checkoutOutcomes()
  const [logged, setLogged] = useState(false)

  const outcomes = checkoutOutcomes(prediction)
  const predictedG = prediction.plateLeftoverG
  const predictedPct = Math.round((predictedG / prediction.totalWeightG) * 100)
  const members = PARTY_NAMES.slice(0, visit.partySize)

  const points = outcome ? checkoutPoints(predictedG, outcome.measuredG, visit.partySize) : null

  const logResult = () => {
    // The measured outcome replaces the prediction in the shared history —
    // the model now learns from reality, and the feed marks it verified.
    updateVisit(visit.id, { wastedWeightG: outcome.measuredG, verified: true })
    setLogged(true)
  }

  return (
    <div className="mx-auto max-w-xl animate-rise">
      <Card className="p-7">
        <SectionLabel>After the meal</SectionLabel>
        <h2 className="font-display mt-1 text-2xl font-semibold tracking-tight">
          Table check-out · Table {RESTAURANT.table}
        </h2>
        <p className="mt-1.5 text-sm text-stone-500">
          When you ordered, we estimated{' '}
          <strong className="text-stone-700">{fmtG(predictedG)} ({predictedPct}%)</strong> would be
          left on the table. Let's see how you actually did.
        </p>

        {/* "Before" — the dishes as they arrived (we have their photos) */}
        <div className="mt-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-stone-400">
            📸 Before — as served
          </p>
          <div className="mt-2 flex gap-2 overflow-hidden rounded-xl">
            {order.slice(0, 5).map((line) => (
              <img
                key={line.key}
                src={dishPhoto(line.dishId)}
                alt={MENU_BY_ID[line.dishId].name}
                className="h-16 min-w-0 flex-1 rounded-lg object-cover"
              />
            ))}
          </div>
        </div>

        {/* "After" — the demo stand-in for the measured result */}
        <div className="mt-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-stone-400">
            📸 After — tap what the photo shows
          </p>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {outcomes.map((o) => (
              <button
                key={o.key}
                onClick={() => !logged && setOutcome(o)}
                disabled={logged}
                aria-pressed={outcome?.key === o.key}
                className={`rounded-xl border p-3.5 text-left transition-all ${
                  outcome?.key === o.key
                    ? 'border-brand-400 bg-brand-50 ring-2 ring-brand-300'
                    : 'border-stone-200 bg-white hover:border-brand-300'
                } ${logged && outcome?.key !== o.key ? 'opacity-40' : ''}`}
              >
                <span className="text-xl" aria-hidden>{o.emoji}</span>
                <p className="mt-1 text-sm font-bold">{o.label}</p>
                <p className="mt-0.5 text-xs text-stone-500">{o.detail}</p>
                <p className="mt-1.5 text-xs font-semibold tabular-nums text-stone-600">
                  ≈ {fmtG(o.measuredG)} left
                </p>
              </button>
            ))}
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-stone-400">
            Demo stand-in: in a real deployment the after-photo is scored automatically (or the
            clearing station weighs the leftovers) — no self-reporting.
          </p>
        </div>

        {/* Result + points */}
        {outcome && (
          <div className="animate-pop mt-5 rounded-2xl border border-stone-150 border-stone-200 bg-stone-50/70 p-5">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm text-stone-500">Estimated → measured</p>
              <p className="font-display text-xl font-semibold tabular-nums">
                {fmtG(predictedG)} → <span className={points.beat ? 'text-status-good' : 'text-status-warn'}>{fmtG(outcome.measuredG)}</span>
              </p>
            </div>

            {points.beat ? (
              <p className="mt-2 text-sm text-stone-600">
                🎉 You beat the estimate by <strong>{fmtG(points.beatG)}</strong> — that's food on
                plates, not in the bin.
              </p>
            ) : (
              <p className="mt-2 text-sm text-stone-600">
                No beat this time — but the result still teaches the model. Half portions or a tapau
                make it easy next visit.
              </p>
            )}

            {/* Mottainai Rewards — Starbucks-style balance + milestone tiers */}
            <RewardsCard earned={points.perPerson} members={members} />

            {!logged ? (
              <button
                onClick={logResult}
                className="btn-primary mt-4 w-full rounded-full bg-brand-600 py-3 text-sm font-bold text-white hover:bg-brand-700"
              >
                Log result & collect points
              </button>
            ) : (
              <div className="animate-rise mt-4">
                <p className="text-center text-xs text-stone-400">
                  ✓ Measured result saved — the model just re-learned from reality, and this visit
                  is now marked verified on the operator feed.
                </p>

                {/* The diner's own trend — the operator has one, so should you */}
                <PersonalWasteTrend
                  measuredG={outcome.measuredG}
                  partySize={visit.partySize}
                />
                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:justify-center">
                  <button
                    onClick={goToOperator}
                    className="btn-primary rounded-full bg-brand-600 px-5 py-3 text-sm font-bold text-white hover:bg-brand-700"
                  >
                    See it verified on the dashboard →
                  </button>
                  <button
                    onClick={startOver}
                    className="rounded-full border border-stone-200 bg-card px-5 py-3 text-sm font-semibold text-stone-600 transition-colors hover:border-brand-300 hover:text-brand-700"
                  >
                    Start a new table
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  )
}

/*
 * YOUR WASTE TREND — the diner's personal history, revealed at check-out.
 * Same closed-loop story as the operator's trend chart, but for one account:
 * past check-outs (per-person measured leftovers) plus today's result.
 * Single series, one hue — today is emphasised by full-strength teal and a
 * direct label; past visits sit at 35% strength. Chart chrome follows the
 * operator view (recessive axes, muted ink, thin rounded bars).
 */
const TREND_TEAL = '#0d9488'
const TREND_INK_MUTED = '#8a8781'

function PersonalWasteTrend({ measuredG, partySize }) {
  const todayG = Math.round(measuredG / partySize)
  const data = [
    ...DINER_PAST_VISITS.map((v) => ({ ...v, today: false })),
    { label: 'Today', wastePerPersonG: todayG, today: true },
  ]
  const first = DINER_PAST_VISITS[0].wastePerPersonG
  const pastAvg = Math.round(
    DINER_PAST_VISITS.reduce((s, v) => s + v.wastePerPersonG, 0) / DINER_PAST_VISITS.length,
  )
  const bestYet = todayG <= Math.min(...DINER_PAST_VISITS.map((v) => v.wastePerPersonG))
  const deltaPct = Math.round((1 - todayG / first) * 100)

  return (
    <div className="mt-4 rounded-xl bg-white p-4 shadow-card">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-bold text-stone-800">📉 Your waste trend</p>
        <p className="text-[11px] text-stone-400">leftovers per person, your check-outs</p>
      </div>
      <div className="mt-2 h-36">
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 18, right: 8, left: 8, bottom: 0 }}>
            <XAxis
              dataKey="label"
              interval={0}
              tick={{ fill: TREND_INK_MUTED, fontSize: 10.5 }}
              axisLine={{ stroke: '#c9c6bd' }}
              tickLine={false}
            />
            <YAxis hide domain={[0, (dataMax) => Math.max(dataMax + 20, first + 20)]} />
            <Tooltip content={<TrendTip />} cursor={{ fill: 'rgba(13,148,136,0.06)' }} />
            <ReferenceLine
              y={pastAvg}
              stroke={TREND_INK_MUTED}
              strokeDasharray="4 4"
              label={{ value: 'your average', position: 'insideTopLeft', fill: TREND_INK_MUTED, fontSize: 10 }}
            />
            <Bar dataKey="wastePerPersonG" name="Leftovers per person" radius={[4, 4, 0, 0]} maxBarSize={26}>
              {data.map((d) => (
                <Cell key={d.label} fill={TREND_TEAL} fillOpacity={d.today ? 1 : 0.35} />
              ))}
              <LabelList
                content={({ x, y, width, index, value }) =>
                  index === data.length - 1 ? (
                    <text
                      x={x + width / 2}
                      y={y - 6}
                      textAnchor="middle"
                      fontSize={11}
                      fontWeight={700}
                      fill={TREND_TEAL}
                    >
                      {value} g
                    </text>
                  ) : null
                }
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-stone-500">
        {bestYet
          ? `Your best visit yet — ${todayG} g each, down from ${first} g on your first Mottainai check-out.`
          : deltaPct > 0
            ? `${todayG} g each today — ${deltaPct}% less than your first Mottainai check-out.`
            : `${todayG} g each today — above your recent form. Half portions or a smart-serve hold make the next one easy.`}
      </p>
    </div>
  )
}

function TrendTip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs shadow-lift">
      <p className="font-bold text-stone-700">{label}</p>
      <p className="mt-0.5 flex items-center gap-1.5 text-stone-600">
        <span className="inline-block h-2 w-2 rounded-full" style={{ background: TREND_TEAL }} aria-hidden />
        Leftovers per person: <strong>{payload[0].value} g</strong>
      </p>
    </div>
  )
}

/*
 * MOTTAINAI REWARDS — the loyalty moment, styled after the Starbucks
 * Rewards home card: personal greeting, big star balance, a milestone track
 * with dots, and tier rewards you redeem (drink → voucher → dish → feast).
 * The seeded balance sits one point under a tier, so today's check-out
 * always pushes the diner across a milestone live on stage.
 */
function RewardsCard({ earned, members }) {
  const [redeemed, setRedeemed] = useState({})
  const balance = DINER_POINTS_BALANCE + earned
  const tiers = REWARD_TIERS
  const n = tiers.length

  // Progress along the evenly-spaced milestone track (Starbucks-style):
  // dots sit at equal intervals; the fill interpolates between them.
  let reachedIdx = -1
  for (let i = 0; i < n; i++) if (balance >= tiers[i].at) reachedIdx = i
  const frac =
    reachedIdx === n - 1
      ? 0
      : reachedIdx === -1
        ? Math.max(0, balance / tiers[0].at - 1)
        : (balance - tiers[reachedIdx].at) / (tiers[reachedIdx + 1].at - tiers[reachedIdx].at)
  const progressPct = Math.max(0, Math.min(1, (reachedIdx + frac) / (n - 1))) * 100
  const nextTier = tiers.find((t) => balance < t.at)

  const hour = new Date().getHours()
  const [greeting, sky] =
    hour < 12 ? ['Good morning', '☀️'] : hour < 18 ? ['Good afternoon', '☀️'] : ['Good evening', '🌙']

  return (
    <div className="mt-4 overflow-hidden rounded-[22px] border border-brand-800/60 bg-gradient-to-br from-brand-900 via-[#0c3f3a] to-stone-900 p-5 text-white shadow-lift">
      <p className="font-display text-[22px] font-semibold tracking-tight">
        {greeting}, {DINER_NAME} <span aria-hidden>{sky}</span>
      </p>

      {/* Balance row */}
      <div className="mt-4 flex items-center gap-3">
        <p className="font-data text-[10px] font-semibold uppercase leading-[1.35] tracking-[0.2em] text-white/55">
          Eco<br />Balance
        </p>
        <p className="font-display text-[46px] font-semibold leading-none tracking-tight">
          {balance}
        </p>
        <span aria-hidden className="text-[26px] leading-none">🍚</span>
        <span className="ml-auto rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1 font-data text-[11px] font-bold text-amber-200">
          +{earned} today
        </span>
      </div>

      {/* Milestone track */}
      <div className="relative mx-1.5 mt-7 h-9">
        <div className="absolute left-0 right-0 top-[7px] h-[3px] rounded-full bg-white/15" />
        <div
          className="meter-fill absolute left-0 top-[7px] h-[3px] rounded-full bg-gradient-to-r from-amber-200/70 to-amber-300"
          style={{ width: `${progressPct}%` }}
        />
        {/* the "you are here" marker */}
        <span
          className="absolute top-[8.5px] z-10 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-card"
          style={{ left: `${progressPct}%` }}
          aria-hidden
        />
        {tiers.map((t, i) => {
          const reached = balance >= t.at
          return (
            <div
              key={t.at}
              className="absolute top-0 -translate-x-1/2 text-center"
              style={{ left: `${(i / (n - 1)) * 100}%` }}
            >
              <span
                className={`mx-auto block h-[17px] w-[17px] rounded-full border-2 transition-colors ${
                  reached ? 'border-amber-200 bg-amber-300' : 'border-white/20 bg-white/20'
                }`}
                aria-hidden
              />
              <span className={`mt-1.5 block font-data text-[10px] ${reached ? 'text-amber-200' : 'text-white/45'}`}>
                {t.at}
              </span>
            </div>
          )
        })}
      </div>
      {nextTier && (
        <p className="mt-3 text-xs text-white/60">
          <strong className="font-semibold text-white/90">{nextTier.at - balance} pts</strong> to your
          next reward — {nextTier.label.toLowerCase()}.
        </p>
      )}

      {/* Tier rewards — redeemable once reached */}
      <div className="mt-4 space-y-1.5" role="list" aria-label="Reward tiers">
        {tiers.map((t) => {
          const reached = balance >= t.at
          const unlockedToday = reached && t.at > DINER_POINTS_BALANCE
          const isRedeemed = !!redeemed[t.at]
          return (
            <button
              key={t.at}
              role="listitem"
              disabled={!reached}
              onClick={() => setRedeemed((r) => ({ ...r, [t.at]: !r[t.at] }))}
              className={`flex w-full items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left transition-all ${
                unlockedToday && !isRedeemed
                  ? 'animate-pop border-amber-300/50 bg-amber-300/12'
                  : reached
                    ? 'border-white/10 bg-white/6 hover:bg-white/10'
                    : 'border-white/6 bg-transparent opacity-55'
              } ${reached ? 'cursor-pointer' : 'cursor-default'}`}
            >
              <span className="text-lg" aria-hidden>{t.emoji}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-bold leading-snug">{t.label}</span>
                <span className="block text-[11px] text-white/50">{t.detail}</span>
              </span>
              {isRedeemed ? (
                <span className="whitespace-nowrap rounded-full bg-white/90 px-2.5 py-1 text-[10.5px] font-bold text-brand-900">
                  ✓ Show at counter
                </span>
              ) : unlockedToday ? (
                <span className="whitespace-nowrap rounded-full bg-amber-300 px-2.5 py-1 text-[10.5px] font-bold text-stone-900">
                  ✨ Unlocked — redeem
                </span>
              ) : reached ? (
                <span className="whitespace-nowrap rounded-full border border-white/25 px-2.5 py-1 text-[10.5px] font-semibold text-white/80">
                  Redeem
                </span>
              ) : (
                <span className="whitespace-nowrap font-data text-[11px] text-white/40">{t.at} 🍚</span>
              )}
            </button>
          )
        })}
      </div>

      {/* Everyone at the table earns — the split, on the dark card */}
      <div className="mt-5 border-t border-white/10 pt-4">
        <div className="flex flex-wrap gap-2">
          {members.map((name) => (
            <span
              key={name}
              className="flex items-center gap-1.5 rounded-full bg-white/10 py-1 pl-1.5 pr-3 text-xs font-semibold text-white/90"
            >
              <span
                className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-500 text-[10px] font-bold text-white"
                aria-hidden
              >
                {name.slice(0, 1)}
              </span>
              {name} +{earned}
            </span>
          ))}
        </div>
        <p className="mt-3 text-[10.5px] leading-relaxed text-white/40">
          🏛 Illustrative national programme — modelled on Healthy 365 / the National Steps
          Challenge: points redeemable as CDC or hawker vouchers. Fictional partnership, shown for
          demo purposes.
        </p>
      </div>
    </div>
  )
}

function DemoScenarioButton({ onClick }) {
  return (
    <button
      onClick={onClick}
      className="rounded-full border border-amber-300 bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-800 shadow-card transition-all hover:bg-amber-100"
      title="Pre-fills a table of 3 that over-ordered — fix it live with portion choices"
    >
      🎬 Load over-order scenario
    </button>
  )
}
