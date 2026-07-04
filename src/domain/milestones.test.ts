import { describe, expect, it } from 'vitest';

import { computeSeasonRecords, milestonesForLastPA } from './milestones';
import type { OutcomeCode } from './outcomes';

const ids = (input: Parameters<typeof milestonesForLastPA>[0]) =>
  milestonesForLastPA(input).map((m) => m.id);

describe('milestonesForLastPA', () => {
  it('returns nothing before the first PA', () => {
    expect(milestonesForLastPA({ careerOutcomes: [], seasonGames: [] })).toEqual([]);
  });

  it('celebrates the first career hit', () => {
    const g: OutcomeCode[] = ['K', '1B'];
    expect(ids({ careerOutcomes: g, seasonGames: [g] })).toEqual(['first-hit']);
  });

  it('first home run outranks first hit', () => {
    const g: OutcomeCode[] = ['HR'];
    expect(ids({ careerOutcomes: g, seasonGames: [g] })).toEqual(['first-hr']);
  });

  it('fires the hit streak on the first hit of the third straight game', () => {
    const seasonGames: OutcomeCode[][] = [['1B', 'K'], ['2B'], ['K', '1B']];
    const career: OutcomeCode[] = ['1B', '2B', '1B', '1B', 'K', 'K'];
    const found = milestonesForLastPA({ careerOutcomes: career, seasonGames });
    expect(found.map((m) => m.title)).toContain('3-game hit streak');
  });

  it('stays quiet on a second hit in the same streak game', () => {
    const seasonGames: OutcomeCode[][] = [['1B', 'K'], ['2B'], ['1B', '1B']];
    const career: OutcomeCode[] = ['1B', '2B', '1B', '1B', '1B', 'K'];
    expect(ids({ careerOutcomes: career, seasonGames })).not.toContain('hit-streak');
  });

  it('fires the on-base streak at five straight games', () => {
    const seasonGames: OutcomeCode[][] = [['BB'], ['BB'], ['BB'], ['BB'], ['BB']];
    const career: OutcomeCode[] = ['BB', 'BB', 'BB', 'BB', 'BB'];
    expect(ids({ careerOutcomes: career, seasonGames })).toEqual(['on-base-streak']);
  });

  it('marks a new season high in hits at three or more', () => {
    const seasonGames: OutcomeCode[][] = [
      ['1B', '1B', 'K'],
      ['1B', '2B', 'K', '3B'],
    ];
    const career: OutcomeCode[] = ['1B', '1B', 'K', '1B', '2B', 'K', '3B'];
    const found = milestonesForLastPA({ careerOutcomes: career, seasonGames });
    expect(found.map((m) => m.title)).toContain('New season high: 3 hits in one game');
  });

  it('logs career plate appearance No. 100', () => {
    const career = Array.from({ length: 100 }, () => 'K' as OutcomeCode);
    const found = milestonesForLastPA({ careerOutcomes: career, seasonGames: [['K']] });
    expect(found.map((m) => m.title)).toEqual(['Career plate appearance No. 100']);
  });

  it('says nothing about an ordinary at-bat', () => {
    const g: OutcomeCode[] = ['1B', '2B', 'K', 'GO'];
    expect(ids({ careerOutcomes: g, seasonGames: [g] })).toEqual([]);
  });
});

describe('computeSeasonRecords', () => {
  it('tracks streaks and single-game highs', () => {
    const records = computeSeasonRecords([
      ['1B', 'K'],
      ['BB', 'K'],
      ['2B', '1B'],
      ['HR', '1B', '1B'],
    ]);
    expect(records.longestHitStreak).toBe(2);
    expect(records.hitStreakLive).toBe(true);
    expect(records.longestOnBaseStreak).toBe(4);
    expect(records.onBaseStreakLive).toBe(true);
    expect(records.mostHitsInGame).toBe(3);
    expect(records.mostTotalBasesInGame).toBe(6);
  });

  it('marks a broken streak as not live', () => {
    const records = computeSeasonRecords([['1B'], ['1B'], ['K'], ['2B']]);
    expect(records.longestHitStreak).toBe(2);
    expect(records.hitStreakLive).toBe(false);
  });

  it('handles an empty season', () => {
    const records = computeSeasonRecords([]);
    expect(records.longestHitStreak).toBe(0);
    expect(records.hitStreakLive).toBe(false);
    expect(records.mostTotalBasesInGame).toBe(0);
  });
});
