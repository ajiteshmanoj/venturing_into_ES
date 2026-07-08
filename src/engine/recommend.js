/*
 * ============================================================================
 * RECOMMENDATION ENGINE — transparent, rule-based. No fake AI.
 *
 * The whole engine is one idea, applied a few ways:
 *
 *   Compare THIS table's dishes-per-person ratio against the historical
 *   waste rates of similar tables (same party-size band), adjust for the
 *   dish mix (bulk carbs/soup come back unfinished more than premium
 *   protein), and steer the order toward what historically minimised waste
 *   while still feeding everyone.
 *
 * Everything shown in the "Why this estimate?" panel comes straight from
 * the return values here — there is no hidden state.
 * ============================================================================
 */
import {
  MENU_BY_ID,
  PORTIONS,
  TAPAU_RECOVERY,
  baseWasteRate,
  bucketForRatio,
  mixFactor,
  partyBand,
} from '../data/seedData.js'

/**
 * An order is a list of { dishId, portion } line items.
 * A Half portion counts as 0.6 of a dish when computing the ratio, because
 * it puts 60% of the food on the table — that's how choosing a smaller
 * portion directly lowers the predicted waste.
 */
export function orderMetrics(order) {
  let effectiveDishes = 0
  let totalWeightG = 0
  let totalPrice = 0
  let totalServings = 0
  const dishWeights = []
  for (const item of order) {
    const dish = MENU_BY_ID[item.dishId]
    const portion = PORTIONS[item.portion]
    effectiveDishes += portion.dishFactor
    totalWeightG += dish.portionWeightG * portion.weightFactor
    totalPrice += dish.price * portion.priceFactor
    totalServings += dish.typicalServings * portion.weightFactor
    dishWeights.push({
      weightG: dish.portionWeightG * portion.weightFactor,
      propensity: dish.wastePropensity,
    })
  }
  return {
    effectiveDishes,
    totalWeightG,
    totalPrice,
    totalServings,
    // Dish-mix factor: >1 means this mix historically comes back unfinished
    // more than average (e.g. two carbs + soup); <1 means it gets finished.
    mix: mixFactor(dishWeights),
  }
}

/**
 * RULE 1 — look up the waste rate of similar past tables.
 * Bucket this table's ratio, find the average waste rate other tables in the
 * same party-size band recorded in that bucket. If the sample is thin (<6
 * visits) we blend toward the calibrated base curve so one outlier table
 * can't skew a prediction.
 */
export function lookupWasteRate(stats, partySize, ratio) {
  const band = partyBand(partySize)
  const bucket = bucketForRatio(ratio)
  const cell = stats[band]?.[bucket.key]
  const modelRate = baseWasteRate(ratio)
  if (!cell) return { rate: modelRate, n: 0, band, bucket }
  const weight = Math.min(cell.n / 6, 1) // trust history once n ≥ 6
  return {
    rate: cell.avgRate * weight + modelRate * (1 - weight),
    n: cell.n,
    band,
    bucket,
  }
}

/**
 * RULE 2 — predict the waste for the current order, with the full audit
 * trail the "Why this estimate?" panel renders.
 *
 * opts.tapau: the table plans to pack leftovers to go. Packed food is a
 * meal, not waste — we credit back TAPAU_RECOVERY (65%) of the predicted
 * leftovers. Conservative: soups/dressed veg don't travel well.
 */
export function predictWaste(stats, partySize, order, opts = {}) {
  const metrics = orderMetrics(order)
  if (order.length === 0 || !partySize) {
    return {
      ...metrics, ratio: 0, rate: 0, baseRate: 0, level: 'none', n: 0,
      predictedWasteG: 0, plateLeftoverG: 0, tapauSavedG: 0, tapau: false,
    }
  }
  const ratio = metrics.effectiveDishes / partySize
  const { rate: historyRate, n, band, bucket } = lookupWasteRate(stats, partySize, ratio)

  // Dish-mix adjustment, capped at the buffet-waste ceiling used everywhere
  const rate = Math.min(historyRate * metrics.mix, 0.55)
  const plateLeftoverG = Math.round(metrics.totalWeightG * rate)

  // Tapau credit: packed leftovers leave as meals, not bin weight
  const tapauSavedG = opts.tapau ? Math.round(plateLeftoverG * TAPAU_RECOVERY) : 0
  const predictedWasteG = plateLeftoverG - tapauSavedG
  const effectiveRate = metrics.totalWeightG ? predictedWasteG / metrics.totalWeightG : 0

  // Traffic light: thresholds sit on the historical curve — <15% is what
  // right-sized tables achieve, >28% is solidly in over-ordering territory.
  const level = effectiveRate < 0.15 ? 'low' : effectiveRate < 0.28 ? 'medium' : 'high'

  return {
    ...metrics, ratio, rate: effectiveRate, baseRate: historyRate,
    predictedWasteG, plateLeftoverG, tapauSavedG, tapau: !!opts.tapau,
    level, n, band, bucket,
  }
}

