/*
 * ============================================================================
 * SIMULATED SEED DATA — NOT MEASURED REAL-WORLD RESULTS.
 *
 * Every number in this file is generated, but the generator is CALIBRATED to
 * published food-waste research so the demo is defensible:
 *
 *  - Food service accounts for ~28% of food waste (Singapore NEA; UNEP Food
 *    Waste Index lands on the same ~28% for food service globally).
 *  - Up to ~50% of buffet/prepared food can be wasted in high-waste settings
 *    (Straits Times, 2025). Our worst over-ordering tables are capped so
 *    their waste rate lands in that ~45–55% range, never above it.
 *  - Portion/right-sizing interventions cut plate waste substantially with no
 *    loss of diner satisfaction: a campus study cut plate waste ~66%;
 *    reduced-size entrées dropped waste 77g → 45g per plate; other studies
 *    report 12–34% reductions. The pilot-period improvement modelled below
 *    (~30–40% waste-rate reduction) sits inside that published envelope.
 *  - Key design principle from the research: information alone does NOT
 *    reduce waste — giving diners a one-tap ACTION (smaller portion, fewer
 *    dishes, tapau) is what works. The whole UI is built around that.
 *
 * Portion weights are common-sense anchors, not a measured dataset:
 * fried rice ~300–400g, shared zi char dish ~200–350g, steamed fish
 * ~400–600g, soup ~500ml+.
 *
 * Waste-rate rule baked into the generator: a table ordering ~1 dish per
 * person wastes little (~5–10%); waste climbs roughly linearly as
 * dishes-per-person exceeds ~1, capped near the ~50% buffet figure.
 * A per-dish "waste propensity" models the familiar pattern that bulk carbs
 * and soups come back unfinished more often than premium proteins.
 * Gaussian noise is added so the data looks organic, and a fixed RNG seed
 * keeps every demo run identical.
 * ============================================================================
 */

// ---------------------------------------------------------------------------
// Menu — 12 shared zi char dishes.
// portionWeightG uses the anchors above; typicalServings = people one regular
// portion feeds; portionable = kitchen offers Half / Sharing sizes;
// wastePropensity = how often this dish comes back unfinished relative to the
// table average (1.0 = average; >1 chronically left over; <1 usually finished).
// Photos: Wikimedia Commons, see public/dishes/CREDITS.md.
// ---------------------------------------------------------------------------
export const MENU = [
  { id: 'fried-rice',   name: 'Yangzhou Fried Rice',   nameZh: '扬州炒饭', category: 'rice/noodle', price: 12, portionWeightG: 380, typicalServings: 2, portionable: true,  wastePropensity: 1.25, emoji: '🍚' },
  { id: 'hor-fun',      name: 'Beef Hor Fun',          nameZh: '干炒牛河', category: 'rice/noodle', price: 13, portionWeightG: 400, typicalServings: 2, portionable: true,  wastePropensity: 1.2,  emoji: '🍜' },
  { id: 'ss-pork',      name: 'Sweet & Sour Pork',     nameZh: '咕噜肉',   category: 'meat',        price: 15, portionWeightG: 300, typicalServings: 3, portionable: true,  wastePropensity: 0.95, emoji: '🍖' },
  { id: 'kungpao',      name: 'Kung Pao Chicken',      nameZh: '宫保鸡丁', category: 'meat',        price: 14, portionWeightG: 290, typicalServings: 3, portionable: true,  wastePropensity: 0.9,  emoji: '🌶️' },
  { id: 'hcg-chicken',  name: 'Har Cheong Gai',        nameZh: '虾酱鸡',   category: 'meat',        price: 15, portionWeightG: 280, typicalServings: 3, portionable: true,  wastePropensity: 0.8,  emoji: '🍗' },
  { id: 'kailan',       name: 'Stir-fried Kailan',     nameZh: '蚝油芥兰', category: 'vegetable',   price: 10, portionWeightG: 250, typicalServings: 3, portionable: true,  wastePropensity: 1.1,  emoji: '🥬' },
  { id: 'sambal-veg',   name: 'Sambal Kangkong',       nameZh: '马来风光', category: 'vegetable',   price: 11, portionWeightG: 260, typicalServings: 3, portionable: true,  wastePropensity: 1.05, emoji: '🥗' },
  { id: 'se-prawns',    name: 'Salted Egg Prawns',     nameZh: '咸蛋虾',   category: 'seafood',     price: 22, portionWeightG: 260, typicalServings: 3, portionable: true,  wastePropensity: 0.7,  emoji: '🍤' },
  { id: 'steam-fish',   name: 'Steamed Whole Seabass', nameZh: '清蒸鲈鱼', category: 'seafood',     price: 28, portionWeightG: 520, typicalServings: 4, portionable: false, wastePropensity: 0.9,  emoji: '🐟' },
  { id: 'mapo',         name: 'Mapo Tofu',             nameZh: '麻婆豆腐', category: 'tofu',        price: 10, portionWeightG: 320, typicalServings: 3, portionable: true,  wastePropensity: 1.05, emoji: '🥘' },
  { id: 'claypot-tofu', name: 'Claypot Tofu',          nameZh: '砂锅豆腐', category: 'tofu',        price: 13, portionWeightG: 350, typicalServings: 3, portionable: true,  wastePropensity: 1.0,  emoji: '🍲' },
  { id: 'tomyum',       name: 'Tom Yum Soup',          nameZh: '冬炎汤',   category: 'soup',        price: 12, portionWeightG: 550, typicalServings: 4, portionable: true,  wastePropensity: 1.3,  emoji: '🍵' },
]

