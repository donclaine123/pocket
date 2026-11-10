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
  needsSpent: number;
  wantsSpent: number;
  needsBudget: number;
  wantsBudget: number;
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
  txns: Txn[],
  plan: SalaryAllocationPlan
): SalaryBudgetSummary {
  let salaryIncome = 0;
  let needsSpent = 0;
  let wantsSpent = 0;
  let needsPaydaySpent = 0;
  let wantsPaydaySpent = 0;
  const compare = (a: Txn, b: Txn) =>
    (a.date || "").localeCompare(b.date || "") ||
    (Date.parse(a.createdAt || "") || 0) - (Date.parse(b.createdAt || "") || 0);
  let latestSalary: Txn | undefined;
  for (const txn of txns) {
    if (txn.type === "income" && txn.category === "salary" &&
        (!latestSalary || compare(txn, latestSalary) > 0)) {
      latestSalary = txn;
    }
  }
  for (const txn of txns) {
    if (txn.type === "income" && txn.category === "salary") {
      salaryIncome += txn.amount;
    } else if (txn.type === "expense" && txn.category !== "discrepancy") {
      const group = getTransactionBudgetGroup(txn);
      if (group === "needs") needsSpent += txn.amount;
      else wantsSpent += txn.amount;
      // shortcut: missing timestamps limit same-day payday ordering; save entry times for exact boundaries.
      if (!latestSalary || compare(txn, latestSalary) >= 0) {
        if (group === "needs") needsPaydaySpent += txn.amount;
        else wantsPaydaySpent += txn.amount;
      }
    }
  }
  // shortcut: all salary uses the current percentages; save payday allocations if historical rates must stay fixed.
  const needsBalance = Math.round((salaryIncome * plan.needs / 100 - needsSpent) * 100) / 100;
  const wantsBalance = Math.round((salaryIncome * plan.wants / 100 - wantsSpent) * 100) / 100;
  return {
    ...plan,
    salaryIncome,
    needsBalance,
    wantsBalance,
    needsSpent: Math.round(needsPaydaySpent * 100) / 100,
    wantsSpent: Math.round(wantsPaydaySpent * 100) / 100,
    needsBudget: Math.round((needsBalance + needsPaydaySpent) * 100) / 100,
    wantsBudget: Math.round((wantsBalance + wantsPaydaySpent) * 100) / 100,
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
