import { describe, expect, it } from 'vitest';

import type { OutcomeCode } from './outcomes';
import {
  buildBoxScore,
  buildLineScore,
  dueUpSlotId,
  gameResult,
  groupOutcomesByPlayer,
  type SlotLike,
} from './skGame';

const slot = (id: string, battingOrder: number, scratched = false): SlotLike => ({
  id,
  battingOrder,
  scratched,
});

describe('dueUpSlotId', () => {
  const lineup = [slot('a', 1), slot('b', 2), slot('c', 3)];

  it('returns null for an empty lineup', () => {
    expect(dueUpSlotId([], null)).toBeNull();
  });

  it('returns null when every slot is scratched', () => {
    expect(dueUpSlotId([slot('a', 1, true), slot('b', 2, true)], 'a')).toBeNull();
  });

  it('starts at the top of the order before any PA', () => {
    expect(dueUpSlotId(lineup, null)).toBe('a');
  });

  it('advances to the next slot mid-order', () => {
    expect(dueUpSlotId(lineup, 'a')).toBe('b');
  });

  it('wraps from the bottom of the order to the top', () => {
    expect(dueUpSlotId(lineup, 'c')).toBe('a');
  });

  it('skips a scratched slot in between', () => {
    expect(dueUpSlotId([slot('a', 1), slot('b', 2, true), slot('c', 3)], 'a')).toBe('c');
  });

  it('still advances past a last batter whose own slot was scratched', () => {
    // b batted, then got scratched — the order continues from b's spot.
    expect(dueUpSlotId([slot('a', 1), slot('b', 2, true), slot('c', 3)], 'b')).toBe('c');
  });

  it('falls back to the top when the last slot id is unknown (slot removed)', () => {
    expect(dueUpSlotId(lineup, 'ghost')).toBe('a');
  });
});

describe('buildLineScore', () => {
  it('renders one untouched column for a fresh game', () => {
    const board = buildLineScore([], 1);
    expect(board.innings).toEqual([{ inning: 1, us: null, them: null }]);
    expect(board.usTotal).toBe(0);
    expect(board.themTotal).toBe(0);
  });

  it('leaves gaps null for sparse innings', () => {
    const board = buildLineScore(
      [
        { inning: 1, runsUs: 2, runsThem: 0 },
        { inning: 3, runsUs: 1, runsThem: 4 },
      ],
      2,
    );
    expect(board.innings).toEqual([
      { inning: 1, us: 2, them: 0 },
      { inning: 2, us: null, them: null },
      { inning: 3, us: 1, them: 4 },
    ]);
    expect(board.usTotal).toBe(3);
    expect(board.themTotal).toBe(4);
  });

  it('keeps columns for runs recorded past a backed-down inning stepper', () => {
    const board = buildLineScore([{ inning: 5, runsUs: 3, runsThem: 1 }], 3);
    expect(board.innings).toHaveLength(5);
    expect(board.innings[4]).toEqual({ inning: 5, us: 3, them: 1 });
  });

  it('pads out to the current inning beyond any recorded runs', () => {
    const board = buildLineScore([{ inning: 1, runsUs: 0, runsThem: 0 }], 4);
    expect(board.innings).toHaveLength(4);
    expect(board.innings[0]).toEqual({ inning: 1, us: 0, them: 0 }); // touched, shows 0
    expect(board.innings[3]).toEqual({ inning: 4, us: null, them: null });
  });
});

describe('gameResult', () => {
  it('calls the game', () => {
    expect(gameResult(7, 4)).toBe('W');
    expect(gameResult(2, 9)).toBe('L');
    expect(gameResult(5, 5)).toBe('T');
  });
});