export const MENU_BY_ID = Object.fromEntries(MENU.map((d) => [d.id, d]))

export const dishPhoto = (id) => `/dishes/${id}.jpg`

/* Finish-rate chip shown on dish cards — derived from wastePropensity so the
 * card claim and the engine's math can never disagree. */
export function finishChip(dish) {
  if (dish.wastePropensity <= 0.9) return { tone: 'good', label: 'Usually finished' }
  if (dish.wastePropensity >= 1.15) return { tone: 'warn', label: 'Often left over' }
  return null
}

// Portion sizes a diner can act on — choosing Half reduces BOTH the weight on
// the table and the bill. dishFactor is how much of "one dish" it counts as
// when computing the dishes-per-person ratio.
export const PORTIONS = {
  half:    { label: 'Half',    weightFactor: 0.6, priceFactor: 0.65, dishFactor: 0.6 },
  regular: { label: 'Regular', weightFactor: 1.0, priceFactor: 1.0,  dishFactor: 1.0 },
  sharing: { label: 'Sharing', weightFactor: 1.4, priceFactor: 1.3,  dishFactor: 1.4 },
}

// Bill realism: standard Singapore restaurant service charge + GST
export const SERVICE_CHARGE = 0.1
export const GST = 0.09

// When a table opts to tapau (pack leftovers to go), most of the predicted
// leftover leaves as a meal instead of waste. We model 65% recovered —
// conservative, since soups and dressed vegetables don't travel well.
export const TAPAU_RECOVERY = 0.65

// -------------------------------------------------------------------------
// APPETITE MODEL (common-sense anchors, labelled as such).
// A typical adult eats ~420 g of shared food in a zi char sitting. Waste
// behaviour only kicks in once the order EXCEEDS the table's appetite:
// under-ordered tables finish everything (only unavoidable scraps — bones,
// shells, sauce — remain, ~3% of weight). The ramp below transitions from
// "scraps only" (order ≤ ~75% of appetite) to the full historical waste
// rate (order ≥ ~105% of appetite). Used by BOTH the seed-data generator
// and the live prediction engine so they can never disagree.
// -------------------------------------------------------------------------
export const APPETITE_G_PER_PERSON = 420
export const SCRAP_RATE = 0.03

export function appetiteCoverage(totalWeightG, partySize) {
  const capacityG = partySize * APPETITE_G_PER_PERSON
  return { capacityG, coverage: capacityG ? totalWeightG / capacityG : 0 }
}

/* 0 = order well within appetite (scraps only) → 1 = full waste behaviour */
export function coverageRamp(totalWeightG, partySize) {
  const { coverage } = appetiteCoverage(totalWeightG, partySize)
  return Math.min(1, Math.max(0, (coverage - 0.75) / 0.3))
}

