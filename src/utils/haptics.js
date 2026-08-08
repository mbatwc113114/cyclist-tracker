export const Haptics = {
  _canVibrate: () => typeof navigator !== 'undefined' && 'vibrate' in navigator,

  light: () => {
    if (Haptics._canVibrate()) navigator.vibrate(10);
  },
  
  medium: () => {
    if (Haptics._canVibrate()) navigator.vibrate(20);
  },
  
  success: () => {
    if (Haptics._canVibrate()) navigator.vibrate([15, 50, 20]);
  },
  
  warning: () => {
    if (Haptics._canVibrate()) navigator.vibrate([20, 30, 20, 30, 30]);
  }
};
