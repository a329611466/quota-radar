import type { ResetEvent } from '../data/types';

const DAY_MS = 86_400_000;

/** 越近的间隔权重越高。0.09 ≈ 10 步前的间隔权重是最新的一半。 */
const RECENCY_LAMBDA = 0.09;
/** 条件概率里剩余样本少于这个数就不给结论。 */
const MIN_SAMPLES = 5;
/** 置信窗口搜索上限（天）。 */
const MAX_WINDOW = 90;

export interface Forecast {
  /** 距上一次重置的天数 */
  daysSinceLast: number;
  /** 近期加权后的典型间隔（天） */
  typicalGap: number;
  /** 全历史中位间隔（天） */
  fullMedianGap: number;
  /** P(未来 2 天内重置) */
  p2: number;
  /** P(未来 7 天内重置) */
  p7: number;
  /** 达到 80% 概率所需的天数（从现在起） */
  window80: number;
  /** 达到 95% 概率所需的天数（从现在起） */
  window95: number;
  /** 最可能区间（天，从现在起） */
  likelyFrom: number;
  likelyTo: number;
  /** 参与计算的间隔样本数 */
  sampleSize: number;
  /** 剩余样本过少时结论不可靠 */
  reliable: boolean;
}

function sortedTimes(events: ResetEvent[]): number[] {
  return events
    .map((event) => Date.parse(event.announced_at))
    .filter((time) => !Number.isNaN(time))
    .sort((a, b) => a - b);
}

/** 相邻重置之间的间隔天数，从旧到新。 */
export function gapDays(events: ResetEvent[]): number[] {
  const times = sortedTimes(events);
  const gaps: number[] = [];
  for (let i = 1; i < times.length; i += 1) {
    gaps.push((times[i]! - times[i - 1]!) / DAY_MS);
  }
  return gaps;
}

/** 近期权重：gaps 从旧到新排列，index 越大越新、权重越高。 */
function recencyWeights(count: number): number[] {
  return Array.from({ length: count }, (_, i) => Math.exp(RECENCY_LAMBDA * i));
}

/** 加权分位数。 */
export function weightedQuantile(
  values: number[],
  weights: number[],
  q: number,
): number {
  if (values.length === 0) return 0;
  const pairs = values.map((value, i) => ({ value, weight: weights[i]! })).sort((a, b) => a.value - b.value);
  const total = pairs.reduce((sum, pair) => sum + pair.weight, 0);
  let accumulated = 0;
  for (const pair of pairs) {
    accumulated += pair.weight;
    if (accumulated >= q * total) return pair.value;
  }
  return pairs[pairs.length - 1]!.value;
}

/**
 * 条件概率：已知已经等了 t 天，接下来 horizon 天内重置的概率。
 * 用经验分布估计，只统计「间隔 > t」的样本，并按近期加权。
 */
function conditionalProbability(
  gaps: number[],
  weights: number[],
  t: number,
  horizon: number,
): { probability: number; samples: number } {
  let total = 0;
  let within = 0;
  gaps.forEach((gap, i) => {
    if (gap <= t) return;
    const weight = weights[i]!;
    total += weight;
    if (gap <= t + horizon) within += weight;
  });
  if (total === 0) return { probability: 0, samples: 0 };
  return { probability: within / total, samples: gaps.filter((gap) => gap > t).length };
}

/** 找到让条件概率首次达到 target 的天数。 */
function windowForProbability(
  gaps: number[],
  weights: number[],
  t: number,
  target: number,
): number {
  for (let horizon = 1; horizon <= MAX_WINDOW; horizon += 1) {
    const { probability, samples } = conditionalProbability(gaps, weights, t, horizon);
    if (samples < MIN_SAMPLES) return -1;
    if (probability >= target) return horizon;
  }
  return -1;
}

/**
 * 各时间窗内的累计重置概率：P(未来 X 天内重置 | 已等待 t 天)。
 * X 递增时这个值单调不减，所以画成柱状图就是一条"信心爬升"曲线。
 */
export function horizonProbabilities(
  events: ResetEvent[],
  horizons: number[],
  now: Date = new Date(),
): { horizon: number; probability: number }[] {
  const times = sortedTimes(events);
  if (times.length < 3) return [];

  const gaps = gapDays(events);
  const weights = recencyWeights(gaps.length);
  const daysSinceLast = Math.max(
    0,
    (now.getTime() - times[times.length - 1]!) / DAY_MS,
  );

  return horizons.map((horizon) => ({
    horizon,
    probability: conditionalProbability(gaps, weights, daysSinceLast, horizon).probability,
  }));
}

/**
 * 基于历史间隔分布预测下一次重置。
 *
 * 这是统计推断，不是官方时间表；也不预测故障。
 * 关键点：重置节奏近年明显变快（全历史均值 6.2 天，近 20 次中位 2.6 天），
 * 所以用近期加权的经验分布，而不是全历史均值。
 */
export function forecastNextReset(events: ResetEvent[], now: Date = new Date()): Forecast | null {
  const times = sortedTimes(events);
  if (times.length < 3) return null;

  const gaps = gapDays(events);
  const weights = recencyWeights(gaps.length);

  const lastTime = times[times.length - 1]!;
  const daysSinceLast = Math.max(0, (now.getTime() - lastTime) / DAY_MS);

  const typicalGap = weightedQuantile(gaps, weights, 0.5);
  const fullMedianGap = weightedQuantile(gaps, weights.map(() => 1), 0.5);

  const p2 = conditionalProbability(gaps, weights, daysSinceLast, 2);
  const p7 = conditionalProbability(gaps, weights, daysSinceLast, 7);
  const window80 = windowForProbability(gaps, weights, daysSinceLast, 0.8);
  const window95 = windowForProbability(gaps, weights, daysSinceLast, 0.95);

  // 最可能区间：条件分布的 25%~75% 分位
  const beyond: number[] = [];
  const beyondWeights: number[] = [];
  gaps.forEach((gap, i) => {
    if (gap > daysSinceLast) {
      beyond.push(gap - daysSinceLast);
      beyondWeights.push(weights[i]!);
    }
  });
  const likelyFrom = Math.max(
    0,
    Math.round(weightedQuantile(beyond, beyondWeights, 0.25)),
  );
  const likelyTo = Math.max(
    likelyFrom,
    Math.round(weightedQuantile(beyond, beyondWeights, 0.75)),
  );

  const remaining = gaps.filter((gap) => gap > daysSinceLast).length;

  return {
    daysSinceLast,
    typicalGap,
    fullMedianGap,
    p2: p2.probability,
    p7: p7.probability,
    window80,
    window95,
    likelyFrom,
    likelyTo,
    sampleSize: gaps.length,
    reliable: remaining >= MIN_SAMPLES,
  };
}
