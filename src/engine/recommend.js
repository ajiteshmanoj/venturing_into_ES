/*
 * ============================================================================
 * RECOMMENDATION ENGINE — transparent, rule-based. No fake AI.
 *
 * The whole engine is one idea, applied three ways:
 *
 *   Compare THIS table's dishes-per-person ratio against the historical
 *   waste rates of similar tables (same party-size band), and steer the
 *   order toward the ratio that historically minimised waste while still
 *   feeding everyone.
 *
 * Everything shown in the "Why this estimate?" panel comes straight from
 * the return values here — there is no hidden state.
 * ============================================================================
 */
import {
  MENU_BY_ID,
  PORTIONS,
  RATIO_BUCKETS,
  baseWasteRate,
  bucketForRatio,
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
  for (const item of order) {
    const dish = MENU_BY_ID[item.dishId]
    const portion = PORTIONS[item.portion]
    effectiveDishes += portion.dishFactor
    totalWeightG += dish.portionWeightG * portion.weightFactor
    totalPrice += dish.price * portion.priceFactor
    totalServings += dish.typicalServings * portion.weightFactor
  }
  return { effectiveDishes, totalWeightG, totalPrice, totalServings }
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
 */
export function predictWaste(stats, partySize, order) {
  const metrics = orderMetrics(order)
  if (order.length === 0 || !partySize) {
    return { ...metrics, ratio: 0, predictedWasteG: 0, rate: 0, level: 'none', n: 0 }
  }
  const ratio = metrics.effectiveDishes / partySize
  const { rate, n, band, bucket } = lookupWasteRate(stats, partySize, ratio)
  const predictedWasteG = Math.round(metrics.totalWeightG * rate)

  // Traffic light: thresholds sit on the historical curve — <15% is what
  // right-sized tables achieve, >28% is solidly in over-ordering territory.
  const level = rate < 0.15 ? 'low' : rate < 0.28 ? 'medium' : 'high'

  return { ...metrics, ratio, rate, predictedWasteG, level, n, band, bucket }
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
 * Live Order Checker — a gentle nudge when the ratio drifts, never a block.
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
  if (ratio > 1.25) {
    return {
      tone: 'medium',
      text: `Heads up — tables of ${partySize} usually finish about ${rec.ideal} dishes${evidence}. One more may be more than the table can eat.`,
    }
  }
  return null
}
