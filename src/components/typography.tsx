import { Text, type TextProps, type TextStyle } from 'react-native';

import { fonts } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

type Props = TextProps & {
  size?: number;
  color?: string;
};

/** Condensed all-caps label — the "section painted on the outfield wall". */
export function Eyebrow({ size = 12, color, style, children, ...rest }: Props) {
  const { colors } = useTheme();
  const base: TextStyle = {
    fontFamily: fonts.displayBold,
    fontSize: size,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: color ?? colors.textSoft,
  };
  return (
    <Text {...rest} style={[base, style]}>
      {children}
    </Text>
  );
}

/** Big condensed display type — headlines, tile codes. */
export function Display({ size = 28, color, style, children, ...rest }: Props) {
  const { colors } = useTheme();
  const base: TextStyle = {
    fontFamily: fonts.display,
    fontSize: size,
    color: color ?? colors.text,
  };
  return (
    <Text {...rest} style={[base, style]}>
      {children}
    </Text>
  );
}

/** Body copy. */
export function Body({ size = 15, color, style, children, ...rest }: Props) {
  const { colors } = useTheme();
  const base: TextStyle = {
    fontFamily: fonts.body,
    fontSize: size,
    color: color ?? colors.text,
  };
  return (
    <Text {...rest} style={[base, style]}>
      {children}
    </Text>
  );
}

/** Box-score numerals — always monospace so decimals line up. */
export function Mono({ size = 16, color, style, children, ...rest }: Props) {
  const { colors } = useTheme();
  const base: TextStyle = {
    fontFamily: fonts.monoSemiBold,
    fontSize: size,
    fontVariant: ['tabular-nums'],
    color: color ?? colors.text,
  };
  return (
    <Text {...rest} style={[base, style]}>
      {children}
    </Text>
  );
}
