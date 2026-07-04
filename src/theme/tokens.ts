import type { OutcomeGroup } from '@/domain/outcomes';

/**
 * "Scoreboard & Chalk" — BattersBox design tokens.
 *
 * Grounded in the ballpark's own materials: foul-line chalk, the dark
 * green of a hand-operated scoreboard, amber bulbs, outfield grass,
 * infield clay. The scoreboard panel stays green in BOTH themes — a real
 * scoreboard doesn't change color at night, the bulbs just glow brighter.
 *
 * Sunlight rule: the surfaces you tap mid-game stay light-on-dark-text in
 * light mode (paper beats glass in glare); the scoreboard panel is a
 * header, not a tap target.
 */

export const palette = {
  // chalk (light theme surfaces)
  chalk: '#F5F3EA',
  chalkCard: '#FDFCF7',
  chalkLine: '#E2DFD0',

  // ink (light theme text)
  ink: '#1A231D',
  inkSoft: '#5E6B62',

  // night (dark theme surfaces — deep green-black, not pure black)
  night: '#0C1510',
  nightCard: '#16231B',
  nightLine: '#26382C',
  nightText: '#EDEAE0',
  nightTextSoft: '#95A39A',

  // the scoreboard (identical in both themes)
  monster: '#1E4634',
  monsterEdge: '#316049',
  monsterTextSoft: '#A8C2B1',

  // scoreboard bulbs
  bulb: '#FFB53C',
  bulbDeep: '#8A6100', // amber that survives on light backgrounds

  // outcome hues
  grass: '#2E7A4C',
  grassBright: '#5BBB80',
  clay: '#A84E28',
  clayBright: '#E07A50',
  // "bunting blue" — sacrifice plays give yourself up for the team
  bunting: '#3D6BA8',
  buntingBright: '#6293D6',

  danger: '#AC3B28',
  dangerBright: '#E06952',
} as const;

export const fonts = {
  display: 'BarlowCondensed_600SemiBold',
  displayBold: 'BarlowCondensed_700Bold',
  body: 'Barlow_400Regular',
  bodyMedium: 'Barlow_500Medium',
  bodySemiBold: 'Barlow_600SemiBold',
  mono: 'IBMPlexMono_500Medium',
  monoSemiBold: 'IBMPlexMono_600SemiBold',
  monoBold: 'IBMPlexMono_700Bold',
} as const;

export const spacing = { xs: 4, s: 8, m: 12, l: 16, xl: 24, xxl: 32 } as const;
export const radius = { s: 8, m: 12, l: 16 } as const;

export interface GroupColors {
  fg: string;
  pressedBg: string;
  pressedFg: string;
}

export interface Theme {
  isDark: boolean;
  colors: {
    bg: string;
    card: string;
    line: string;
    text: string;
    textSoft: string;
    // the scoreboard panel — constant across themes
    panel: string;
    panelEdge: string;
    panelText: string;
    panelTextSoft: string;
    accent: string; // amber bulbs on the panel
    // primary action (Start Game, etc.)
    primary: string;
    primaryText: string;
    danger: string;
    toastBg: string;
    toastText: string;
    group: Record<OutcomeGroup, GroupColors>;
    /**
     * Chart palette — validated per theme with the dataviz six-checks script
     * (lightness band, chroma floor, CVD separation, surface contrast).
     * Don't swap these for the UI hues; they're tuned to the chart surface.
     */
    chart: {
      avg: string;
      ops: string;
      groups: Record<OutcomeGroup, string>;
    };
  };
}

const scoreboard = {
  panel: palette.monster,
  panelEdge: palette.monsterEdge,
  panelText: palette.chalk,
  panelTextSoft: palette.monsterTextSoft,
  accent: palette.bulb,
};

export const lightTheme: Theme = {
  isDark: false,
  colors: {
    bg: palette.chalk,
    card: palette.chalkCard,
    line: palette.chalkLine,
    text: palette.ink,
    textSoft: palette.inkSoft,
    ...scoreboard,
    primary: palette.bulb,
    primaryText: palette.ink,
    danger: palette.danger,
    toastBg: palette.ink,
    toastText: palette.chalk,
    group: {
      hit: { fg: palette.grass, pressedBg: palette.grass, pressedFg: palette.chalkCard },
      onBase: { fg: palette.bulbDeep, pressedBg: palette.bulb, pressedFg: palette.ink },
      out: { fg: palette.clay, pressedBg: palette.clay, pressedFg: palette.chalkCard },
      sacrifice: { fg: palette.bunting, pressedBg: palette.bunting, pressedFg: palette.chalkCard },
    },
    chart: {
      avg: '#2E7A4C',
      ops: '#8A6100',
      groups: { hit: '#2E7A4C', onBase: '#8A6100', out: '#993F1E', sacrifice: '#3D6BA8' },
    },
  },
};

export const darkTheme: Theme = {
  isDark: true,
  colors: {
    bg: palette.night,
    card: palette.nightCard,
    line: palette.nightLine,
    text: palette.nightText,
    textSoft: palette.nightTextSoft,
    ...scoreboard,
    primary: palette.bulb,
    primaryText: palette.ink,
    danger: palette.dangerBright,
    toastBg: '#2C4033',
    toastText: palette.chalk,
    group: {
      hit: { fg: palette.grassBright, pressedBg: palette.grass, pressedFg: palette.chalkCard },
      onBase: { fg: palette.bulb, pressedBg: palette.bulb, pressedFg: palette.ink },
      out: { fg: palette.clayBright, pressedBg: palette.clay, pressedFg: palette.chalkCard },
      sacrifice: {
        fg: palette.buntingBright,
        pressedBg: palette.bunting,
        pressedFg: palette.chalkCard,
      },
    },
    chart: {
      avg: '#3FA065',
      ops: '#C08021',
      groups: { hit: '#3FA065', onBase: '#C08021', out: '#D06A3F', sacrifice: '#6293D6' },
    },
  },
};
