/**
 * The outcome taxonomy. One table drives everything: each outcome declares
 * its effect on the counting stats, and the stats engine derives
 * AVG / OBP / SLG / OPS purely from these flags.
 *
 * Scoring notes baked in as sensible defaults for casual users:
 * - FC and E count as at-bats without a hit, and do NOT help OBP
 *   (official scoring).
 * - SF (sac fly) is not an at-bat but counts against OBP;
 *   SAC (sac bunt) is not an at-bat and is ignored by OBP.
 */

export type OutcomeCode =
  | '1B'
  | '2B'
  | '3B'
  | 'HR'
  | 'BB'
  | 'HBP'
  | 'K'
  | 'GO'
  | 'FO'
  | 'FC'
  | 'E'
  | 'SF'
  | 'SAC';

export type OutcomeGroup = 'hit' | 'onBase' | 'out' | 'sacrifice';

export interface OutcomeSpec {
  code: OutcomeCode;
  /** Full name, used in hints and the PA log. */
  name: string;
  group: OutcomeGroup;
  /** Ball was put in play — these offer the spray-chart location prompt. */
  inPlay: boolean;
  /** Counts as an at-bat. */
  ab: boolean;
  /** Counts as a hit. */
  hit: boolean;
  totalBases: 0 | 1 | 2 | 3 | 4;
  /** Counts in the OBP numerator (times on base). */
  obpNum: boolean;
  /** Counts in the OBP denominator (AB + BB + HBP + SF). */
  obpDen: boolean;
  /** Long-press explainer for the tricky ones. */
  hint?: string;
}

export const OUTCOME_SPECS: Record<OutcomeCode, OutcomeSpec> = {
  '1B': { code: '1B', name: 'Single', group: 'hit', inPlay: true, ab: true, hit: true, totalBases: 1, obpNum: true, obpDen: true },
  '2B': { code: '2B', name: 'Double', group: 'hit', inPlay: true, ab: true, hit: true, totalBases: 2, obpNum: true, obpDen: true },
  '3B': { code: '3B', name: 'Triple', group: 'hit', inPlay: true, ab: true, hit: true, totalBases: 3, obpNum: true, obpDen: true },
  HR: { code: 'HR', name: 'Home Run', group: 'hit', inPlay: true, ab: true, hit: true, totalBases: 4, obpNum: true, obpDen: true },
  BB: { code: 'BB', name: 'Walk', group: 'onBase', inPlay: false, ab: false, hit: false, totalBases: 0, obpNum: true, obpDen: true },
  HBP: {
    code: 'HBP', name: 'Hit by Pitch', group: 'onBase', inPlay: false, ab: false, hit: false, totalBases: 0, obpNum: true, obpDen: true,
  },
  K: { code: 'K', name: 'Strikeout', group: 'out', inPlay: false, ab: true, hit: false, totalBases: 0, obpNum: false, obpDen: true },
  GO: { code: 'GO', name: 'Groundout', group: 'out', inPlay: true, ab: true, hit: false, totalBases: 0, obpNum: false, obpDen: true },
  FO: {
    code: 'FO', name: 'Flyout / Lineout', group: 'out', inPlay: true, ab: true, hit: false, totalBases: 0, obpNum: false, obpDen: true,
  },
  FC: {
    code: 'FC',
    name: "Fielder's Choice",
    group: 'out',
    inPlay: true,
    ab: true,
    hit: false,
    totalBases: 0,
    obpNum: false,
    obpDen: true,
    hint: 'You reached base, but a runner was retired instead. Counts as an at-bat with no hit.',
  },
  E: {
    code: 'E',
    name: 'Reached on Error',
    group: 'out',
    inPlay: true,
    ab: true,
    hit: false,
    totalBases: 0,
    obpNum: false,
    obpDen: true,
    hint: 'You reached base on a fielding mistake. Counts as an at-bat with no hit.',
  },
  SF: {
    code: 'SF',
    name: 'Sac Fly',
    group: 'sacrifice',
    inPlay: true,
    ab: false,
    hit: false,
    totalBases: 0,
    obpNum: false,
    obpDen: true,
    hint: 'A fly ball that scored a runner. Not an at-bat, but it does count against your OBP.',
  },
  SAC: {
    code: 'SAC',
    name: 'Sac Bunt',
    group: 'sacrifice',
    inPlay: true,
    ab: false,
    hit: false,
    totalBases: 0,
    obpNum: false,
    obpDen: false,
    hint: 'A bunt that moved a runner over. Not an at-bat, and it does not affect your OBP.',
  },
};

export const ALL_OUTCOMES = Object.keys(OUTCOME_SPECS) as OutcomeCode[];

export function isOutcomeCode(value: string): value is OutcomeCode {
  return value in OUTCOME_SPECS;
}

/** Grid layout for the logging screen, grouped by what the outcome means. */
export const OUTCOME_GROUPS: { key: OutcomeGroup; title: string; codes: OutcomeCode[] }[] = [
  { key: 'hit', title: 'Hits', codes: ['1B', '2B', '3B', 'HR'] },
  { key: 'onBase', title: 'On base', codes: ['BB', 'HBP'] },
  { key: 'out', title: 'Outs', codes: ['K', 'GO', 'FO', 'FC', 'E'] },
  { key: 'sacrifice', title: 'Sacrifice', codes: ['SF', 'SAC'] },
];
