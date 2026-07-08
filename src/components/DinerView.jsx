import { useMemo, useState } from 'react'
import { MENU, MENU_BY_ID, PORTIONS } from '../data/seedData.js'
import { predictWaste, nudgeFor, recommendedDishCount } from '../engine/recommend.js'
import { Card, SectionLabel, TrafficLight, OnboardingHint, LEVELS, fmtG, fmtSGD } from './ui.jsx'

let lineKey = 0

export default function DinerView({ stats, addVisit, goToOperator }) {
  const [partySize, setPartySize] = useState(null)
  const [order, setOrder] = useState([]) // [{ key, dishId, portion }]
  const [confirmed, setConfirmed] = useState(null)
  const [whyOpen, setWhyOpen] = useState(false)
  const [flash, setFlash] = useState(false)

  const prediction = useMemo(
    () => predictWaste(stats, partySize, order),
    [stats, partySize, order],
  )
  const nudge = useMemo(() => nudgeFor(stats, partySize, order), [stats, partySize, order])

  const addDish = (dishId) => {
    setOrder((o) => [...o, { key: ++lineKey, dishId, portion: 'regular' }])
  }
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
    const evaluate = (o) => predictWaste(stats, partySize, o)
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
    const visit = {
      id: `live-${Date.now()}`,
      date: new Date().toISOString().slice(0, 10),
      week: 11,
      partySize,
      dishIds: order.map((l) => l.dishId),
      dishCount: Math.round(prediction.effectiveDishes * 10) / 10,
      totalFoodWeightG: Math.round(prediction.totalWeightG),
      wastedWeightG: prediction.predictedWasteG,
      source: 'live',
    }
    addVisit(visit)
    setConfirmed({ visit, prediction, order })
  }

  const startOver = () => {
    setConfirmed(null)
    setOrder([])
    setPartySize(null)
    setWhyOpen(false)
  }

  // ---------------------------------------------------------------- screens
  if (confirmed) {
    return <Confirmation confirmed={confirmed} startOver={startOver} goToOperator={goToOperator} />
  }

  if (!partySize) {
    return (
      <div className="mx-auto max-w-2xl animate-rise">
        <OnboardingHint>
          Welcome! MakanSense helps your table order <strong>just the right amount</strong> — using
          this restaurant's own dining history. Start by telling us your party size.
        </OnboardingHint>
        <Card className="mt-6 p-10 text-center">
          <SectionLabel>Step 1 of 3</SectionLabel>
          <h2 className="mt-3 text-3xl font-bold tracking-tight">How many are dining today?</h2>
          <div className="mx-auto mt-8 grid max-w-md grid-cols-4 gap-3">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
              <button
                key={n}
                onClick={() => setPartySize(n)}
                className="aspect-square rounded-2xl border border-stone-200 bg-white text-2xl font-bold text-stone-700 shadow-card transition-all hover:-translate-y-0.5 hover:border-brand-400 hover:text-brand-700 hover:shadow-lift"
              >
                {n === 8 ? '8+' : n}
              </button>
            ))}
          </div>
          <p className="mt-6 text-sm text-stone-500">
            Tables of {recommendedDishCount(4).ideal} usually finish about {recommendedDishCount(4).ideal} shared
            dishes — we'll guide you as you order.
          </p>
        </Card>
        <div className="mt-6 text-center">
          <DemoScenarioButton onClick={loadOverOrderScenario} />
        </div>
      </div>
    )
  }

  const rec = recommendedDishCount(partySize)

  return (
    <div className="animate-rise">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <SectionLabel>Step 2 of 3 — Build your order</SectionLabel>
          <h2 className="mt-1 text-2xl font-bold tracking-tight">
            Table of {partySize}
            <button
              onClick={() => setPartySize(null)}
              className="ml-3 align-middle text-sm font-medium text-brand-700 underline decoration-brand-300 underline-offset-4 hover:text-brand-800"
            >
              change
            </button>
          </h2>
          <p className="mt-1 text-sm text-stone-500">
            Tables your size usually finish about <strong>{rec.ideal} dishes</strong> — order what you
            like, we'll flag it gently if it drifts.
          </p>
        </div>
        <DemoScenarioButton onClick={loadOverOrderScenario} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
        {/* Menu */}
        <div className="grid content-start gap-3 sm:grid-cols-2">
          {MENU.map((dish) => {
            const count = order.filter((l) => l.dishId === dish.id).length
            return (
              <Card key={dish.id} className={`p-4 transition-shadow hover:shadow-lift ${count ? 'ring-2 ring-brand-300' : ''}`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-2xl" aria-hidden>{dish.emoji}</div>
                    <h3 className="mt-1.5 font-semibold leading-snug">{dish.name}</h3>
                    <p className="mt-0.5 text-xs capitalize text-stone-500">
                      {dish.category} · feeds ~{dish.typicalServings}
                    </p>
                  </div>
                  <span className="whitespace-nowrap text-sm font-semibold text-stone-700">
                    {fmtSGD(dish.price)}
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xs text-stone-400">~{dish.portionWeightG} g</span>
                  <div className="flex items-center gap-2">
                    {count > 0 && (
                      <>
                        <button
                          onClick={() => {
                            const last = [...order].reverse().find((l) => l.dishId === dish.id)
                            if (last) removeLine(last.key)
                          }}
                          aria-label={`Remove one ${dish.name}`}
                          className="h-8 w-8 rounded-full border border-stone-200 bg-white text-lg leading-none text-stone-600 transition-colors hover:border-red-300 hover:text-red-600"
                        >
                          −
                        </button>
                        <span className="w-4 text-center text-sm font-bold text-brand-700">{count}</span>
                      </>
                    )}
                    <button
                      onClick={() => addDish(dish.id)}
                      aria-label={`Add ${dish.name}`}
                      className="h-8 w-8 rounded-full bg-brand-600 text-lg leading-none text-white shadow-card transition-all hover:bg-brand-700 active:scale-95"
                    >
                      +
                    </button>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>

        {/* Sticky order rail: summary + live checker + prediction */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          <Card className={`p-5 ${flash ? 'pulse-once' : ''}`}>
            <div className="flex items-baseline justify-between">
              <h3 className="text-lg font-bold">Your order</h3>
              <span className="text-sm text-stone-500">
                {order.length} {order.length === 1 ? 'dish' : 'dishes'}
              </span>
            </div>

            {order.length === 0 ? (
              <p className="mt-4 rounded-xl border border-dashed border-stone-200 px-4 py-8 text-center text-sm text-stone-400">
                Nothing yet — tap <span className="font-semibold text-brand-700">+</span> on a dish to
                start. We'll estimate leftovers as you go.
              </p>
            ) : (
              <ul className="mt-3 space-y-2.5">
                {order.map((line) => {
                  const dish = MENU_BY_ID[line.dishId]
                  const portion = PORTIONS[line.portion]
                  return (
                    <li key={line.key} className="animate-pop rounded-xl border border-stone-100 bg-stone-50/60 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold">
                          {dish.emoji} {dish.name}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-stone-600">
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
                          {Object.entries(PORTIONS).map(([key, p]) => (
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

            {/* Step 3 — Live Order Checker: soft nudge, never a block */}
            {nudge && (
              <div
                className={`animate-rise mt-4 flex items-start gap-2 rounded-xl border px-3.5 py-3 text-sm ${
                  nudge.tone === 'high'
                    ? 'border-red-200 bg-red-50 text-red-900'
                    : 'border-amber-200 bg-amber-50 text-amber-900'
                }`}
              >
                <span aria-hidden className="mt-0.5">{nudge.tone === 'high' ? '⚠' : '△'}</span>
                <span>{nudge.text}</span>
              </div>
            )}

            {/* Step 4 — Waste prediction */}
            {order.length > 0 && (
              <WastePrediction
                prediction={prediction}
                partySize={partySize}
                whyOpen={whyOpen}
                setWhyOpen={setWhyOpen}
                onRightSize={rightSize}
              />
            )}

            <div className="mt-5 flex items-baseline justify-between border-t border-stone-100 pt-4">
              <span className="text-sm font-medium text-stone-500">Total</span>
              <span className="text-2xl font-bold tracking-tight">{fmtSGD(prediction.totalPrice)}</span>
            </div>

            <button
              onClick={confirmOrder}
              disabled={order.length === 0}
              className="mt-4 w-full rounded-xl bg-brand-600 py-3.5 text-base font-bold text-white shadow-card transition-all hover:bg-brand-700 hover:shadow-lift active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-stone-200 disabled:text-stone-400 disabled:shadow-none"
            >
              Confirm order →
            </button>
          </Card>
        </div>
      </div>
    </div>
  )
}

/* Step 4 UI — the estimate, the traffic light, and full transparency. */
function WastePrediction({ prediction, partySize, whyOpen, setWhyOpen, onRightSize }) {
  const { predictedWasteG, rate, level, ratio, effectiveDishes, n, totalWeightG } = prediction
  const meterPct = Math.min((rate / 0.55) * 100, 100)
  const l = LEVELS[level]

  return (
    <div className="mt-4 rounded-xl border border-stone-100 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <SectionLabel>Estimated leftovers</SectionLabel>
        <TrafficLight level={level} />
      </div>

      <p className="mt-3 text-sm text-stone-600">
        Based on your current order, approximately{' '}
        <strong className={`text-lg ${l.fg}`}>{fmtG(predictedWasteG)}</strong> of food may be left
        uneaten (~{Math.round(rate * 100)}% of {fmtG(totalWeightG)} ordered).
      </p>

      {/* Animated waste meter */}
      <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-stone-100" aria-hidden>
        <div
          className={`meter-fill h-full rounded-full ${
            level === 'low' ? 'bg-status-good' : level === 'medium' ? 'bg-status-warn' : 'bg-status-high'
          }`}
          style={{ width: `${meterPct}%` }}
        />
      </div>

      {(level === 'medium' || level === 'high') && (
        <button
          onClick={onRightSize}
          className="animate-rise mt-3 w-full rounded-xl border border-brand-200 bg-brand-50 py-2.5 text-sm font-bold text-brand-800 transition-all hover:bg-brand-100 active:scale-[0.99]"
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
          <Row k="Dishes ordered" v={`${effectiveDishes.toFixed(1).replace(/\.0$/, '')} (Half portions count as 0.6)`} />
          <Row k="Dishes per person" v={ratio.toFixed(2)} />
          <Row
            k="Historical match"
            v={n > 0 ? `${n} past visits by tables your size ordering like this` : 'calibrated research curve (few similar visits yet)'}
          />
          <Row k="Their average waste" v={`${Math.round(rate * 100)}% of food ordered`} />
          <p className="pt-1.5 text-xs leading-relaxed text-stone-400">
            Simple rule, no black box: we bucket your dishes-per-person ratio, look up how much
            similar tables actually left behind, and apply that rate to your order's weight.
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

/* Step 6 — confirmation, and the moment the visit enters shared history. */
function Confirmation({ confirmed, startOver, goToOperator }) {
  const { prediction, order, visit } = confirmed
  const l = LEVELS[prediction.level]
  return (
    <div className="mx-auto max-w-xl animate-pop">
      <Card className="p-8 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-50 text-3xl" aria-hidden>
          {prediction.level === 'low' ? '🌱' : '👍'}
        </div>
        <h2 className="mt-4 text-2xl font-bold tracking-tight">
          {prediction.level === 'low'
            ? 'Nice — this order is right-sized for your table.'
            : 'Order confirmed — enjoy your meal!'}
        </h2>
        <p className="mt-2 text-sm text-stone-500">
          Table of {visit.partySize} · {order.length} dishes · {fmtSGD(prediction.totalPrice)}
        </p>

        <div className="mt-6 space-y-2 text-left">
          {order.map((line) => {
            const dish = MENU_BY_ID[line.dishId]
            return (
              <div key={line.key} className="flex items-center justify-between rounded-xl bg-stone-50 px-4 py-2.5 text-sm">
                <span className="font-medium">
                  {dish.emoji} {dish.name}
                  {line.portion !== 'regular' && (
                    <span className="ml-2 rounded-full bg-brand-100 px-2 py-0.5 text-xs font-semibold text-brand-800">
                      {PORTIONS[line.portion].label}
                    </span>
                  )}
                </span>
                <span className="text-stone-500">{fmtSGD(dish.price * PORTIONS[line.portion].priceFactor)}</span>
              </div>
            )
          })}
        </div>

        <div className={`mt-6 flex items-center justify-center gap-3 rounded-xl border px-4 py-3 ${l.bg} ${l.ring}`}>
          <TrafficLight level={prediction.level} />
          <span className="text-sm text-stone-600">
            ~{fmtG(prediction.predictedWasteG)} estimated leftovers
          </span>
        </div>

        <p className="mt-4 text-xs text-stone-400">
          This visit was just written into the restaurant's live history — flip to the Operator View
          to watch it arrive.
        </p>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <button
            onClick={goToOperator}
            className="rounded-xl bg-brand-600 px-5 py-3 text-sm font-bold text-white shadow-card transition-colors hover:bg-brand-700"
          >
            See it land on the dashboard →
          </button>
          <button
            onClick={startOver}
            className="rounded-xl border border-stone-200 bg-white px-5 py-3 text-sm font-semibold text-stone-600 transition-colors hover:border-brand-300 hover:text-brand-700"
          >
            Start a new table
          </button>
        </div>
      </Card>
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
