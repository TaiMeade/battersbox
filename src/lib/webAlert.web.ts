import { Alert, type AlertButton } from 'react-native';

/**
 * React Native for Web's Alert.alert does nothing, which would make every
 * "Delete this?" in the app silently do nothing. Map it to the browser's own
 * dialogs: one action plus Cancel becomes confirm(), anything else alert().
 */
export function installWebAlert(): void {
  Alert.alert = (title: string, message?: string, buttons?: AlertButton[]) => {
    const text = message ? `${title}\n\n${message}` : title;
    const actions = (buttons ?? []).filter((b) => b.style !== 'cancel');
    const cancel = (buttons ?? []).find((b) => b.style === 'cancel');
    if (!buttons || buttons.length === 0) {
      window.alert(text);
      return;
    }
    if (actions.length === 1 && cancel) {
      if (window.confirm(text)) actions[0]!.onPress?.();
      else cancel.onPress?.();
      return;
    }
    if (actions.length === 1) {
      window.alert(text);
      actions[0]!.onPress?.();
      return;
    }
    // Several choices: offer them one at a time, in order.
    for (const action of actions) {
      if (window.confirm(`${text}\n\n${action.text ?? 'OK'}?`)) {
        action.onPress?.();
        return;
      }
    }
    cancel?.onPress?.();
  };
}