describe('buildBoxScore', () => {
  const names = new Map([
    ['p1', 'Sam'],
    ['p2', 'Riley'],
    ['p3', 'Jo'],
  ]);

  it('orders rows by batting order and fills empty lines for players who never batted', () => {
    const { rows, team } = buildBoxScore(
      [
        { id: 's2', playerId: 'p2', battingOrder: 2, scratched: false },
        { id: 's1', playerId: 'p1', battingOrder: 1, scratched: false },
      ],
      names,
      [{ playerId: 'p1', outcome: '2B' }],
    );
    expect(rows.map((r) => r.name)).toEqual(['Sam', 'Riley']);
    expect(rows[0].line.h).toBe(1);
    expect(rows[1].line.pa).toBe(0);
    expect(rows[1].line.avg).toBeNull();
    expect(team.pa).toBe(1);
  });

  it('keeps a scratched slot listed with its at-bats counted', () => {
    const { rows, team } = buildBoxScore(
      [
        { id: 's1', playerId: 'p1', battingOrder: 1, scratched: false },
        { id: 's2', playerId: 'p2', battingOrder: 2, scratched: true },
      ],
      names,
      [
        { playerId: 'p2', outcome: 'HR' },
        { playerId: 'p1', outcome: 'K' },
      ],
    );
    const scratchedRow = rows[1];
    expect(scratchedRow.scratched).toBe(true);
    expect(scratchedRow.line.hr).toBe(1);
    expect(team.h).toBe(1);
    expect(team.ab).toBe(2);
  });

  it('team totals equal computeLine over every outcome (hand-checked)', () => {
    const pas: { playerId: string; outcome: OutcomeCode }[] = [
      { playerId: 'p1', outcome: '1B' },
      { playerId: 'p2', outcome: 'BB' },
      { playerId: 'p3', outcome: 'GO' },
      { playerId: 'p1', outcome: 'HR' },
      { playerId: 'p2', outcome: 'K' },
      { playerId: 'p3', outcome: 'SF' },
    ];
    const { rows, team } = buildBoxScore(
      [
        { id: 's1', playerId: 'p1', battingOrder: 1, scratched: false },
        { id: 's2', playerId: 'p2', battingOrder: 2, scratched: false },
        { id: 's3', playerId: 'p3', battingOrder: 3, scratched: false },
      ],
      names,
      pas,
    );
    // Team: 4 AB (1B, GO, HR, K), 2 H, 5 TB, OBP (2+1)/(4+1+1)
    expect(team.ab).toBe(4);
    expect(team.h).toBe(2);
    expect(team.tb).toBe(5);
    expect(team.avg).toBeCloseTo(2 / 4, 10);
    expect(team.obp).toBeCloseTo(3 / 6, 10);
    // Row sums reconcile with the team line.
    expect(rows.reduce((sum, r) => sum + r.line.pa, 0)).toBe(team.pa);
    expect(rows.reduce((sum, r) => sum + r.line.h, 0)).toBe(team.h);
    expect(rows[0].line.avg).toBeCloseTo(1, 10); // Sam: 2-2
  });

  it('labels an unknown player id gracefully', () => {
    const { rows } = buildBoxScore(
      [{ id: 's1', playerId: 'mystery', battingOrder: 1, scratched: false }],
      names,
      [],
    );
    expect(rows[0].name).toBe('Unknown');
  });
});

describe('groupOutcomesByPlayer', () => {
  it('preserves per-player order with interleaved players', () => {
    const grouped = groupOutcomesByPlayer([
      { playerId: 'p1', outcome: 'K' },
      { playerId: 'p2', outcome: 'BB' },
      { playerId: 'p1', outcome: 'HR' },
      { playerId: 'p2', outcome: 'GO' },
      { playerId: 'p1', outcome: '1B' },
    ]);
    expect(grouped.get('p1')).toEqual(['K', 'HR', '1B']);
    expect(grouped.get('p2')).toEqual(['BB', 'GO']);
    expect(grouped.size).toBe(2);
  });

  it('returns an empty map for no PAs', () => {
    expect(groupOutcomesByPlayer([]).size).toBe(0);
  });
});
