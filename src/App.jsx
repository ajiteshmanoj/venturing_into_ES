import { useMemo, useState } from 'react'
import { SEED_VISITS, computeWasteStats } from './data/seedData.js'
import { SimulatedDataBadge } from './components/ui.jsx'
import DinerView from './components/DinerView.jsx'
import OperatorView from './components/OperatorView.jsx'

/*
 * Mottainai — right-size every table.
 * (もったいない — the Japanese concept of regret over waste: "what a waste".)
 *
 * All state lives in React memory — no backend, no localStorage. Confirmed
 * diner orders are appended to `visits`, and because the operator dashboard
 * AND the recommendation stats both derive from `visits`, one confirmed
 * order visibly updates the whole system: the closed loop, live on stage.
 *
 * The diner flow is framed as the QR-ordering experience of a fictional
 * zi char restaurant ("Golden Wok Zi Char", Table 12) powered by Mottainai.
 */
export default function App() {
  const [view, setView] = useState('diner')
  const [visits, setVisits] = useState(SEED_VISITS)
  const [resetKey, setResetKey] = useState(0)

  // The model: recomputed whenever history changes (this IS the learning loop)
  const stats = useMemo(() => computeWasteStats(visits), [visits])

  const addVisit = (visit) => setVisits((v) => [...v, visit])

  // Table check-out: replace the predicted waste with the measured outcome —
  // the model then re-learns from reality, not from its own guess.
  const updateVisit = (id, patch) =>
    setVisits((v) => v.map((visit) => (visit.id === id ? { ...visit, ...patch } : visit)))

  // Demo Day Reset — wipe live orders back to the seeded state for a clean re-run
  const resetDemo = () => {
    setVisits(SEED_VISITS)
    setResetKey((k) => k + 1)
    setView('diner')
  }

  return (
    <div className="min-h-screen bg-cream text-stone-900">
      <header className="sticky top-0 z-20 border-b border-stone-900/5 bg-cream/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-5 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-xl text-white shadow-card" aria-hidden>
              🥢
            </div>
            <div>
              <h1 className="font-display text-xl font-semibold tracking-tight">
                Mottainai <span className="ml-1 text-sm font-normal text-stone-400">もったいない</span>
              </h1>
              <p className="hidden text-[11px] tracking-wide text-stone-500 sm:block">
                "WHAT A WASTE" · RIGHT-SIZE EVERY TABLE, WASTE LESS, SPEND LESS
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex rounded-full border border-stone-200 bg-white p-1 shadow-card" role="tablist" aria-label="View switcher">
              {[
                { id: 'diner', label: '🍽 Diner' },
                { id: 'operator', label: '📊 Operator' },
              ].map((t) => (
                <button
                  key={t.id}
                  role="tab"
                  aria-selected={view === t.id}
                  onClick={() => setView(t.id)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                    view === t.id
                      ? 'bg-brand-600 text-white shadow-card'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <button
              onClick={resetDemo}
              title="Reset the demo to its seeded state"
              className="rounded-full border border-stone-200 bg-white px-3.5 py-2 text-xs font-medium text-stone-500 shadow-card transition-colors hover:border-brand-300 hover:text-brand-700"
            >
              ↺ Reset
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-8">
        {view === 'diner' ? (
          <DinerView key={resetKey} stats={stats} addVisit={addVisit} updateVisit={updateVisit} goToOperator={() => setView('operator')} />
        ) : (
          <OperatorView visits={visits} />
        )}
      </main>

      <footer className="mx-auto max-w-6xl px-5 pb-10 text-center">
        <SimulatedDataBadge />
      </footer>
    </div>
  )
}
