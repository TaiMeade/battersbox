import type { OutcomeCode } from './outcomes';
import { computeLine, type StatLine } from './stats';

/**
 * Scorekeeper Mode game logic: batting-order bookkeeping, the line score,
 * and box-score assembly. Pure functions over plain rows — the same
 * "derive everything from stored PAs" rule as the player-mode engine.
 */

export interface SlotLike {
  id: string;
  battingOrder: number;
  scratched: boolean;
}

/**
 * Which lineup slot bats next. Robust to mid-game surgery: scratched slots
 * are skipped, a last batter whose slot has since been scratched (or removed)
 * still anchors the order, and an unknown/absent last PA starts at the top.
 * Returns null when no active slots remain.
 */
export function dueUpSlotId(slots: SlotLike[], lastPaSlotId: string | null): string | null {
  const active = slots.filter((s) => !s.scratched).sort((a, b) => a.battingOrder - b.battingOrder);
  if (active.length === 0) return null;
  if (lastPaSlotId === null) return active[0].id;

  // Look the last batter up in the FULL list — their slot may be scratched now.
  const last = slots.find((s) => s.id === lastPaSlotId);
  if (!last) return active[0].id;

  const next = active.find((s) => s.battingOrder > last.battingOrder);
  return (next ?? active[0]).id;
}

/** One column of the scoreboard. null = inning never touched (renders as "–"). */
export interface InningCell {
  inning: number;
  us: number | null;
  them: number | null;
}

export interface LineScore {
  innings: InningCell[];
  usTotal: number;
  themTotal: number;
}

/**
 * The inning-by-inning board. Pads through max(currentInning, highest
 * recorded inning) so runs logged ahead of a backed-down stepper never
 * lose their column.
 */
export function buildLineScore(
  rows: { inning: number; runsUs: number; runsThem: number }[],
  currentInning: number,
): LineScore {
  let maxInning = Math.max(1, Math.floor(currentInning));
  for (const row of rows) maxInning = Math.max(maxInning, row.inning);

  const byInning = new Map(rows.map((r) => [r.inning, r]));
  const innings: InningCell[] = [];
  for (let inning = 1; inning <= maxInning; inning += 1) {
    const row = byInning.get(inning);
    innings.push({ inning, us: row?.runsUs ?? null, them: row?.runsThem ?? null });
  }

  let usTotal = 0;
  let themTotal = 0;
  for (const row of rows) {
    usTotal += row.runsUs;
    themTotal += row.runsThem;
  }
  return { innings, usTotal, themTotal };
}

export type GameResult = 'W' | 'L' | 'T';

export function gameResult(usTotal: number, themTotal: number): GameResult {
  if (usTotal > themTotal) return 'W';
  if (usTotal < themTotal) return 'L';
  return 'T';
}

export interface BoxScoreRow {
  slotId: string;
  playerId: string;
  name: string;
  battingOrder: number;
  scratched: boolean;
  line: StatLine;
}

/**
 * Per-player lines in batting order plus team totals. Players who never
 * batted get an empty (0 PA) line; scratched slots stay listed so their
 * at-bats are never orphaned from the box score.
 */
export function buildBoxScore(
  slots: { id: string; playerId: string; battingOrder: number; scratched: boolean }[],
  playerNames: Map<string, string>,
  pas: { playerId: string; outcome: OutcomeCode }[],
): { rows: BoxScoreRow[]; team: StatLine } {
  const byPlayer = groupOutcomesByPlayer(pas);
  const rows = [...slots]
    .sort((a, b) => a.battingOrder - b.battingOrder)
    .map((slot) => ({
      slotId: slot.id,
      playerId: slot.playerId,
      name: playerNames.get(slot.playerId) ?? 'Unknown',
      battingOrder: slot.battingOrder,
      scratched: slot.scratched,
      line: computeLine(byPlayer.get(slot.playerId) ?? []),
    }));
  return { rows, team: computeLine(pas.map((pa) => pa.outcome)) };
}

/** Mirrors groupOutcomesByGame: per-player outcome lists, input order preserved. */
export function groupOutcomesByPlayer(
  rows: { playerId: string; outcome: OutcomeCode }[],
): Map<string, OutcomeCode[]> {
  const byPlayer = new Map<string, OutcomeCode[]>();
  for (const row of rows) {
    const list = byPlayer.get(row.playerId);
    if (list) list.push(row.outcome);
    else byPlayer.set(row.playerId, [row.outcome]);
  }
  return byPlayer;
}
