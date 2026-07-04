import { describe, expect, it } from 'vitest';

import { cardTrivia, type CardGameFacts } from './cardFacts';
import type { OutcomeCode } from './outcomes';

const game = (
  outcomes: OutcomeCode[],
  opponent: string | null = 'Tigers',
  playedOn = '2026-06-12',
): CardGameFacts => ({ opponent, playedOn, outcomes });

describe('cardTrivia', () => {
  it('invites the first at-bat when nothing is logged', () => {
    expect(cardTrivia([])).toBe('The batting record starts with at-bat No. 1.');
  });

  it('counts trips to the plate while the first hit is pending', () => {
    expect(cardTrivia([game(['K', 'BB', 'K'])])).toBe(
      'Still hunting for hit No. 1 — 3 trips to the plate and counting.',
    );
  });

  it('cites the game with the most hits, naming the power and the opponent', () => {
    const trivia = cardTrivia([
      game(['1B', 'K', 'K'], 'Aces', '2026-05-02'),
      game(['HR', '2B', '1B', 'FO'], 'Tigers', '2026-06-12'),
    ]);
    expect(trivia).toBe('Went 3-for-4 with a home run vs. Tigers on Jun 12.');
  });

  it('calls out a perfect day and reads cleanly without an opponent', () => {
    expect(cardTrivia([game(['1B', '1B', '2B'], null, '2026-04-30')])).toBe(
      'Went a perfect 3-for-3 on Apr 30.',
    );
  });

  it('breaks a hits tie with total bases', () => {
    const trivia = cardTrivia([
      game(['1B', '1B', 'GO'], 'Aces', '2026-05-02'),
      game(['HR', '3B', 'K'], 'Bears', '2026-05-09'),
    ]);
    expect(trivia).toBe('Went 2-for-3 with a home run vs. Bears on May 9.');
  });
});
