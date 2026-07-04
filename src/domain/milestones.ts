import { OUTCOME_SPECS, type OutcomeCode } from './outcomes';
import { computeLine } from './stats';

/**
 * Milestone detection. Everything is derived from the ordered list of
 * games, so undo/edit stay trivially correct — a milestone is never
 * stored, only re-detected.
 */

export interface Milestone {
  id: string;
  title: string;
}

export interface MilestoneInput {
  /** Every career outcome including the just-logged PA (order irrelevant — only counts matter). */
  careerOutcomes: OutcomeCode[];
  /**
   * The current season's games in chronological order. The last game is
   * the one being played, and its last outcome is the just-logged PA.
   */
  seasonGames: OutcomeCode[][];
}

const isHit = (code: OutcomeCode) => OUTCOME_SPECS[code].hit;
/** Reached base the official way: hit, walk, or hit-by-pitch. */
const reachedBase = (code: OutcomeCode) => OUTCOME_SPECS[code].hit || code === 'BB' || code === 'HBP';

/** Consecutive qualifying games counting back from the most recent. */
function trailingStreak(games: OutcomeCode[][], qualifies: (g: OutcomeCode[]) => boolean): number {
  let n = 0;
  for (let i = games.length - 1; i >= 0 && qualifies(games[i]); i--) n += 1;
  return n;
}

/**
 * Milestones unlocked by the PA that was just logged, best first.
 * Streak milestones fire only on the game's first qualifying PA, so a
 * streak is celebrated once per game, not once per hit.
 */
export function milestonesForLastPA({ careerOutcomes, seasonGames }: MilestoneInput): Milestone[] {
  const current = seasonGames[seasonGames.length - 1];
  if (!current || current.length === 0) return [];
  const logged = current[current.length - 1];
  const career = computeLine(careerOutcomes);
  const found: Milestone[] = [];

  if (logged === 'HR' && career.hr === 1) {
    found.push({ id: 'first-hr', title: 'First career home run' });
  } else if (isHit(logged) && career.h === 1) {
    found.push({ id: 'first-hit', title: 'First career hit' });
  }

  const hitsThisGame = current.filter(isHit).length;
  const priorHighHits = Math.max(0, ...seasonGames.slice(0, -1).map((g) => g.filter(isHit).length));
  if (isHit(logged) && hitsThisGame >= 3 && hitsThisGame > priorHighHits) {
    found.push({ id: 'season-high-hits', title: `New season high: ${hitsThisGame} hits in one game` });
  }

  if (isHit(logged) && hitsThisGame === 1) {
    const streak = trailingStreak(seasonGames, (g) => g.some(isHit));
    if (streak >= 3) found.push({ id: 'hit-streak', title: `${streak}-game hit streak` });
  }

  if (reachedBase(logged) && current.filter(reachedBase).length === 1) {
    const streak = trailingStreak(seasonGames, (g) => g.some(reachedBase));
    if (streak >= 5) found.push({ id: 'on-base-streak', title: `On base in ${streak} straight games` });
  }

  if (career.pa % 100 === 0) {
    found.push({ id: 'career-pa', title: `Career plate appearance No. ${career.pa}` });
  }

  return found;
}

export interface SeasonRecords {
  longestHitStreak: number;
  /** The longest streak is the current one — still alive. */
  hitStreakLive: boolean;
  longestOnBaseStreak: number;
  onBaseStreakLive: boolean;
  mostHitsInGame: number;
  mostTotalBasesInGame: number;
}

/** The Trends "Season records" section, from games in chronological order. */
export function computeSeasonRecords(games: OutcomeCode[][]): SeasonRecords {
  const played = games.filter((g) => g.length > 0);

  const longest = (qualifies: (g: OutcomeCode[]) => boolean): number => {
    let best = 0;
    let run = 0;
    for (const g of played) {
      run = qualifies(g) ? run + 1 : 0;
      if (run > best) best = run;
    }
    return best;
  };
  const hitGame = (g: OutcomeCode[]) => g.some(isHit);
  const onBaseGame = (g: OutcomeCode[]) => g.some(reachedBase);

  const longestHitStreak = longest(hitGame);
  const longestOnBaseStreak = longest(onBaseGame);

  let mostHitsInGame = 0;
  let mostTotalBasesInGame = 0;
  for (const g of played) {
    const line = computeLine(g);
    if (line.h > mostHitsInGame) mostHitsInGame = line.h;
    if (line.tb > mostTotalBasesInGame) mostTotalBasesInGame = line.tb;
  }

  return {
    longestHitStreak,
    hitStreakLive: longestHitStreak > 0 && trailingStreak(played, hitGame) === longestHitStreak,
    longestOnBaseStreak,
    onBaseStreakLive:
      longestOnBaseStreak > 0 && trailingStreak(played, onBaseGame) === longestOnBaseStreak,
    mostHitsInGame,
    mostTotalBasesInGame,
  };
}