// ---------------------------------------------------------------------------
// Deterministic RNG (mulberry32) — fixed seed so the demo is identical
// on every run in front of the judges.
// ---------------------------------------------------------------------------
function mulberry32(seed) {
  let a = seed
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rand = mulberry32(20260708)

// Approximate a normal(0,1) sample from the uniform RNG (sum of uniforms).
function gauss() {
  return (rand() + rand() + rand() + rand() - 2) / 1 * 0.85
}

const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x))

/*
 * CORE WASTE-RATE MODEL (this is the calibration point).
 * ratio = dishes-per-person. At ratio ≤ ~0.9 the table finishes nearly
 * everything (~7% loss — bones, sauce, stray rice). Above ~0.9 the waste
 * rate climbs ~4.5 percentage points per 0.1 extra ratio, capped at 52%
 * so extreme over-ordering lands on the published ~50% buffet figure.
 */
export function baseWasteRate(ratio) {
  if (ratio <= 0.9) return 0.07
  return clamp(0.07 + 0.45 * (ratio - 0.9), 0.07, 0.52)
}

/* Dish-mix factor: weight-weighted average waste propensity of an order.
 * A carb-and-soup-heavy order wastes more at the same ratio; a premium-
 * protein order wastes less. Used by BOTH the generator and the engine. */
export function mixFactor(dishWeights) {
  // dishWeights: [{ weightG, propensity }]
  const total = dishWeights.reduce((s, d) => s + d.weightG, 0)
  if (!total) return 1
  return dishWeights.reduce((s, d) => s + d.weightG * d.propensity, 0) / total
}

// ---------------------------------------------------------------------------
// ~200 past table visits over 12 weeks.
// Weeks 1–6 = pre-pilot baseline (tables over-order freely).
// Weeks 7–12 = Mottainai pilot: ordering behaviour gradually right-sizes,
// so dishes-per-person drifts toward ~1 and waste trends down — matching the
// 12–34%+ reductions reported for portion interventions.
// ---------------------------------------------------------------------------
const WEEKS = 12
const VISITS_TOTAL = 200
const TODAY = new Date(2026, 6, 8) // fixed "today" so dates are stable

function pickPartySize() {
  // Zi char skews to groups of 2–5
  const r = rand()
  if (r < 0.08) return 1
  if (r < 0.28) return 2
  if (r < 0.50) return 3
  if (r < 0.72) return 4
  if (r < 0.86) return 5
  if (r < 0.94) return 6
  if (r < 0.98) return 7
  return 8
}

function pickDishes(count) {
  // Sample without replacement first; allow repeats (second fried rice) after
  const pool = [...MENU.map((d) => d.id)]
  const chosen = []
  for (let i = 0; i < count; i++) {
    if (pool.length > 0 && (i < MENU.length)) {
      const idx = Math.floor(rand() * pool.length)
      chosen.push(pool.splice(idx, 1)[0])
    } else {
      chosen.push(MENU[Math.floor(rand() * MENU.length)].id)
    }
  }
  return chosen
}

