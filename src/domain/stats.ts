import { OUTCOME_SPECS, type OutcomeCode } from './outcomes';

/**
 * Pure stats engine. Everything is derived from a list of outcomes;
 * rate stats are `null` (never NaN) when the denominator is zero.
 */

export interface StatLine {
  pa: number;
  ab: number;
  h: number;
  singles: number;
  doubles: number;
  triples: number;
  hr: number;
  xbh: number;
  bb: number;
  hbp: number;
  k: number;
  sf: number;
  sac: number;
  tb: number;
  counts: Partial<Record<OutcomeCode, number>>;
  avg: number | null;
  obp: number | null;
  slg: number | null;
  ops: number | null;
  /** K and BB rates per plate appearance. */
  kRate: number | null;
  bbRate: number | null;
  /** Isolated power: extra bases per at-bat (SLG − AVG). */
  iso: number | null;
  /** Batting average on balls in play: (H − HR) / (AB − K − HR + SF). */
  babip: number | null;
  /** Weighted on-base average — every way aboard, weighted by its run value. */
  woba: number | null;
}

/**
 * FanGraphs-style linear weights, fixed to a representative recent season.
 * The official constants drift a little year to year; for a rec-league
 * log, a stable yardstick beats a moving target.
 */
const WOBA_WEIGHTS = {
  bb: 0.69,
  hbp: 0.72,
  single: 0.89,
  double: 1.27,
  triple: 1.62,
  hr: 2.1,
} as const;

export function computeLine(outcomes: OutcomeCode[]): StatLine {
  let ab = 0;
  let h = 0;
  let tb = 0;
  let obpNum = 0;
  let obpDen = 0;
  const counts: Partial<Record<OutcomeCode, number>> = {};

  for (const code of outcomes) {
    const spec = OUTCOME_SPECS[code];
    counts[code] = (counts[code] ?? 0) + 1;
    if (spec.ab) ab += 1;
    if (spec.hit) h += 1;
    tb += spec.totalBases;
    if (spec.obpNum) obpNum += 1;
    if (spec.obpDen) obpDen += 1;
  }

  const pa = outcomes.length;
  const avg = ab > 0 ? h / ab : null;
  const obp = obpDen > 0 ? obpNum / obpDen : null;
  const slg = ab > 0 ? tb / ab : null;
  const ops = avg !== null && obp !== null ? obp + slg! : null;

  const singles = counts['1B'] ?? 0;
  const doubles = counts['2B'] ?? 0;
  const triples = counts['3B'] ?? 0;
  const hr = counts.HR ?? 0;
  const bb = counts.BB ?? 0;
  const hbp = counts.HBP ?? 0;
  const k = counts.K ?? 0;
  const sf = counts.SF ?? 0;

  const babipDen = ab - k - hr + sf;
  const wobaDen = ab + bb + sf + hbp;
  const wobaNum =
    WOBA_WEIGHTS.bb * bb +
    WOBA_WEIGHTS.hbp * hbp +
    WOBA_WEIGHTS.single * singles +
    WOBA_WEIGHTS.double * doubles +
    WOBA_WEIGHTS.triple * triples +
    WOBA_WEIGHTS.hr * hr;

  return {
    pa,
    ab,
    h,
    singles,
    doubles,
    triples,
    hr,
    xbh: doubles + triples + hr,
    bb,
    hbp,
    k,
    sf,
    sac: counts.SAC ?? 0,
    tb,
    counts,
    avg,
    obp,
    slg,
    ops,
    kRate: pa > 0 ? k / pa : null,
    bbRate: pa > 0 ? bb / pa : null,
    iso: ab > 0 ? (tb - h) / ab : null,
    babip: babipDen > 0 ? (h - hr) / babipDen : null,
    woba: wobaDen > 0 ? wobaNum / wobaDen : null,
  };
}

/** Box-score formatting: .412, 1.000, or an em dash when undefined. */
export function formatAvg(value: number | null): string {
  if (value === null) return '—';
  const fixed = value.toFixed(3);
  return fixed.startsWith('0.') ? fixed.slice(1) : fixed;
}

/** Whole-number percentage: 18%, or an em dash when undefined. */
export function formatRate(value: number | null): string {
  if (value === null) return '—';
  return `${Math.round(value * 100)}%`;
}

/** Announcer's line for one game: "2-3 · 2B, BB" (or just "0-4, 2 K"). */
export function gameLine(outcomes: OutcomeCode[]): string {
  const line = computeLine(outcomes);
  const notables: string[] = [];
  const order: OutcomeCode[] = ['HR', '3B', '2B', 'BB', 'HBP', 'SF', 'SAC', 'K'];
  for (const code of order) {
    const n = line.counts[code] ?? 0;
    if (n === 1) notables.push(code);
    else if (n > 1) notables.push(`${n} ${code}`);
  }
  const base = `${line.h}-${line.ab}`;
  return notables.length > 0 ? `${base} · ${notables.join(', ')}` : base;
}
