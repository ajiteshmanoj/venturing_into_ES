# MakanSense 🥢

**Right-size every table. Waste less, spend less.**

Interactive Demo Day prototype of a food-waste-reduction ordering system for
shared / family-style restaurants (zi char). Two connected views in one
session: a **Diner** ordering flow with live waste prediction, and an
**Operator** dashboard that proves the business case — wired to the same
in-memory history, so a confirmed order lands on the dashboard live.

*(The brief called it "RightPortion" — MakanSense is the suggested better
name: "makan" = to eat in Singlish, and the system makes sense of ordering.)*

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:5173 (Vite prints the exact URL).

## The 90-second demo script

1. **Diner View** → tap **🎬 Load over-order scenario** — a table of 3 with
   5 large dishes. The prediction goes **red**: ~660 g of food headed for the
   bin (41%).
2. Open **"Why this estimate?"** — every input is visible: party size,
   dishes-per-person ratio, and the past visits the rate comes from. No black
   box.
3. Tap **✨ Right-size it for me** — portions flip to Half, the meter animates
   down to ~120 g (12%), the light flips **green**, and the bill drops
   S$76 → S$49. *Acting* beats warning — the research point, made tangible.
4. **Confirm order**, then **"See it land on the dashboard"** — the visit
   appears at the top of the Operator View's live feed and nudges every stat.
   That's the learning loop, closed on stage.
5. **↺ Demo Day Reset** (header) returns everything to the seeded state for
   the next run.

## Where things live

| Path | What it is |
|---|---|
| `src/data/seedData.js` | Menu, ~200 simulated visits, derived waste stats. Top-of-file comment documents the research calibration (NEA/UNEP ~28% food-service share, ~50% buffet waste ceiling, 12–66% portion-intervention reductions). |
| `src/engine/recommend.js` | The transparent rule-based engine — ratio bucketing, historical lookup, prediction, nudges. Commented for judge questions. |
| `src/components/DinerView.jsx` | Party size → menu & ordering → live checker → prediction → portions → confirmation. |
| `src/components/OperatorView.jsx` | Header stats, waste-trend + party-size charts (recharts), learning-loop visual, live feed, honest "how waste is measured" card. |
| `src/components/ui.jsx` | Shared primitives (cards, traffic light, honesty badge). |

## Honesty framing

Every number is **simulated, calibrated to published research** — the footer
badge on both views says so, the seed file documents the sources, and the
dashboard's measurement card states plainly that real deployments weigh waste
**per service** at the clearing station, not per plate.

No backend, no storage — everything is React state, by design.
