import { forwardRef } from 'react';
import {
  TextInput as RNTextInput,
  type NativeSyntheticEvent,
  type TextInputEndEditingEventData,
  type TextInputProps,
} from 'react-native';

/**
 * React Native Web has no `onEndEditing`, so every "save when you're done
 * typing" field would never save. Leaving the field (blur) is the same
 * moment on the web; pass its text the way phones do.
 */
export const TextInput = forwardRef<RNTextInput, TextInputProps>(function TextInput(
  { onEndEditing, onBlur, ...rest },
  ref,
) {
  return (
    <RNTextInput
      ref={ref}
      {...rest}
      onBlur={(e) => {
        onBlur?.(e);
        if (onEndEditing) {
          const text = (e.target as unknown as HTMLInputElement | null)?.value ?? '';
          onEndEditing({ nativeEvent: { text } } as NativeSyntheticEvent<TextInputEndEditingEventData>);
        }
      }}
    />
  );
});
