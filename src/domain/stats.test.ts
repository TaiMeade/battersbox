import { describe, expect, it } from 'vitest';

import type { OutcomeCode } from './outcomes';
import { computeLine, formatAvg, formatRate, gameLine } from './stats';

describe('computeLine', () => {
  it('returns nulls (never NaN) for an empty log', () => {
    const line = computeLine([]);
    expect(line.pa).toBe(0);
    expect(line.ab).toBe(0);
    expect(line.avg).toBeNull();
    expect(line.obp).toBeNull();
    expect(line.slg).toBeNull();
    expect(line.ops).toBeNull();
    expect(line.kRate).toBeNull();
  });

  it('computes a simple game correctly', () => {
    // 1B, K, BB, HR → 2-for-3 with a walk
    const line = computeLine(['1B', 'K', 'BB', 'HR']);
    expect(line.pa).toBe(4);
    expect(line.ab).toBe(3);
    expect(line.h).toBe(2);
    expect(line.tb).toBe(5);
    expect(line.avg).toBeCloseTo(2 / 3, 10);
    expect(line.obp).toBeCloseTo(3 / 4, 10); // (2 H + 1 BB) / (3 AB + 1 BB)
    expect(line.slg).toBeCloseTo(5 / 3, 10);
    expect(line.ops).toBeCloseTo(3 / 4 + 5 / 3, 10);
  });

  it('sac fly counts against OBP but sac bunt does not', () => {
    const withSF = computeLine(['1B', 'SF']);
    expect(withSF.ab).toBe(1);
    expect(withSF.avg).toBe(1);
    expect(withSF.obp).toBeCloseTo(1 / 2, 10); // SF inflates the denominator

    const withSAC = computeLine(['1B', 'SAC']);
    expect(withSAC.ab).toBe(1);
    expect(withSAC.obp).toBe(1); // SAC is invisible to OBP
  });

  it('FC and E are at-bats that do not help OBP', () => {
    const line = computeLine(['FC', 'E', 'GO']);
    expect(line.ab).toBe(3);
    expect(line.h).toBe(0);
    expect(line.avg).toBe(0);
    expect(line.obp).toBe(0);
  });

  it('handles an all-walk log (0 AB) without NaN', () => {
    const line = computeLine(['BB', 'BB', 'HBP']);
    expect(line.ab).toBe(0);
    expect(line.avg).toBeNull();
    expect(line.obp).toBe(1);
    expect(line.slg).toBeNull();
    expect(line.ops).toBeNull(); // OPS undefined without SLG
    expect(line.bbRate).toBeCloseTo(2 / 3, 10);
  });

  it('matches a hand-computed season line (golden test)', () => {
    const season: OutcomeCode[] = [
      ...rep('1B', 5),
      ...rep('2B', 2),
      ...rep('HR', 1),
      ...rep('BB', 3),
      ...rep('HBP', 1),
      ...rep('K', 6),
      ...rep('GO', 5),
      ...rep('FO', 3),
      ...rep('FC', 1),
      ...rep('E', 1),
      ...rep('SF', 1),
      ...rep('SAC', 1),
    ];
    const line = computeLine(season);
    expect(line.pa).toBe(30);
    expect(line.ab).toBe(24); // 30 - 3 BB - 1 HBP - 1 SF - 1 SAC
    expect(line.h).toBe(8);
    expect(line.tb).toBe(13); // 5·1 + 2·2 + 1·4
    expect(line.xbh).toBe(3);
    expect(line.avg).toBeCloseTo(8 / 24, 10);
    expect(line.obp).toBeCloseTo(12 / 29, 10); // (8+3+1) / (24+3+1+1)
    expect(line.slg).toBeCloseTo(13 / 24, 10);
    expect(line.ops).toBeCloseTo(12 / 29 + 13 / 24, 10);
    expect(line.kRate).toBeCloseTo(6 / 30, 10);
  });
});

describe('formatting', () => {
  it('formats averages box-score style', () => {
    expect(formatAvg(null)).toBe('—');
    expect(formatAvg(0)).toBe('.000');
    expect(formatAvg(1 / 3)).toBe('.333');
    expect(formatAvg(1)).toBe('1.000');
    expect(formatAvg(1.667)).toBe('1.667');
  });

  it('formats rates as whole percentages', () => {
    expect(formatRate(null)).toBe('—');
    expect(formatRate(0.184)).toBe('18%');
  });
});

describe('gameLine', () => {
  it('reads like an announcer', () => {
    expect(gameLine(['1B', '2B', 'GO'])).toBe('2-3 · 2B');
    expect(gameLine(['GO', 'FO'])).toBe('0-2');
    expect(gameLine(['K', 'K', 'BB', 'HR'])).toBe('1-3 · HR, BB, 2 K');
  });
});

function rep(code: OutcomeCode, n: number): OutcomeCode[] {
  return Array.from({ length: n }, () => code);
}
