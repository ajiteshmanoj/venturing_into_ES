# Mottainai — Project Summary

*As of 9 July 2026*

**Right-size every table. Waste less, spend less.**

- **Live demo:** https://mottainai-demo.vercel.app
- **Repository:** https://github.com/ajiteshmanoj/venturing_into_ES
- **Context:** University entrepreneurship Demo Day prototype

---

## 1. The idea

The name: **mottainai (もったいない)** is the Japanese concept of regret over
waste — literally "what a waste." Popularised globally as an environmental
rallying cry (Wangari Maathai adopted it for the UN's Mottainai Campaign),
it captures the product's mission in one word.

Mottainai is a food-waste-reduction ordering system for shared / family-style
restaurants (zi char). Tables routinely over-order — "one more dish for the
table" — and the surplus goes to the bin. Mottainai sits inside the
restaurant's QR-ordering flow and uses the restaurant's **own historical waste
data** to predict, at order time, how much of the food will go uneaten — then
gives the table **one-tap ways to act on it** (smaller portions, fewer dishes,
staged serving, tapau), and **verifies the outcome** after the meal.

The core design principle comes straight from the research: **information
alone does not reduce waste — letting people act does.** Every screen is
built around that.

The demo arc: **predict → act → verify.**

## 2. Features

### Diner View — predict

| Feature | What it does |
|---|---|
| **Party-size guidance** | 1–8+ entry with a "tables your size finish ~N dishes" hint |
| **Photo menu with finish-rate chips** | 12 zi char dishes; "✓ Usually finished" / "△ Often left over" chips driven by per-dish waste propensity |
| **Live Order Checker** | Gentle nudges for over-ordering, carb-pairing, and under-ordering — never blocks |
| **Appetite-aware waste prediction** | Animated gauge + traffic light; waste scales with the whole order vs. the table's appetite, and "often left over" dishes carry a higher floor even within appetite |
| **"Why this estimate?"** | Always-available transparency panel listing every input — no black box |

### Diner View — act

| Feature | What it does |
|---|---|
| **Portion choices** | Half / Regular / Sharing per dish — predicted waste *and* price update live |
| **✨ Right-size it for me** | One tap halves the largest portions until the prediction turns green |
| **🥡 Tapau toggle** | Packed leftovers credited as meals (65% recovery), not waste |
| **🍽 Smart serve (incremental ordering)** | Over-appetite orders are staged: round 1 fires now, the excess goes on hold; a mid-meal **"Still hungry?"** check-in fires or skips each held dish — skipped dishes are never cooked and never billed |
| **Green receipt** | Real bill anatomy (10% service, 9% GST) plus a savings strip: grams avoided, S$ off the bill, eco-points |

### Diner View — verify

| Feature | What it does |
|---|---|
| **📸 Table check-out** | Before/after verification of the meal; measured-vs-predicted reveal ("beat the estimate by 68 g") |
| **Rewards for beating the prediction** | Points on the beat (fair target for every table), split across every party member; government-voucher card (illustrative) |
| **📉 Your waste trend** | The diner's personal leftover history across check-outs, with today's measured result appended and highlighted |
| **Model re-learning** | The measured result overwrites the prediction in shared history — the model learns from reality |

### Operator View — the business case

| Feature | What it does |
|---|---|
| **Header stats** | Food waste (kg, 4 weeks), waste rate vs. baseline (−28%), cost saved (S$), meals'-worth saved |
| **Waste-trend chart** | Weekly waste rate with pilot-start marker and dashed pre-pilot baseline |
| **Waste by party size** | Shows mid-size groups (3–5) over-order most |
| **ROI card** | S$99/mo subscription vs. modelled savings → "pays for itself in N days" |
| **Dish waste leaderboard** | Chronically unfinished dishes, each with a menu-engineering action |
| **Sustainability & compliance** | CO₂e avoided + Singapore Resource Sustainability Act reporting hook |
| **Peer benchmark** | This outlet vs. simulated peers — the data-network moat |
| **Live table feed** | Confirmed diner orders appear instantly; checked-out visits carry a "✓ Checked-out" tag |
| **Honest measurement card** | Real deployments weigh per service; table/dish figures are attributed estimates |

### System

| Feature | What it does |
|---|---|
| **Closed learning loop** | One in-memory history feeds diner predictions, operator dashboard, and derived stats — a confirmed order updates all three live |
| **Transparent rule-based engine** | Every prediction decomposable in the UI; no fake AI (see §5) |
| **Deterministic demo** | Fixed RNG seed, presenter-controlled outcomes, 🎬 scenario loader, ↺ reset — every run identical on stage |

## 3. Research grounding (what the numbers are calibrated to)

All data in the demo is simulated, but deliberately calibrated to published
reference points so it is defensible on stage:

| Reference | Value | Use in demo |
|---|---|---|
| NEA (Singapore) / UNEP Food Waste Index | Food service ≈ 28% of food waste | Framing, honesty badge |
| Straits Times (2025) | Up to ~50% of buffet/prepared food wasted in high-waste settings | Cap on worst-case simulated waste rates |
| Campus portion study | Plate waste cut ~66% | Envelope for pilot improvement |
| Reduced-size entrée study | 77 g → 45 g waste per plate, no satisfaction loss | Portion-lever justification |
| Other portion interventions | 12–34% reductions | Envelope for pilot improvement |
| Portion weights | Fried rice ~300–400 g, zi char dish ~200–350 g, whole fish ~400–600 g, soup ~500 ml+ | Menu data (labelled common-sense anchors) |
| Appetite anchor | ~420 g/person per sitting | Appetite-aware prediction (labelled common-sense anchor) |

## 4. Feature detail — two connected views

### Diner View (the QR-ordering experience)

Framed as the ordering flow of a fictional restaurant — **"Golden Wok Zi Char
金锅小炒 · Table 12 · Powered by Mottainai."**

1. **Party-size entry** (1–8+) with a "tables your size finish ~N dishes" hint.
2. **Photo menu** — 12 zi char dishes with real photography (Wikimedia
   Commons, credited in `public/dishes/CREDITS.md`), prices, "feeds ~X"
   hints, and **finish-rate chips** ("✓ Usually finished" / "△ Often left
   over") driven by per-dish waste propensity.
3. **Live Order Checker** — gentle nudges, never blocks:
   - over-ordering ("that's 5 dishes for 3 people — most tables your size finish 3");
   - carb-pairing ("two rice/noodle dishes are what come back unfinished");
   - under-ordering ("may be on the light side — you'll likely finish everything").
4. **Appetite-aware waste prediction** — animated gauge + traffic light
   (Low / Medium / High). Waste scales with the **whole order vs. the table's
   appetite** (~420 g/person): orders within appetite predict only the
   floor — scraps (~3%) plus a mix-scaled residual for often-left-over
   dishes, so a fried-rice order shows ~10% while har cheong gai shows ~3%
   (the "△ Often left over" chip and the gauge always agree); historical
   waste behaviour ramps in only as the order exceeds what the table can eat.
5. **"Why this estimate?"** — always-available transparency panel showing
   every input: party size, dishes-per-person, appetite coverage, historical
   match (N similar past visits), dish-mix adjustment. No black box.
6. **Action levers:**
   - **Half / Regular / Sharing portions** per dish — updates predicted waste
     *and* price live (Sharing hidden for solo diners);
   - **✨ Right-size it for me** — one tap that halves the largest portions
     until the prediction turns green;
   - **🥡 Tapau toggle** — packed leftovers credited as meals (65% recovery),
     not waste;
   - **🍽 Smart serve (incremental ordering)** — when the order exceeds the
     table's appetite, the engine proposes a staged split: fire a round 1
     that still feeds everyone, hold the excess (highest bin-contribution
     dishes). Near the end of the meal a **"Still hungry?"** check-in fires
     or skips each held dish — skipped dishes are never cooked and never
     billed, so the waste is avoided in the kitchen, before it can reach a
     plate. The visit history is updated to what was actually served.
7. **Green receipt** — real bill anatomy (subtotal, 10% service charge, 9%
   GST), waste footprint, and a savings strip: grams avoided, S$ off the
   bill, eco-points.
8. **📸 Table check-out (the verification loop + rewards):**
   - "Before" strip of the ordered dishes as served;
   - "After" outcome (demo stand-in: presenter taps Spotless / A few bites /
     Quite a lot left — real deployments score an after-photo automatically
     or weigh at the clearing station);
   - measured-vs-predicted reveal ("Estimated 100 g → measured 32 g — you
     beat the estimate by 68 g");
   - **points for beating the prediction** (not absolute waste — fair target
     for every table), split across every party member's account;
   - government-programme card modelled on Healthy 365 / CDC vouchers,
     labelled an illustrative fictional partnership;
   - **📉 "Your waste trend"** — the diner's personal history (per-person
     measured leftovers across past check-outs, simulated) with today's
     result appended and highlighted, mirroring the operator's trend chart
     at the individual-account level;
   - the measured result **overwrites the prediction in shared history**, so
     the model re-learns from reality.

### Operator View (the business case)

- **Header stats:** food waste (kg, last 4 weeks), waste rate vs. baseline
  (−28%), estimated cost saved (S$), meals'-worth saved.
- **Waste-trend chart** (recharts) with pilot-start marker and dashed
  pre-pilot baseline.
- **Waste by party size** — shows mid-size groups (3–5) over-order most.
- **ROI card** — S$99/mo subscription vs. modelled savings → "pays for
  itself in N days," ~3–4× monthly return.
- **Dish waste leaderboard** — which dishes chronically come back
  unfinished, with a menu-engineering action per dish.
- **Sustainability & compliance card** — CO₂e avoided (≈2.5 kg CO₂e per kg
  food waste, car-km equivalence) + the Singapore Resource Sustainability
  Act reporting hook ("why now").
- **Peer benchmark** — this outlet vs. simulated peer restaurants (the
  data-network moat, labelled simulated).
- **Learning-loop visual** — data in → model updates → better nudges → less
  waste.
- **Live table feed** — a confirmed diner order appears here instantly;
  checked-out visits carry a "✓ Checked-out" verified tag.
- **Honest measurement card** — real deployments weigh waste **per service**
  at the clearing station, not per plate; all table/dish-level figures are
  attributed estimates.

## 5. The recommendation engine (transparent, rule-based — no fake AI)

All logic lives in `src/engine/recommend.js`, commented for judge questions:

1. **Historical lookup** — bucket the table's dishes-per-person ratio, look
   up the average waste rate of same-size tables in that bucket (blended
   toward a calibrated base curve when the sample is thin, n < 6).
2. **Dish-mix adjustment** — weight-averaged per-dish waste propensity
   (bulk carbs/soup ≈ 1.2–1.3×, premium protein ≈ 0.7–0.9×).
3. **Appetite scaling** — behavioural waste applies only to food beyond the
   table's appetite (~420 g/person); ramps in between 75% and 105% of
   appetite; below that, the mix-aware floor applies: scraps (~3%) plus
   ~0.3 × (mix − 1) residual for often-left-over dishes (max ~12%).
4. **Tapau credit** — 65% of predicted leftovers recovered as meals.
5. **Recommendation** — smallest dish count that feeds the party (servings
   constraint) while sitting in the historically lowest-waste bucket.
6. **Smart-serve split** — when the whole-order prediction isn't green,
   deterministically move the dishes with the largest expected bin
   contribution (grams × waste propensity) to a held round 2, stopping once
   round 1 turns green; round 1 must always still feed the party on its own.
7. **Check-out points** — participation credit + (predicted − measured)/10 g,
   split evenly across the party; no penalty for missing (punishment would
   kill check-out participation, and the check-out data is what the operator
   pays for).

**The closed loop:** one in-memory visit history feeds the diner predictions,
the operator dashboard, *and* the derived stats — a confirmed order updates
all three live; a check-out replaces the prediction with the measured result.

## 6. Seed data

`src/data/seedData.js` — fully documented at the top of the file:

- 12-dish menu with prices (SGD), portion weights, typical servings,
  portionability, per-dish waste propensity, Chinese names, photo mapping.
- ~200 simulated past visits over 12 weeks: weeks 1–6 pre-pilot baseline
  (mean ~1.35 dishes/person, mid-size groups biased higher), weeks 7–12
  pilot (drifting to ~1.05), waste generated by the same
  ratio × mix × appetite rules the engine uses, with Gaussian noise.
- Fixed RNG seed (mulberry32) → **every demo run is identical**.
- Derived stats: average waste rate by (party-size band × dishes-per-person
  bucket), recomputed live from history.
- The demo diner's personal check-out history (per-person leftovers,
  trending down) powering "Your waste trend."
- Simulated peer benchmarks and CO₂e conversion constants.

## 7. Honesty framing (credibility by design)

- Footer badge on both views: "Demo runs on **simulated data** modelled on
  published food-waste research."
- Measurement card: per-service weighing, not per-plate; table/dish figures
  are attributed estimates.
- Government rewards programme labelled "illustrative / fictional
  partnership."
- Peer benchmarks labelled simulated.
- Portion weights and appetite labelled common-sense anchors.
- No number presented as a measured real-world result.

## 8. Demo aids

- **🎬 Load over-order scenario** — pre-fills a table of 3 with 5 large
  dishes → red 47% prediction; **✨ Right-size** flips it green live. The
  signature moment.
- Presenter-controlled check-out outcome → deterministic points reveal.
- **↺ Reset** — returns everything to the seeded state between runs.
- Onboarding hints on both views; empty states; reduced-motion support.

## 9. Tech

| Layer | Choice |
|---|---|
| Framework | React 18 + Vite 6, single-page app |
| Styling | Tailwind CSS v4 (custom teal/sage + warm-neutral tokens) |
| Type | Fraunces Variable (display) + Inter Variable (UI), self-hosted |
| Charts | recharts (series colors validated for CVD safety + contrast) |
| State | React state only — no backend, no localStorage (by design) |
| Assets | Dish photos committed to `public/dishes/` (CC0/CC-BY/CC-BY-SA, credited) |
| Hosting | Vercel — auto-deploys `main` on every push |

```
src/
  App.jsx                    # shell, view toggle, shared visit history, reset
  data/seedData.js           # menu, visits, stats, calibration (documented)
  engine/recommend.js        # all prediction/nudge/points rules (commented)
  components/
    DinerView.jsx            # order flow, prediction, receipt, check-out
    OperatorView.jsx         # dashboard, charts, business-case cards
    ui.jsx                   # shared primitives (cards, traffic light, badge)
public/dishes/               # photography + CREDITS.md
```

**Run locally:** `npm install && npm run dev`

## 10. The 2-minute demo script

1. Diner View → **🎬 Load over-order scenario** — table of 3, 5 dishes,
   gauge red (~47%).
2. Open **"Why this estimate?"** — show the transparent inputs.
3. **✨ Right-size it for me** — flips green, bill drops S$76 → S$49.
4. Toggle **🥡 tapau** — estimate drops further (second lever).
5. **Send order** → green receipt (service charge, GST, savings, eco-points).
6. **📸 Table check-out** → tap "Spotless" → "beat the estimate by 68 g,"
   +12 pts split across the party, government-voucher card, and the diner's
   personal **📉 waste trend** with today highlighted.
7. **See it verified on the dashboard** → the visit lands "✓ Checked-out"
   with the measured number; every stat updates.
8. Walk the business case: ROI, dish leaderboard, CO₂e/NEA, peer benchmark.
9. **↺ Reset** for the next run.

Alternative arc (incremental ordering): at step 3, toggle **🍽 Smart serve**
instead — 3 dishes fire now, 2 go on hold (estimate flips green, bill drops to
round 1 only). After sending, tap **Mid-meal check-in — still hungry?** and
skip the held dishes: "2 plates never cooked — 780 g out of the bin, S$25 off
the bill." Then check out as usual.

## 11. Roadmap (mention, don't build)

- **Kitchen prep-planning forecasts** — pre-consumer waste is the larger
  cost pool; the same visit history predicts tomorrow's demand per dish.
- **Real measurement integrations** — clearing-station scales / smart-bin
  sensors / vision-scored after-photos replacing the demo stand-in.
- **Party composition** (kids/elderly) refining the appetite model.
- **Real photography and a real rewards partner** for any commercial pilot.
