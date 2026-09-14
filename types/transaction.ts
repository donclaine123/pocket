export type TxnType = "expense" | "income";

export type CategoryKey =
  | "coffee"
  | "groceries"
  | "transportation"
  | "fun"
  | "travel"
  | "salary"
  | "snacks";

export type Category = {
  key: CategoryKey;
  label: string;
  emoji: string;
  bg: "mint" | "lavender" | "butter" | "peach";
  rotate: string;
};

export type Txn = {
  id: string;
  type: TxnType;
  amount: number;
  category: CategoryKey;
  note: string;
  date: string; // ISO yyyy-mm-dd
};

export const CATEGORIES: Category[] = [
  { key: "coffee", label: "Coffee", emoji: "☕", bg: "mint", rotate: "-4deg" },
  { key: "groceries", label: "Groceries", emoji: "🛒", bg: "lavender", rotate: "3deg" },
  { key: "transportation", label: "Transportation", emoji: "🚌", bg: "lavender", rotate: "-2deg" },
  { key: "fun", label: "Fun", emoji: "🎬", bg: "butter", rotate: "5deg" },
  { key: "travel", label: "Travel", emoji: "✈️", bg: "peach", rotate: "-3deg" },
  { key: "salary", label: "Salary", emoji: "💼", bg: "mint", rotate: "-2deg" },
  { key: "snacks", label: "Snacks", emoji: "🍪", bg: "butter", rotate: "4deg" },
];

function thisMonthDate(day: number): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}-${String(day).padStart(2, "0")}`;
}

export const SEED_DATA: Txn[] = [];

