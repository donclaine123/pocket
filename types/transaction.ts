export type TxnType = "expense" | "income";

export type CategoryKey =
  // Expense tags
  | "food_beverage"
  | "groceries"
  | "transportation"
  | "bills"
  | "shopping"
  | "fun"
  | "travel"
  | "health"
  | "other_expense"
  // Income tags
  | "salary"
  | "freelance"
  | "gift"
  | "bonus"
  | "investments"
  | "selling"
  | "other_income"
  // Legacy backward-compatibility tags
  | "coffee"
  | "dining"
  | "snacks";

export type Category = {
  key: CategoryKey;
  label: string;
  emoji: string;
  bg: "mint" | "lavender" | "butter" | "peach";
  rotate: string;
  type: TxnType;
};

export type Txn = {
  id: string;
  type: TxnType;
  amount: number;
  category: CategoryKey;
  note: string;
  date: string; // ISO yyyy-mm-dd
  originalCurrency?: string; // e.g. "PHP", "USD"
  rawAmount?: number;
  rawCurrency?: string;
};

export const EXPENSE_CATEGORIES: Category[] = [
  { key: "food_beverage", label: "Food & Beverages", emoji: "🍽️", bg: "butter", rotate: "-3deg", type: "expense" },
  { key: "groceries", label: "Groceries", emoji: "🛒", bg: "lavender", rotate: "2deg", type: "expense" },
  { key: "transportation", label: "Transportation", emoji: "🚌", bg: "lavender", rotate: "-2deg", type: "expense" },
  { key: "bills", label: "Bills & Utilities", emoji: "💡", bg: "peach", rotate: "4deg", type: "expense" },
  { key: "shopping", label: "Shopping", emoji: "🛍️", bg: "butter", rotate: "-3deg", type: "expense" },
  { key: "fun", label: "Fun", emoji: "🎬", bg: "mint", rotate: "5deg", type: "expense" },
  { key: "travel", label: "Travel", emoji: "✈️", bg: "peach", rotate: "-3deg", type: "expense" },
  { key: "health", label: "Health", emoji: "💊", bg: "mint", rotate: "2deg", type: "expense" },
  { key: "other_expense", label: "Other", emoji: "📦", bg: "lavender", rotate: "-2deg", type: "expense" },
];

export const INCOME_CATEGORIES: Category[] = [
  { key: "salary", label: "Salary", emoji: "💼", bg: "mint", rotate: "-2deg", type: "income" },
  { key: "freelance", label: "Freelance", emoji: "💻", bg: "lavender", rotate: "3deg", type: "income" },
  { key: "gift", label: "Gift / Allowance", emoji: "🎁", bg: "peach", rotate: "-4deg", type: "income" },
  { key: "bonus", label: "Bonus", emoji: "💰", bg: "butter", rotate: "4deg", type: "income" },
  { key: "investments", label: "Investments", emoji: "📈", bg: "mint", rotate: "3deg", type: "income" },
  { key: "selling", label: "Selling", emoji: "🏷️", bg: "lavender", rotate: "-3deg", type: "income" },
  { key: "other_income", label: "Other Income", emoji: "🪙", bg: "butter", rotate: "2deg", type: "income" },
];

export const LEGACY_CATEGORIES: Category[] = [
  { key: "coffee", label: "Coffee", emoji: "☕", bg: "butter", rotate: "-4deg", type: "expense" },
  { key: "dining", label: "Food & Dining", emoji: "🍽️", bg: "butter", rotate: "3deg", type: "expense" },
  { key: "snacks", label: "Snacks", emoji: "🍪", bg: "butter", rotate: "4deg", type: "expense" },
];

// Active categories for display on Home filters and modal selection
export const CATEGORIES: Category[] = [
  ...EXPENSE_CATEGORIES,
  ...INCOME_CATEGORIES,
];

// Complete category catalog including legacy tags for backward-compatible rendering
export const ALL_CATEGORIES: Category[] = [
  ...CATEGORIES,
  ...LEGACY_CATEGORIES,
];

function thisMonthDate(day: number): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}-${String(day).padStart(2, "0")}`;
}

export const SEED_DATA: Txn[] = [];

