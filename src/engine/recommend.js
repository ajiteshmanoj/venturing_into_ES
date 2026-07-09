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
  SCRAP_RATE,
  TAPAU_RECOVERY,
  appetiteCoverage,
  baseWasteRate,
  bucketForRatio,
  coverageRamp,
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
 * The prediction is APPETITE-AWARE: historical waste behaviour describes
 * tables that ordered more than they could eat. When the order sits well
 * within the table's appetite (~420 g/person), the table finishes it —
 * only unavoidable scraps (~3%) remain. The coverage ramp blends from
 * "scraps only" to the full historical rate as the order approaches and
 * exceeds appetite, so waste scales with the WHOLE order, not per dish.
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
      coverage: 0, capacityG: 0, ramp: 0,
    }
  }
  const ratio = metrics.effectiveDishes / partySize
  const { rate: historyRate, n, band, bucket } = lookupWasteRate(stats, partySize, ratio)

  // Historical behaviour × dish mix = what similar over-ordering tables left…
  const behaviourRate = Math.min(historyRate * metrics.mix, 0.55)
  // …scaled by how far this order actually exceeds the table's appetite.
  const { coverage, capacityG } = appetiteCoverage(metrics.totalWeightG, partySize)
  const ramp = coverageRamp(metrics.totalWeightG, partySize)
  const rate = SCRAP_RATE + (behaviourRate - SCRAP_RATE) * ramp
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
    level, n, band, bucket, coverage, capacityG, ramp,
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
  const { effectiveDishes, totalWeightG } = orderMetrics(order)
  const ratio = effectiveDishes / partySize
  const rec = recommendedDishCount(partySize)
  const { n } = lookupWasteRate(stats, partySize, ratio)
  const evidence = n >= 6 ? ` — based on ${n} similar tables` : ''

  // Under-ordering: not a waste problem, but a hungry-table problem.
  const { coverage } = appetiteCoverage(totalWeightG, partySize)
  if (partySize > 1 && coverage < 0.6) {
    return {
      tone: 'info',
      text: `This may be on the light side for ${partySize} people (~${Math.round(coverage * 100)}% of a typical table's appetite) — you'll likely finish everything. Add more anytime.`,
    }
  }

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
 * RULE 4 — SMART SERVE: stage the order instead of firing it all at once.
 * The classic zi char failure mode is ordering for the hungriest moment of
 * the meal — everything hits the table in the first ten minutes, and the
 * dishes ordered "just in case" are the ones that come back unfinished.
 *
 * When the order exceeds what the table can comfortably eat, propose a
 * split: fire a round 1 that still feeds everyone, hold the rest. Near the
 * end of the meal the table decides — still hungry? Round 2 fires in one
 * tap. Comfortably full? The held dishes are never cooked and never billed:
 * waste avoided BEFORE it exists, not managed after.
 *
 * The split is deterministic (demo runs are identical): hold the dishes
 * with the largest expected bin contribution (grams on the table × how
 * often that dish historically comes back unfinished), stopping once the
 * round-1 prediction turns green. Round 1 must always still feed the party
 * on its own (servings ≥ party size, at least the feeding-floor dish count).
 * Returns null when the order is already right-sized — no split to suggest.
 */
export function smartServeSplit(stats, partySize, order, opts = {}) {
  if (!partySize || order.length < 2) return null
  const fullPrediction = predictWaste(stats, partySize, order, opts)
  if (fullPrediction.level === 'low') return null

  const binContribution = (line) => {
    const dish = MENU_BY_ID[line.dishId]
    return dish.portionWeightG * PORTIONS[line.portion].weightFactor * dish.wastePropensity
  }
  const ranked = [...order].sort((a, b) => binContribution(b) - binContribution(a))

  const { min: minToFeed } = recommendedDishCount(partySize)
  let now = [...order]
  const later = []
  for (const line of ranked) {
    if (predictWaste(stats, partySize, now, opts).level === 'low') break
    const candidate = now.filter((l) => l.key !== line.key)
    // Round 1 alone must still feed the table — never hold below the floor.
    if (candidate.length < minToFeed || orderMetrics(candidate).totalServings < partySize) continue
    now = candidate
    later.push(line)
  }
  if (later.length === 0) return null
  return {
    now,
    later,
    nowPrediction: predictWaste(stats, partySize, now, opts),
    fullPrediction,
  }
}

/**
 * TABLE CHECK-OUT — the verification loop.
 * At order time we PREDICT leftovers; after the meal the table logs the
 * actual outcome (in a real deployment: an after-photo scored by vision or
 * the clearing-station weigh; in this demo: a tap-to-choose stand-in).
 * The three outcomes below are deterministic so every demo run is identical.
 */
export function checkoutOutcomes(prediction) {
  const { plateLeftoverG, totalWeightG } = prediction
  const scrapG = Math.round(totalWeightG * SCRAP_RATE)
  return [
    {
      key: 'spotless',
      emoji: '✨',
      label: 'Spotless',
      detail: 'Plates cleared — scraps only',
      measuredG: scrapG,
    },
    {
      key: 'few-bites',
      emoji: '🥄',
      label: 'A few bites left',
      detail: 'Better than tables like yours usually do',
      measuredG: Math.max(scrapG, Math.round(plateLeftoverG * 0.75)),
    },
    {
      key: 'lots-left',
      emoji: '🍚',
      label: 'Quite a lot left',
      detail: 'More than the estimate',
      measuredG: Math.min(Math.round(plateLeftoverG * 1.35), Math.round(totalWeightG * 0.55)),
    },
  ]
}

/**
 * Points for beating the prediction, split across the party's accounts.
 * Reward the BEAT (predicted − measured), not absolute waste — every table
 * gets a fair target regardless of size or dish mix. Participation earns a
 * small flat credit either way (logging the outcome is itself the data the
 * system learns from). 1 point ≈ 10 g of waste avoided, matching the
 * eco-points scale on the receipt.
 */
export function checkoutPoints(predictedG, measuredG, partySize) {
  const PARTICIPATION = 5
  const beatG = Math.max(0, predictedG - measuredG)
  const total = PARTICIPATION + Math.round(beatG / 10)
  return {
    total,
    perPerson: Math.max(1, Math.floor(total / partySize)),
    beatG,
    beat: measuredG < predictedG,
  }
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
