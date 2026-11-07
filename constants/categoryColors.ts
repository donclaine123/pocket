export interface CategoryColor {
  key: string;
  color: string;        // Vibrant primary color (sticker background, active chip, donut slice)
  pillBg: string;       // Soft tinted background for category badges & unselected chips
  pillBorder: string;   // Subtle matching border for category badges
  pillText: string;     // Contrast text on pillBg
  contrastText: string; // High-contrast text on color (#3B3330 or #FFFDF7)
  bg: string;           // Backward-compatible alias for color
  text: string;         // Backward-compatible alias for contrastText
}

export const CATEGORY_COLORS: Record<string, CategoryColor> = {
  // Expense categories
  food_beverage: {
    key: "food_beverage",
    color: "#F59E0B", // Amber Marigold
    pillBg: "#FEF3C7",
    pillBorder: "#FCD34D",
    pillText: "#92400E",
    contrastText: "#3B3330",
    bg: "#F59E0B",
    text: "#3B3330",
  },
  groceries: {
    key: "groceries",
    color: "#10B981", // Fresh Emerald / Jade
    pillBg: "#D1FAE5",
    pillBorder: "#6EE7B7",
    pillText: "#065F46",
    contrastText: "#3B3330",
    bg: "#10B981",
    text: "#3B3330",
  },
  transportation: {
    key: "transportation",
    color: "#0EA5E9", // Sky Blue
    pillBg: "#E0F2FE",
    pillBorder: "#7DD3FC",
    pillText: "#0369A1",
    contrastText: "#FFFDF7",
    bg: "#0EA5E9",
    text: "#FFFDF7",
  },
  bills: {
    key: "bills",
    color: "#2563EB", // Royal Cobalt Blue
    pillBg: "#DBEAFE",
    pillBorder: "#93C5FD",
    pillText: "#1E40AF",
    contrastText: "#FFFDF7",
    bg: "#2563EB",
    text: "#FFFDF7",
  },
  shopping: {
    key: "shopping",
    color: "#D946EF", // Vivid Magenta / Fuchsia
    pillBg: "#FAE8FF",
    pillBorder: "#F0ABFC",
    pillText: "#86198F",
    contrastText: "#FFFDF7",
    bg: "#D946EF",
    text: "#FFFDF7",
  },
  fun: {
    key: "fun",
    color: "#8B5CF6", // Electric Purple
    pillBg: "#EDE9FE",
    pillBorder: "#C4B5FD",
    pillText: "#5B21B6",
    contrastText: "#FFFDF7",
    bg: "#8B5CF6",
    text: "#FFFDF7",
  },
  travel: {
    key: "travel",
    color: "#06B6D4", // Cyan / Aqua
    pillBg: "#CFFAFE",
    pillBorder: "#67E8F9",
    pillText: "#155E75",
    contrastText: "#3B3330",
    bg: "#06B6D4",
    text: "#3B3330",
  },
  health: {
    key: "health",
    color: "#EF4444", // Ruby Red
    pillBg: "#FEE2E2",
    pillBorder: "#FCA5A5",
    pillText: "#991B1B",
    contrastText: "#FFFDF7",
    bg: "#EF4444",
    text: "#FFFDF7",
  },
  other_expense: {
    key: "other_expense",
    color: "#64748B", // Slate Pebble
    pillBg: "#F1F5F9",
    pillBorder: "#CBD5E1",
    pillText: "#334155",
    contrastText: "#FFFDF7",
    bg: "#64748B",
    text: "#FFFDF7",
  },

  // Income categories
  salary: {
    key: "salary",
    color: "#059669", // Deep Forest Green
    pillBg: "#ECFDF5",
    pillBorder: "#A7F3D0",
    pillText: "#064E3B",
    contrastText: "#FFFDF7",
    bg: "#059669",
    text: "#FFFDF7",
  },
  freelance: {
    key: "freelance",
    color: "#6366F1", // Royal Indigo
    pillBg: "#EEF2FF",
    pillBorder: "#A5B4FC",
    pillText: "#3730A3",
    contrastText: "#FFFDF7",
    bg: "#6366F1",
    text: "#FFFDF7",
  },
  gift: {
    key: "gift",
    color: "#EC4899", // Bubblegum Pink
    pillBg: "#FCE7F3",
    pillBorder: "#F9A8D4",
    pillText: "#9D174D",
    contrastText: "#FFFDF7",
    bg: "#EC4899",
    text: "#FFFDF7",
  },
  bonus: {
    key: "bonus",
    color: "#EAB308", // Golden Yellow
    pillBg: "#FEF9C3",
    pillBorder: "#FDE047",
    pillText: "#854D0E",
    contrastText: "#3B3330",
    bg: "#EAB308",
    text: "#3B3330",
  },
  investments: {
    key: "investments",
    color: "#84CC16", // Lime Chartreuse
    pillBg: "#ECFCCB",
    pillBorder: "#BEF264",
    pillText: "#3F6212",
    contrastText: "#3B3330",
    bg: "#84CC16",
    text: "#3B3330",
  },
  selling: {
    key: "selling",
    color: "#F97316", // Tangerine Orange
    pillBg: "#FFEDD5",
    pillBorder: "#FDBA74",
    pillText: "#9A3412",
    contrastText: "#FFFDF7",
    bg: "#F97316",
    text: "#FFFDF7",
  },
  other_income: {
    key: "other_income",
    color: "#A855F7", // Amethyst Violet
    pillBg: "#F3E8FF",
    pillBorder: "#D8B4FE",
    pillText: "#6B21A8",
    contrastText: "#FFFDF7",
    bg: "#A855F7",
    text: "#FFFDF7",
  },
  discrepancy: {
    key: "discrepancy",
    color: "#64748B",
    pillBg: "#F1F5F9",
    pillBorder: "#CBD5E1",
    pillText: "#334155",
    contrastText: "#FFFDF7",
    bg: "#64748B",
    text: "#FFFDF7",
  },

  // Legacy categories
  coffee: {
    key: "coffee",
    color: "#B45309", // Caramel Roast
    pillBg: "#FEF3C7",
    pillBorder: "#FCD34D",
    pillText: "#78350F",
    contrastText: "#FFFDF7",
    bg: "#B45309",
    text: "#FFFDF7",
  },
  dining: {
    key: "dining",
    color: "#EA580C", // Rust Orange
    pillBg: "#FFEDD5",
    pillBorder: "#FDBA74",
    pillText: "#9A3412",
    contrastText: "#FFFDF7",
    bg: "#EA580C",
    text: "#FFFDF7",
  },
  snacks: {
    key: "snacks",
    color: "#D97706", // Cinnamon Pretzel
    pillBg: "#FEF3C7",
    pillBorder: "#FDE68A",
    pillText: "#78350F",
    contrastText: "#FFFDF7",
    bg: "#D97706",
    text: "#FFFDF7",
  },
};

