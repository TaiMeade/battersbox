import type { Game } from '@/db/schema';

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/** "2026-07-03" → "Jul 3" (or "Jul 3, 2025" when not this year). */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  const label = `${MONTHS[m - 1]} ${d}`;
  return y === new Date().getFullYear() ? label : `${label}, ${y}`;
}

/** What to call a game in a list: the opponent if set, otherwise the date. */
export function gameTitle(game: Pick<Game, 'opponent' | 'playedOn'>): string {
  return game.opponent ? `vs ${game.opponent}` : formatDate(game.playedOn);
}

export function defaultSeasonName(): string {
  return `${new Date().getFullYear()} Season`;
}
