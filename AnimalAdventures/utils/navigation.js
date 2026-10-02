import { useEffect } from 'react';
import { BackHandler } from 'react-native';

/**
 * Routes the Android hardware back button to `onBack` instead of the OS
 * default. Screens here are swapped by state in App rather than pushed onto
 * a navigator, so without this a child pressing back lands on the phone's
 * home screen instead of this app's main menu.
 *
 * @param {Function} onBack - Called instead of the default back behavior.
 */
export function useBackToMenu(onBack) {
  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        onBack();
        return true;
      }
    );
    return () => subscription.remove();
  }, [onBack]);
}
