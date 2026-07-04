import { OUTCOME_SPECS, isOutcomeCode, type OutcomeCode } from './outcomes';
import { computeLine } from './stats';

/** One plate appearance as it comes out of the export query. */
export interface SeasonCsvRow {
  playedOn: string;
  opponent: string | null;
  seq: number;
  outcome: string;
}

function esc(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** Rate stat for a CSV cell: always three decimals ('0.412', '1.000'), empty when undefined. */
function rate(value: number | null): string {
  return value === null ? '' : value.toFixed(3);
}

/**
 * The season export: one row per plate appearance carrying the season line
 * as it stood after that PA, then season totals and a tally of every
 * outcome type that occurred.
 */
export function buildSeasonCSV(seasonName: string, rows: SeasonCsvRow[]): string {
  const lines = [
    'Date,Opponent,At Bat,Outcome,Outcome Name,PA,AB,H,AVG,OBP,SLG,OPS',
  ];

  const running: OutcomeCode[] = [];
  for (const row of rows) {
    if (isOutcomeCode(row.outcome)) running.push(row.outcome);
    const line = computeLine(running);
    lines.push(
      [
        row.playedOn,
        esc(row.opponent ?? ''),
        String(row.seq),
        row.outcome,
        esc(isOutcomeCode(row.outcome) ? OUTCOME_SPECS[row.outcome].name : ''),
        String(line.pa),
        String(line.ab),
        String(line.h),
        rate(line.avg),
        rate(line.obp),
        rate(line.slg),
        rate(line.ops),
      ].join(','),
    );
  }

  const totals = computeLine(running);

  lines.push('', 'Season,PA,AB,H,TB,AVG,OBP,SLG,OPS');
  lines.push(
    [
      esc(seasonName),
      String(totals.pa),
      String(totals.ab),
      String(totals.h),
      String(totals.tb),
      rate(totals.avg),
      rate(totals.obp),
      rate(totals.slg),
      rate(totals.ops),
    ].join(','),
  );

  lines.push('', 'Outcome,Outcome Name,Count');
  for (const code of Object.keys(OUTCOME_SPECS) as OutcomeCode[]) {
    const count = totals.counts[code] ?? 0;
    if (count > 0) lines.push([code, esc(OUTCOME_SPECS[code].name), String(count)].join(','));
  }

  return lines.join('\n');
}