function generateVisits() {
  const visits = []
  for (let i = 0; i < VISITS_TOTAL; i++) {
    const week = Math.floor((i / VISITS_TOTAL) * WEEKS) // ~17 visits/week
    const dayOffset = (WEEKS - week) * 7 - Math.floor(rand() * 7) - 1
    const date = new Date(TODAY)
    date.setDate(date.getDate() - dayOffset)

    const partySize = pickPartySize()

    // Ordering behaviour: mean dishes-per-person starts at ~1.35 pre-pilot
    // and eases to ~1.05 by the final pilot week (right-sizing taking hold).
    // Party-size effect (observed pattern in shared-dining settings): mid-size
    // groups (3–5) over-order most — "one more dish for the table" bias;
    // couples order close to appetite, big groups pool portions efficiently.
    const pilotProgress = week < 6 ? 0 : (week - 5) / 7
    const sizeBias =
      partySize >= 3 && partySize <= 5 ? 0.14 : partySize <= 2 ? -0.1 : -0.18
    const meanRatio = 1.35 + sizeBias - 0.3 * pilotProgress
    const ratio = clamp(meanRatio + gauss() * 0.28, 0.6, 2.4)
    const dishCount = Math.max(1, Math.round(ratio * partySize))

    const dishIds = pickDishes(dishCount)
    const dishWeights = dishIds.map((id) => ({
      weightG: MENU_BY_ID[id].portionWeightG * (0.92 + rand() * 0.16),
      propensity: MENU_BY_ID[id].wastePropensity,
    }))
    const totalWeight = dishWeights.reduce((s, d) => s + d.weightG, 0)

    // Behavioural waste only applies to food beyond the table's appetite —
    // under-ordered tables finish everything bar scraps (see APPETITE MODEL).
    const realizedRatio = dishCount / partySize
    const behaviourRate = baseWasteRate(realizedRatio) * mixFactor(dishWeights)
    const ramp = coverageRamp(totalWeight, partySize)
    const wasteRate = clamp(
      SCRAP_RATE + (behaviourRate - SCRAP_RATE) * ramp + gauss() * 0.045 * Math.max(ramp, 0.3),
      0.01,
      0.55,
    )

    visits.push({
      id: `seed-${i + 1}`,
      date: date.toISOString().slice(0, 10),
      week,
      partySize,
      dishIds,
      dishCount,
      totalFoodWeightG: Math.round(totalWeight),
      wastedWeightG: Math.round(totalWeight * wasteRate),
      source: 'seed',
    })
  }
  return visits.sort((a, b) => (a.date < b.date ? -1 : 1))
}

export const SEED_VISITS = generateVisits()

// ---------------------------------------------------------------------------
// Derived statistics — what the recommendation engine actually reads.
// Average waste rate by (party-size band, dishes-per-person bucket).
// Bands keep sample sizes honest for rarer party sizes (7–8).
// ---------------------------------------------------------------------------
export const RATIO_BUCKETS = [
  { key: 'lean',   label: '≤ 1 dish per person',      max: 1.001 },
  { key: 'right',  label: '1–1.25 dishes per person', max: 1.25 },
  { key: 'plus',   label: '1.25–1.5 dishes per person', max: 1.5 },
  { key: 'over',   label: '1.5–2 dishes per person',  max: 2.0 },
  { key: 'heavy',  label: '2+ dishes per person',     max: Infinity },
]

export function bucketForRatio(ratio) {
  return RATIO_BUCKETS.find((b) => ratio <= b.max)
}

export function partyBand(partySize) {
  if (partySize <= 2) return '1–2'
  if (partySize <= 4) return '3–4'
  if (partySize <= 6) return '5–6'
  return '7–8'
}

/**
 * Build the lookup table the engine uses:
 *   stats[band][bucketKey] = { avgRate, n }
 * Recomputed live from the visit history, so confirmed diner orders feed
 * straight back into the model (the learning loop, for real).
 */
export function computeWasteStats(visits) {
  const acc = {}
  for (const v of visits) {
    const band = partyBand(v.partySize)
    const bucket = bucketForRatio(v.dishCount / v.partySize)
    acc[band] ??= {}
    acc[band][bucket.key] ??= { rateSum: 0, n: 0 }
    acc[band][bucket.key].rateSum += v.wastedWeightG / v.totalFoodWeightG
    acc[band][bucket.key].n += 1
  }
  const stats = {}
  for (const band of Object.keys(acc)) {
    stats[band] = {}
    for (const key of Object.keys(acc[band])) {
      const { rateSum, n } = acc[band][key]
      stats[band][key] = { avgRate: rateSum / n, n }
    }
  }
  return stats
}

// ---------------------------------------------------------------------------
// Peer benchmarks for the operator view — SIMULATED reference points, framed
// as such in the UI. Rates are consistent with the research calibration
// (pre-intervention shared-dining settings cluster in the high-20s–30s%).
// ---------------------------------------------------------------------------
export const PEER_BENCHMARKS = [
  { name: 'High-waste peers (top quartile of waste)', rate: 0.38 },
  { name: 'Median zi char (simulated peer set)', rate: 0.31 },
  { name: 'Best-in-class peers', rate: 0.16 },
]

// CO2e per kg of food waste (lifecycle, incl. production) — commonly used
// planning figure ~2.5 kgCO2e/kg. Car-km equivalence at ~0.17 kgCO2e/km.
export const CO2E_PER_KG_WASTE = 2.5
export const CO2E_PER_CAR_KM = 0.17
