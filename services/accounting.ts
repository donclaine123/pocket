import type { BudgetGroup, CategoryKey, Txn } from "../types/transaction";

export type SalaryAllocationPlan = {
  needs: number;
  wants: number;
  savings: number;
  buffer: number;
};

export type SalaryBudgetSummary = SalaryAllocationPlan & {
  salaryIncome: number;
  needsBalance: number;
  wantsBalance: number;
};

const DEFAULT_BUDGET_GROUPS: Partial<Record<CategoryKey, BudgetGroup>> = {
  groceries: "needs",
  transportation: "needs",
  bills: "needs",
  health: "needs",
  food_beverage: "wants",
  shopping: "wants",
  fun: "wants",
  travel: "wants",
  other_expense: "wants",
  coffee: "wants",
  dining: "wants",
  snacks: "wants",
};

export function getDefaultBudgetGroup(category: CategoryKey): BudgetGroup {
  return DEFAULT_BUDGET_GROUPS[category] ?? "wants";
}

export function getTransactionBudgetGroup(
  txn: Pick<Txn, "category" | "budgetGroup">
): BudgetGroup | undefined {
  if (txn.category === "discrepancy") return undefined;
  return txn.budgetGroup === "needs" || txn.budgetGroup === "wants"
    ? txn.budgetGroup
    : getDefaultBudgetGroup(txn.category);
}

export function getSalaryBudget(
  txns: Pick<Txn, "type" | "category" | "amount" | "budgetGroup">[],
  plan: SalaryAllocationPlan
): SalaryBudgetSummary {
  let salaryIncome = 0;
  let needsSpent = 0;
  let wantsSpent = 0;
  for (const txn of txns) {
    if (txn.type === "income" && txn.category === "salary") {
      salaryIncome += txn.amount;
    } else if (txn.type === "expense" && txn.category !== "discrepancy") {
      const group = getTransactionBudgetGroup(txn);
      if (group === "needs") needsSpent += txn.amount;
      else wantsSpent += txn.amount;
    }
  }
  // shortcut: all salary uses the current percentages; save payday allocations if historical rates must stay fixed.
  return {
    ...plan,
    salaryIncome,
    needsBalance: Math.round((salaryIncome * plan.needs / 100 - needsSpent) * 100) / 100,
    wantsBalance: Math.round((salaryIncome * plan.wants / 100 - wantsSpent) * 100) / 100,
  };
}

export function getEmergencyReserve(
  txns: Pick<Txn, "type" | "category" | "amount">[],
  plan: { savings: number }
): number {
  const salary = txns.reduce(
    (total, txn) => total + (txn.type === "income" && txn.category === "salary" ? txn.amount : 0),
    0
  );
  return Math.max(0, Math.round(salary * plan.savings) / 100);
}

export function getAvailableBalance(
  txns: Pick<Txn, "type" | "category" | "amount">[],
  plan: { savings: number }
): number {
  const balance = txns.reduce((total, txn) => {
    if (txn.type === "adjustment") return total + txn.amount;
    if (txn.category === "discrepancy") {
      return total + (txn.type === "income" ? txn.amount : -txn.amount);
    }
    if (txn.type === "income") return total + txn.amount;
    if (txn.type === "expense") return total - txn.amount;
    return total;
  }, 0);
  return balance - getEmergencyReserve(txns, plan);
}
