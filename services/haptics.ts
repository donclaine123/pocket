/**
 * Haptics completely disabled per user preference.
 * All haptic calls are safe no-ops to ensure 100% silent and vibration-free interaction.
 */
export const safeHaptic = {
  impact: async (_style?: any) => {},
  light: async () => {},
  success: async () => {},
  warning: async () => {},
  selection: async () => {},
};
