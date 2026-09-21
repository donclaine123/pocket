import { Platform, StyleSheet } from "react-native";

export const COLORS = {
  paper: "#F7F0E3",
  ink: "#3B3330",
  inkSoft: "#A79A8C",
  inkMuted: "#EADBCC",
  peach: "#FF9E7E",
  mint: "#92D8B9",
  lavender: "#B7A6E4",
  butter: "#F7C56B",
  cream: "#FFFDF7",
  cardBorder: "#3B3330",
};

export const FONTS = {
  display: "Fredoka_600SemiBold",
  displayBold: "Fredoka_700Bold",
  body: "DMSans_400Regular",
  bodyMedium: "DMSans_500Medium",
  bodyBold: "DMSans_700Bold",
};

export const STYLES = StyleSheet.create({
  card: {
    backgroundColor: COLORS.cream,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: COLORS.cardBorder,
    padding: 20,
    ...Platform.select({
      ios: {
        shadowColor: COLORS.ink,
        shadowOffset: { width: 3, height: 4 },
        shadowOpacity: 1,
        shadowRadius: 0,
      },
      web: {
        boxShadow: "3px 4px 0px #3B3330",
      },
      android: {
        elevation: 4,
      },
    }),
  },
  chip: {
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: "rgba(59, 51, 48, 0.2)",
    paddingHorizontal: 14,
    paddingVertical: 7,
    flexDirection: "row",
    alignItems: "center",
  },
  buttonPrimary: {
    backgroundColor: COLORS.peach,
    borderRadius: 9999,
    borderWidth: 2,
    borderColor: COLORS.cardBorder,
    paddingVertical: 14,
    paddingHorizontal: 26,
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({
      ios: {
        shadowColor: COLORS.ink,
        shadowOffset: { width: 2, height: 4 },
        shadowOpacity: 1,
        shadowRadius: 0,
      },
      web: {
        boxShadow: "2px 4px 0px #3B3330",
      },
      android: {
        elevation: 5,
      },
    }),
  },
});