/**
 * RULE 3 — the recommendation: how many dishes should this table order?
 * Scan the ratio buckets from leanest up, and pick the smallest dish count
 * that (a) sits in the lowest-waste bucket available and (b) still feeds
 * the party (total typical servings ≥ party size, using the menu's average
 * servings per dish ≈ 2.9).
 */
const AVG_SERVINGS_PER_DISH = 2.9

export function recommendedDishCount(partySize) {
  // Feeding constraint: enough servings for everyone.
  const minToFeed = Math.max(1, Math.ceil(partySize / AVG_SERVINGS_PER_DISH))
  // Historical sweet spot: ~1 dish per person is where waste stays ~7–12%.
  // Never below the feeding floor; +1 dish of headroom for tables of 5+.
  const sweetSpot = Math.max(minToFeed, Math.round(partySize * 1.0))
  return { min: minToFeed, ideal: sweetSpot, max: sweetSpot + 1 }
}

/**
 * Live Order Checker — a gentle nudge when the order drifts, never a block.
 * Two independent rules, highest severity wins:
 *   (a) ratio rule — too many dishes for the party size
 *   (b) pairing rule — two+ bulk-carb dishes for a small table is the classic
 *       over-order (both chronically come back half-finished)
 * Returns null when the order looks right-sized.
 */
export function nudgeFor(stats, partySize, order) {
  if (!partySize || order.length === 0) return null
  const { effectiveDishes } = orderMetrics(order)
  const ratio = effectiveDishes / partySize
  const rec = recommendedDishCount(partySize)
  const { n } = lookupWasteRate(stats, partySize, ratio)
  const evidence = n >= 6 ? ` — based on ${n} similar tables` : ''

  if (ratio > 1.6) {
    return {
      tone: 'high',
      text: `That's ${effectiveDishes.toFixed(1).replace(/\.0$/, '')} dishes for ${partySize} ${partySize === 1 ? 'person' : 'people'}. Most tables your size finish about ${rec.ideal}${evidence}. Half portions are a great way to keep the variety.`,
    }
  }

  const carbs = order.filter((l) => MENU_BY_ID[l.dishId].category === 'rice/noodle')
  if (carbs.length >= 2 && partySize <= 4) {
    const names = [...new Set(carbs.map((l) => MENU_BY_ID[l.dishId].name))].join(' + ')
    return {
      tone: 'medium',
      text: `${names} is two rice/noodle dishes for ${partySize} — carb dishes are the ones most often left unfinished. A Half portion of one keeps the variety.`,
    }
  }

  if (ratio > 1.25) {
    return {
      tone: 'medium',
      text: `Heads up — tables of ${partySize} usually finish about ${rec.ideal} dishes${evidence}. One more may be more than the table can eat.`,
    }
  }
  return null
}

/**
 * Green-receipt math: what did this table save by right-sizing?
 * Baseline = the same order with every portionable line at Regular.
 * (If nothing was downsized, savings are zero — we never invent credit.)
 */
export function rightSizingSavings(stats, partySize, order, opts = {}) {
  const baselineOrder = order.map((l) => ({
    ...l,
    portion: MENU_BY_ID[l.dishId].portionable && l.portion === 'half' ? 'regular' : l.portion,
  }))
  const actual = predictWaste(stats, partySize, order, opts)
  const baseline = predictWaste(stats, partySize, baselineOrder, opts)
  return {
    gramsSaved: Math.max(0, baseline.predictedWasteG - actual.predictedWasteG),
    moneySaved: Math.max(0, baseline.totalPrice - actual.totalPrice),
    tapauSavedG: actual.tapauSavedG,
  }
}
