import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

export const safeHaptic = {
  impact: async (style = Haptics.ImpactFeedbackStyle.Medium) => {
    if (Platform.OS !== "web") {
      try {
        await Haptics.impactAsync(style);
      } catch {}
    }
  },
  light: async () => {
    if (Platform.OS !== "web") {
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {}
    }
  },
  success: async () => {
    if (Platform.OS !== "web") {
      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}
    }
  },
  warning: async () => {
    if (Platform.OS !== "web") {
      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      } catch {}
    }
  },
  selection: async () => {
    if (Platform.OS !== "web") {
      try {
        await Haptics.selectionAsync();
      } catch {}
    }
  },
};
