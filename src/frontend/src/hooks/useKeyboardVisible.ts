import { useEffect, useState } from 'react';
import { Keyboard, KeyboardEvent, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function keyboardOverlapHeight(event: KeyboardEvent, safeAreaBottom: number) {
  const rawHeight = event.endCoordinates?.height ?? 0;
  const bottomInset = Platform.OS === 'ios' ? safeAreaBottom : 0;

  return Math.max(0, rawHeight - bottomInset);
}

export function useKeyboardMetrics() {
  const insets = useSafeAreaInsets();
  const [state, setState] = useState({
    keyboardHeight: 0,
    keyboardVisible: false,
  });

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSubscription = Keyboard.addListener(showEvent, (event) => {
      setState({
        keyboardHeight: keyboardOverlapHeight(event, insets.bottom),
        keyboardVisible: true,
      });
    });
    const hideSubscription = Keyboard.addListener(hideEvent, () => {
      setState({
        keyboardHeight: 0,
        keyboardVisible: false,
      });
    });
    const frameSubscription =
      Platform.OS === 'ios'
        ? Keyboard.addListener('keyboardWillChangeFrame', (event) => {
            setState({
              keyboardHeight: keyboardOverlapHeight(event, insets.bottom),
              keyboardVisible: event.endCoordinates.height > 0,
            });
          })
        : null;

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
      frameSubscription?.remove();
    };
  }, [insets.bottom]);

  return state;
}

export function useKeyboardVisible() {
  return useKeyboardMetrics().keyboardVisible;
}
