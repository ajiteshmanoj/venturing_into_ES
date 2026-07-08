# MakanSense 🥢

**Right-size every table. Waste less, spend less.**

Interactive Demo Day prototype of a food-waste-reduction ordering system for
shared / family-style restaurants (zi char). Two connected views in one
session: a **Diner** QR-ordering flow (framed as fictional "Golden Wok Zi
Char", Table 12) with live waste prediction, and an **Operator** dashboard
that proves the business case — wired to the same in-memory history, so a
confirmed order lands on the dashboard live.

**Live demo:** https://entrepreneurshipmod.vercel.app

## Run it locally

```bash
npm install
npm run dev
```

Open http://localhost:5173 (Vite prints the exact URL).

## The 2-minute demo script

1. **Diner View** → tap **🎬 Load over-order scenario** — a table of 3 with
   5 large dishes. The gauge goes **red**: ~760 g headed for the bin (47%).
2. Open **"Why this estimate?"** — every input is visible: party size,
   dishes-per-person, the past visits behind the rate, and the dish-mix
   adjustment. No black box.
3. Tap **✨ Right-size it for me** — portions flip to Half, the gauge animates
   down, the light flips **green**, and the bill drops S$76 → S$49.
   *Acting* beats warning — the research point, made tangible.
4. Toggle **🥡 tapau** — packed leftovers are meals, not waste; the estimate
   drops further. Second action lever.
5. **Send order to kitchen** → the **green receipt**: real bill anatomy
   (service charge + GST), waste footprint, grams + dollars saved, eco-points.
6. **"See it land on the dashboard"** — the visit tops the Operator View's
   live feed and nudges every stat: the learning loop, closed on stage.
7. Operator View business case: **ROI card** (pays for itself in days),
   **dish waste leaderboard** (menu engineering), **CO₂e + NEA regulatory
   hook**, **peer benchmark** (the data-network moat).
8. **↺ Reset** (header) returns everything to the seeded state.

## Where things live

| Path | What it is |
|---|---|
| `src/data/seedData.js` | Menu (with per-dish waste propensity), ~200 simulated visits, derived stats, peer benchmarks. Top-of-file comment documents the research calibration (NEA/UNEP ~28% food-service share, ~50% buffet waste ceiling, 12–66% portion-intervention reductions). |
| `src/engine/recommend.js` | The transparent rule-based engine — ratio bucketing, historical lookup, dish-mix adjustment, pairing nudges, tapau credit, right-sizing savings. Commented for judge questions. |
| `src/components/DinerView.jsx` | Restaurant framing → party size → photo menu with finish-rate chips → live checker → animated waste gauge → portions + tapau → green receipt. |
| `src/components/OperatorView.jsx` | Header stats, trend + party-size charts (recharts), ROI / benchmark / CO₂e cards, learning-loop visual, dish leaderboard, live feed, honest measurement card. |
| `src/components/ui.jsx` | Shared primitives (cards, traffic light, honesty badge). |
| `public/dishes/` | Dish photography (Wikimedia Commons, licensed — see `CREDITS.md`). |

## Honesty framing

Every number is **simulated, calibrated to published research** — the footer
badge on both views says so, the seed file documents the sources, and the
dashboard's measurement card states plainly that real deployments weigh waste
**per service** at the clearing station, not per plate. Peer benchmarks are
simulated reference points, labelled as such.

No backend, no storage — everything is React state, by design. Deploys
automatically to Vercel on push to `main`.
