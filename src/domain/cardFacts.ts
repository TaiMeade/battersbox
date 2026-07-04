import type { OutcomeCode } from './outcomes';
import { computeLine, type StatLine } from './stats';

/** One game of the career, condensed to what the card back's trivia needs. */
export interface CardGameFacts {
  opponent: string | null;
  playedOn: string; // ISO YYYY-MM-DD
  outcomes: OutcomeCode[];
}

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function monthDay(iso: string): string {
  const [, m, d] = iso.split('-').map(Number);
  return m && d ? `${MONTHS[m - 1]} ${d}` : iso;
}

/**
 * The "cartoon corner" of a real card back: one printed line of trivia.
 * Cites the best game of the career — most hits, then most total bases;
 * the earliest game wins ties (cards celebrate the first time you did it).
 */
export function cardTrivia(games: CardGameFacts[]): string {
  const career = computeLine(games.flatMap((g) => g.outcomes));
  if (career.pa === 0) return 'The batting record starts with at-bat No. 1.';
  if (career.h === 0) {
    return `Still hunting for hit No. 1 — ${career.pa} trips to the plate and counting.`;
  }

  let best: { facts: CardGameFacts; line: StatLine } | null = null;
  for (const facts of games) {
    const line = computeLine(facts.outcomes);
    if (line.h === 0) continue;
    if (!best || line.h > best.line.h || (line.h === best.line.h && line.tb > best.line.tb)) {
      best = { facts, line };
    }
  }
  // career.h > 0 guarantees some game had a hit
  const { facts, line } = best!;

  const day =
    line.h === line.ab && line.ab >= 3
      ? `a perfect ${line.h}-for-${line.ab}`
      : `${line.h}-for-${line.ab}`;
  const power = line.hr === 0 ? '' : line.hr === 1 ? ' with a home run' : ` with ${line.hr} home runs`;
  const opponent = facts.opponent ? ` vs. ${facts.opponent}` : '';
  return `Went ${day}${power}${opponent} on ${monthDay(facts.playedOn)}.`;
}
