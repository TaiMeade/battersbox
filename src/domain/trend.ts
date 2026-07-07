import type { OutcomeCode } from './outcomes';
import { computeLine } from './stats';

/**
 * The season trend line: cumulative season-to-date AVG and OPS after each
 * game. Pure so the Trends screen can build one series per season and
 * overlay them (season vs. season compare).
 */

export interface TrendPoint {
  /** 1-based game number. */
  game: number;
  avg: number | null;
  ops: number | null;
}

/**
 * One point per game with at least one PA, from per-game outcome lists in
 * chronological order. Each point carries the line across everything logged
 * up to and including that game.
 */
export function cumulativeTrendPoints(gameOutcomes: OutcomeCode[][]): TrendPoint[] {
  const running: OutcomeCode[] = [];
  const points: TrendPoint[] = [];
  for (const outcomes of gameOutcomes) {
    if (outcomes.length === 0) continue;
    running.push(...outcomes);
    const soFar = computeLine(running);
    points.push({ game: points.length + 1, avg: soFar.avg, ops: soFar.ops });
  }
  return points;
}
