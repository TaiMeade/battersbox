/**
 * Season goals: quiet targets for AVG, OBP, and HR count. Stored as JSON
 * under a settings key (`goals.<seasonId>`) so they ride along in backups
 * without a schema migration. Parsing is defensive throughout — a bad or
 * missing value degrades to "no goal", never a crash.
 */

export interface SeasonGoals {
  avg: number | null;
  obp: number | null;
  hr: number | null;
}

export const EMPTY_GOALS: SeasonGoals = { avg: null, obp: null, hr: null };

export function hasAnyGoal(goals: SeasonGoals): boolean {
  return goals.avg !== null || goals.obp !== null || goals.hr !== null;
}

function rateOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= 1
    ? value
    : null;
}

function countOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : null;
}

export function parseGoals(raw: string | null | undefined): SeasonGoals {
  if (!raw) return EMPTY_GOALS;
  try {
    const data: unknown = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return EMPTY_GOALS;
    const record = data as Record<string, unknown>;
    return {
      avg: rateOrNull(record.avg),
      obp: rateOrNull(record.obp),
      hr: countOrNull(record.hr),
    };
  } catch {
    return EMPTY_GOALS;
  }
}

export function serializeGoals(goals: SeasonGoals): string {
  return JSON.stringify(goals);
}

/** Meter fill, 0..1. A null current value (no ABs yet) reads as an empty bar. */
export function goalProgress(current: number | null, target: number): number {
  if (current === null || target <= 0) return 0;
  return Math.min(1, current / target);
}

/**
 * Rate targets the way people say them: ".300", "0.300", "300", or a comma
 * decimal. Anything over 1 is read as thousandths. Returns a value in
 * (0, 1], or null when the text doesn't parse.
 */
export function parseRateTarget(text: string): number | null {
  const t = text.trim().replace(',', '.');
  if (!/^\d*\.?\d+$/.test(t)) return null;
  let value = parseFloat(t);
  if (value > 1) value /= 1000;
  return value > 0 && value <= 1 ? value : null;
}

/** Counting targets (HR): a positive whole number, or null. */
export function parseCountTarget(text: string): number | null {
  const t = text.trim();
  if (!/^\d+$/.test(t)) return null;
  const value = parseInt(t, 10);
  return value > 0 ? value : null;
}
