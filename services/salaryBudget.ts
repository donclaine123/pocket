import AsyncStorage from "@react-native-async-storage/async-storage";
import { getActiveUserId } from "./syncQueue";
import { BudgetGroup, CategoryKey, Txn } from "../types/transaction";
import { DEFAULT_CURRENCY } from "../constants/currencies";
import { convertAmount, getCachedRates, loadConversionEnabled } from "./exchangeService";

export type SalaryAllocationPlan = {
  needs: number;
  wants: number;
  savings: number;
  buffer: number;
};

export type SalaryBudgetSummary = SalaryAllocationPlan & {
  salaryIncome: number;
  salaryIncomeMonth: string | null;
  needsCarryover: number;
  wantsCarryover: number;
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

async function getReserveCorrectionKey(): Promise<string> {
  const userId = await getActiveUserId();
  return userId ? `@pocket_reserve_correction_${userId}` : "@pocket_reserve_correction_guest";
}

export async function loadEmergencyReserveCorrection(currencyCode = DEFAULT_CURRENCY.code): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(await getReserveCorrectionKey());
    if (!raw) return 0;
    const saved = JSON.parse(raw);
    const amount = typeof saved === "number" ? saved : Number(saved.amount);
    if (!Number.isFinite(amount)) return 0;
    const sourceCurrency = typeof saved === "number" ? currencyCode : saved.currencyCode || currencyCode;
    if (sourceCurrency === currencyCode || !(await loadConversionEnabled())) return amount;
    return convertAmount(amount, sourceCurrency, currencyCode, await getCachedRates());
  } catch {
    return 0;
  }
}

export async function saveEmergencyReserveCorrection(amount: number, currencyCode = DEFAULT_CURRENCY.code): Promise<void> {
  if (!Number.isFinite(amount)) throw new Error("Reserve correction must be a number.");
  await AsyncStorage.setItem(
    await getReserveCorrectionKey(),
    JSON.stringify({ amount, currencyCode })
  );
}

async function getSalaryAllocationKey(): Promise<string> {
  const userId = await getActiveUserId();
  return userId ? `@pocket_salary_allocation_${userId}` : "@pocket_salary_allocation_guest";
}

function currentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export async function loadSalaryBudgetStartMonth(): Promise<string> {
  try {
    const userId = await getActiveUserId();
    const key = userId
      ? `@pocket_salary_budget_start_${userId}`
      : "@pocket_salary_budget_start_guest";
    const saved = await AsyncStorage.getItem(key);
    if (saved && /^\d{4}-\d{2}$/.test(saved)) return saved;
    const startMonth = currentMonthKey();
    await AsyncStorage.setItem(key, startMonth);
    return startMonth;
  } catch {
    return currentMonthKey();
  }
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
  month?: string,
  startMonth?: string
): SalaryBudgetSummary {
  const activeMonth = month ?? currentMonthKey();
  const budgetStartMonth = startMonth && startMonth <= activeMonth ? startMonth : activeMonth;
  const salaryIncomeByMonth = new Map<string, number>();
  const expenseByMonth = new Map<string, { needs: number; wants: number }>();

  for (const txn of txns) {
    if (typeof txn.date !== "string") continue;
    const transactionMonth = txn.date.slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(transactionMonth)) continue;
    if (txn.type === "income" && txn.category === "salary") {
      salaryIncomeByMonth.set(
        transactionMonth,
        (salaryIncomeByMonth.get(transactionMonth) || 0) + txn.amount
      );
    } else if (
      transactionMonth >= budgetStartMonth &&
      transactionMonth <= activeMonth &&
      txn.type === "expense"
    ) {
      const monthExpenses = expenseByMonth.get(transactionMonth) || { needs: 0, wants: 0 };
      const group = getTransactionBudgetGroup(txn);
      monthExpenses[group] += txn.amount;
      expenseByMonth.set(transactionMonth, monthExpenses);
    }
  }

  const fallbackSalaryMonth = Array.from(salaryIncomeByMonth.keys())
    .filter((transactionMonth) => transactionMonth < budgetStartMonth)
    .sort()
    .pop() ?? null;
  let needsCarryover = 0;
  let wantsCarryover = 0;
  let monthCursor = budgetStartMonth;
  let salaryIncome = 0;
  let salaryIncomeMonth: string | null = null;
  let needsSpent = 0;
  let wantsSpent = 0;
  let needsBudget = 0;
  let wantsBudget = 0;
  let currentNeedsCarryover = 0;
  let currentWantsCarryover = 0;

  while (monthCursor <= activeMonth) {
    const hasSalaryThisMonth = salaryIncomeByMonth.has(monthCursor);
    const isStartingMonthFallback =
      monthCursor === budgetStartMonth && !hasSalaryThisMonth && fallbackSalaryMonth !== null;
    const allocatedSalary = hasSalaryThisMonth
      ? salaryIncomeByMonth.get(monthCursor) || 0
      : isStartingMonthFallback && fallbackSalaryMonth
        ? salaryIncomeByMonth.get(fallbackSalaryMonth) || 0
        : 0;
    const expenses = expenseByMonth.get(monthCursor) || { needs: 0, wants: 0 };
    if (monthCursor === activeMonth) {
      currentNeedsCarryover = needsCarryover;
      currentWantsCarryover = wantsCarryover;
    }
    needsBudget = needsCarryover + (allocatedSalary * plan.needs) / 100;
    wantsBudget = wantsCarryover + (allocatedSalary * plan.wants) / 100;
    needsSpent = expenses.needs;
    wantsSpent = expenses.wants;

    if (monthCursor === activeMonth) {
      salaryIncome = allocatedSalary;
      salaryIncomeMonth = hasSalaryThisMonth
        ? monthCursor
        : isStartingMonthFallback
          ? fallbackSalaryMonth
          : null;
    }

    needsCarryover = Math.max(0, needsBudget - needsSpent);
    wantsCarryover = Math.max(0, wantsBudget - wantsSpent);

    const [year, monthNumber] = monthCursor.split("-").map(Number);
    const nextMonth = new Date(year, monthNumber, 1);
    monthCursor = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, "0")}`;
  }

  // shortcut: past months use the current allocation percentages; persist monthly plans if edits must preserve historic rates.

  return {
    ...plan,
    salaryIncome,
    salaryIncomeMonth,
    needsCarryover: currentNeedsCarryover,
    wantsCarryover: currentWantsCarryover,
    needsBudget,
    wantsBudget,
    needsSpent,
    wantsSpent,
  };
}
