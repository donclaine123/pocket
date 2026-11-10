import AsyncStorage from "@react-native-async-storage/async-storage";
import { getActiveUserId } from "./syncQueue";
import type { SalaryAllocationPlan } from "./accounting";
export type { SalaryAllocationPlan, SalaryBudgetSummary } from "./accounting";
export { getSalaryBudget, getDefaultBudgetGroup, getTransactionBudgetGroup } from "./accounting";

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
