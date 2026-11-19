import { useWindowDimensions } from 'react-native';

/**
 * Phone-first, but laid out properly on a computer or tablet too.
 * At WIDE_MIN and up the tabs move to a left sidebar and the busier screens
 * (dashboard, live game, trends) split into two columns.
 */
export const WIDE_MIN = 900;

/** Content widths: one readable column, or the two-column layouts. */
export const CONTENT_MAX = 720;
export const CONTENT_MAX_WIDE = 1120;

export function useIsWide(): boolean {
  return useWindowDimensions().width >= WIDE_MIN;
}
