export type TxnType = "expense" | "income";
export type TxnKind = TxnType | "adjustment";
export type BudgetGroup = "needs" | "wants";

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
  | "discrepancy"
  // Legacy backward-compatibility tags
  | "coffee"
  | "dining"
  | "snacks";

export type Category = {
  key: CategoryKey;
  label: string;
  emoji: string;
  bg: string;
  rotate: string;
  type: TxnType;
};

export type Txn = {
  id: string;
  type: TxnKind;
  amount: number;
  category: CategoryKey;
  budgetGroup?: BudgetGroup;
  note: string;
  date: string; // ISO yyyy-mm-dd
  createdAt?: string; // ISO timestamp string
  originalCurrency?: string; // e.g. "PHP", "USD"
  rawAmount?: number;
  rawCurrency?: string;
};

export const EXPENSE_CATEGORIES: Category[] = [
  { key: "food_beverage", label: "Food & Beverages", emoji: "🍽️", bg: "food_beverage", rotate: "-3deg", type: "expense" },
  { key: "groceries", label: "Groceries", emoji: "🛒", bg: "groceries", rotate: "2deg", type: "expense" },
  { key: "transportation", label: "Transportation", emoji: "🚌", bg: "transportation", rotate: "-2deg", type: "expense" },
  { key: "bills", label: "Bills & Utilities", emoji: "💡", bg: "bills", rotate: "4deg", type: "expense" },
  { key: "shopping", label: "Shopping", emoji: "🛍️", bg: "shopping", rotate: "-3deg", type: "expense" },
  { key: "fun", label: "Fun", emoji: "🎬", bg: "fun", rotate: "5deg", type: "expense" },
  { key: "travel", label: "Travel", emoji: "✈️", bg: "travel", rotate: "-3deg", type: "expense" },
  { key: "health", label: "Health", emoji: "💊", bg: "health", rotate: "2deg", type: "expense" },
  { key: "other_expense", label: "Other", emoji: "📦", bg: "other_expense", rotate: "-2deg", type: "expense" },
];

export const INCOME_CATEGORIES: Category[] = [
  { key: "salary", label: "Salary", emoji: "💼", bg: "salary", rotate: "-2deg", type: "income" },
  { key: "freelance", label: "Freelance", emoji: "💻", bg: "freelance", rotate: "3deg", type: "income" },
  { key: "gift", label: "Gift / Allowance", emoji: "🎁", bg: "gift", rotate: "-4deg", type: "income" },
  { key: "bonus", label: "Bonus", emoji: "💰", bg: "bonus", rotate: "4deg", type: "income" },
  { key: "investments", label: "Investments", emoji: "📈", bg: "investments", rotate: "3deg", type: "income" },
  { key: "selling", label: "Selling", emoji: "🏷️", bg: "selling", rotate: "-3deg", type: "income" },
  { key: "other_income", label: "Other Income", emoji: "🪙", bg: "other_income", rotate: "2deg", type: "income" },
];

export const DISCREPANCY_CATEGORY: Category = {
  key: "discrepancy",
  label: "Discrepancy",
  emoji: "⚖️",
  bg: "discrepancy",
  rotate: "0deg",
  type: "expense",
};

export function getEntryCategories(type: TxnType): Category[] {
  return [...(type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES), DISCREPANCY_CATEGORY];
}

export const LEGACY_CATEGORIES: Category[] = [
  { key: "coffee", label: "Coffee", emoji: "☕", bg: "coffee", rotate: "-4deg", type: "expense" },
  { key: "dining", label: "Food & Dining", emoji: "🍽️", bg: "dining", rotate: "3deg", type: "expense" },
  { key: "snacks", label: "Snacks", emoji: "🍪", bg: "snacks", rotate: "4deg", type: "expense" },
];

// Active categories for display on Home filters and modal selection
export const CATEGORIES: Category[] = [
  ...EXPENSE_CATEGORIES,
  ...INCOME_CATEGORIES,
  DISCREPANCY_CATEGORY,
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

