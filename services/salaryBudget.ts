import AsyncStorage from "@react-native-async-storage/async-storage";
import { getActiveUserId } from "./syncQueue";
import { BudgetGroup, CategoryKey, Txn } from "../types/transaction";

export type SalaryAllocationPlan = {
  needs: number;
  wants: number;
  savings: number;
  buffer: number;
};

export type SalaryBudgetSummary = SalaryAllocationPlan & {
  salaryIncome: number;
  salaryIncomeMonth: string | null;
  needsBudget: number;
  wantsBudget: number;
  needsSpent: number;
  wantsSpent: number;
};

export const DEFAULT_SALARY_ALLOCATION: SalaryAllocationPlan = {
  needs: 50,
  wants: 30,
  savings: 20,
  buffer: 0,
};

async function getSalaryAllocationKey(): Promise<string> {
  const userId = await getActiveUserId();
  return userId ? `@pocket_salary_allocation_${userId}` : "@pocket_salary_allocation_guest";
}

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

export function getTransactionBudgetGroup(txn: Txn): BudgetGroup {
  return txn.budgetGroup === "needs" || txn.budgetGroup === "wants"
    ? txn.budgetGroup
    : getDefaultBudgetGroup(txn.category);
}

export function isValidSalaryAllocation(plan: SalaryAllocationPlan): boolean {
  const values = [plan.needs, plan.wants, plan.savings, plan.buffer];
  return (
    values.every((value) => Number.isFinite(value) && value >= 0 && value <= 100) &&
    Math.abs(values.reduce((total, value) => total + value, 0) - 100) < 0.01
  );
}

export async function loadSalaryAllocation(): Promise<SalaryAllocationPlan> {
  try {
    const raw = await AsyncStorage.getItem(await getSalaryAllocationKey());
    if (!raw) return DEFAULT_SALARY_ALLOCATION;
    const saved = JSON.parse(raw) as SalaryAllocationPlan;
    return isValidSalaryAllocation(saved) ? saved : DEFAULT_SALARY_ALLOCATION;
  } catch {
    return DEFAULT_SALARY_ALLOCATION;
  }
}

export async function saveSalaryAllocation(plan: SalaryAllocationPlan): Promise<void> {
  if (!isValidSalaryAllocation(plan)) {
    throw new Error("Allocation percentages must add up to 100%.");
  }
  await AsyncStorage.setItem(await getSalaryAllocationKey(), JSON.stringify(plan));
}

export function getMonthlySalaryBudget(
  txns: Txn[],
  plan: SalaryAllocationPlan,
  month?: string
): SalaryBudgetSummary {
  const now = new Date();
  const activeMonth = month ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const salaryIncomeByMonth: Record<string, number> = {};
  let needsSpent = 0;
  let wantsSpent = 0;

  for (const txn of txns) {
    const transactionMonth = txn.date.slice(0, 7);
    if (txn.type === "income" && txn.category === "salary") {
      salaryIncomeByMonth[transactionMonth] =
        (salaryIncomeByMonth[transactionMonth] || 0) + txn.amount;
    } else if (transactionMonth === activeMonth && txn.type === "expense") {
      if (getTransactionBudgetGroup(txn) === "needs") needsSpent += txn.amount;
      else wantsSpent += txn.amount;
    }
  }

  const salaryIncomeMonth =
    salaryIncomeByMonth[activeMonth] !== undefined
      ? activeMonth
      : Object.keys(salaryIncomeByMonth)
          .filter((transactionMonth) => transactionMonth < activeMonth)
          .sort()
          .pop() ?? null;
  const salaryIncome = salaryIncomeMonth
    ? salaryIncomeByMonth[salaryIncomeMonth]
    : 0;

  return {
    ...plan,
    salaryIncome,
    salaryIncomeMonth,
    needsBudget: (salaryIncome * plan.needs) / 100,
    wantsBudget: (salaryIncome * plan.wants) / 100,
    needsSpent,
    wantsSpent,
  };
}