/**
 * Returns complete unique color styling for any category key or legacy background name.
 */
export function getCategoryColor(keyOrBg?: string): CategoryColor {
  if (keyOrBg && CATEGORY_COLORS[keyOrBg]) {
    return CATEGORY_COLORS[keyOrBg];
  }

  // Handle legacy background names
  if (keyOrBg === "peach") {
    return {
      key: "peach",
      color: "#FF9E7E",
      pillBg: "#FFEBE4",
      pillBorder: "#FFC7B6",
      pillText: "#993C20",
      contrastText: "#FFFDF7",
      bg: "#FF9E7E",
      text: "#FFFDF7",
    };
  }
  if (keyOrBg === "mint") {
    return {
      key: "mint",
      color: "#92D8B9",
      pillBg: "#E4F7EE",
      pillBorder: "#B6E7D1",
      pillText: "#1F6547",
      contrastText: "#3B3330",
      bg: "#92D8B9",
      text: "#3B3330",
    };
  }
  if (keyOrBg === "lavender") {
    return {
      key: "lavender",
      color: "#B7A6E4",
      pillBg: "#EFEAFD",
      pillBorder: "#D3C8F3",
      pillText: "#4E3C82",
      contrastText: "#3B3330",
      bg: "#B7A6E4",
      text: "#3B3330",
    };
  }

  // Default warm butter
  return {
    key: "butter",
    color: "#F7C56B",
    pillBg: "#FEF3D6",
    pillBorder: "#FCE2A5",
    pillText: "#8A5E12",
    contrastText: "#3B3330",
    bg: "#F7C56B",
    text: "#3B3330",
  };
}
