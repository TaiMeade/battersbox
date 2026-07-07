import { describe, expect, it } from 'vitest';

import type { OutcomeCode } from './outcomes';
import { cumulativeTrendPoints } from './trend';

describe('cumulativeTrendPoints', () => {
  it('returns no points without games', () => {
    expect(cumulativeTrendPoints([])).toEqual([]);
  });

  it('skips games with no PAs without burning a game number', () => {
    const points = cumulativeTrendPoints([[], ['1B'], [], ['K']]);
    expect(points.map((p) => p.game)).toEqual([1, 2]);
  });

  it('accumulates the line across games', () => {
    const g1: OutcomeCode[] = ['1B', 'K']; // 1-2 → .500
    const g2: OutcomeCode[] = ['K', 'K']; // 1-4 → .250
    const points = cumulativeTrendPoints([g1, g2]);
    expect(points).toHaveLength(2);
    expect(points[0].avg).toBeCloseTo(0.5);
    expect(points[1].avg).toBeCloseTo(0.25);
  });

  it('carries a null AVG through walk-only games', () => {
    const points = cumulativeTrendPoints([['BB'], ['1B']]);
    expect(points[0].avg).toBeNull();
    expect(points[1].avg).toBeCloseTo(1);
  });

  it('computes OPS from the running line', () => {
    // HR in 1 AB: AVG 1.000, OBP 1.000, SLG 4.000 → OPS 5.000
    const points = cumulativeTrendPoints([['HR']]);
    expect(points[0].ops).toBeCloseTo(5);
  });
});
