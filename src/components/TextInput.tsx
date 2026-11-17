/**
 * The app's text input. On phones it's React Native's own; the web build
 * uses TextInput.web.tsx, which adds `onEndEditing` (React Native Web
 * doesn't have it, and the app saves edits there).
 */
export { TextInput } from 'react-native';
