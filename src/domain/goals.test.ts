import { describe, expect, it } from 'vitest';

import {
  EMPTY_GOALS,
  goalProgress,
  hasAnyGoal,
  parseCountTarget,
  parseGoals,
  parseRateTarget,
  serializeGoals,
} from './goals';

describe('parseGoals', () => {
  it('round-trips through serializeGoals', () => {
    const goals = { avg: 0.3, obp: 0.4, hr: 5 };
    expect(parseGoals(serializeGoals(goals))).toEqual(goals);
  });

  it('returns empty goals for missing or garbage input', () => {
    expect(parseGoals(undefined)).toEqual(EMPTY_GOALS);
    expect(parseGoals('')).toEqual(EMPTY_GOALS);
    expect(parseGoals('not json')).toEqual(EMPTY_GOALS);
    expect(parseGoals('[1,2]')).toEqual({ avg: null, obp: null, hr: null });
  });

  it('drops out-of-range values field by field', () => {
    expect(parseGoals('{"avg":2,"obp":0.4,"hr":5.5}')).toEqual({
      avg: null,
      obp: 0.4,
      hr: null,
    });
    expect(parseGoals('{"avg":"0.3","hr":0}')).toEqual(EMPTY_GOALS);
  });
});

describe('hasAnyGoal', () => {
  it('is false for empty goals and true once any field is set', () => {
    expect(hasAnyGoal(EMPTY_GOALS)).toBe(false);
    expect(hasAnyGoal({ avg: null, obp: null, hr: 10 })).toBe(true);
  });
});

describe('goalProgress', () => {
  it('clamps to the 0..1 meter range', () => {
    expect(goalProgress(0.15, 0.3)).toBeCloseTo(0.5);
    expect(goalProgress(0.45, 0.3)).toBe(1);
    expect(goalProgress(null, 0.3)).toBe(0);
    expect(goalProgress(5, 0)).toBe(0);
  });
});

describe('parseRateTarget', () => {
  it('accepts the common spellings of a rate', () => {
    expect(parseRateTarget('.300')).toBeCloseTo(0.3);
    expect(parseRateTarget('0.300')).toBeCloseTo(0.3);
    expect(parseRateTarget('300')).toBeCloseTo(0.3);
    expect(parseRateTarget('0,350')).toBeCloseTo(0.35);
    expect(parseRateTarget('1.000')).toBe(1);
  });

  it('rejects blanks, zero, and non-numbers', () => {
    expect(parseRateTarget('')).toBeNull();
    expect(parseRateTarget('0')).toBeNull();
    expect(parseRateTarget('abc')).toBeNull();
    expect(parseRateTarget('-3')).toBeNull();
  });
});

describe('parseCountTarget', () => {
  it('accepts positive whole numbers only', () => {
    expect(parseCountTarget('10')).toBe(10);
    expect(parseCountTarget(' 5 ')).toBe(5);
    expect(parseCountTarget('0')).toBeNull();
    expect(parseCountTarget('3.5')).toBeNull();
    expect(parseCountTarget('')).toBeNull();
  });
});
