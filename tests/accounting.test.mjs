import assert from "node:assert/strict";
import test from "node:test";

let accounting;
try {
  accounting = await import("../services/accounting.ts");
} catch {}

const salaryPlan = { needs: 50, wants: 30, savings: 20, buffer: 0 };
const transactions = [
  { id: "salary-1", type: "income", category: "salary", amount: 1_000, note: "", date: "2026-10-15" },
  { id: "salary-2", type: "income", category: "salary", amount: 2_000, note: "", date: "2026-10-30" },
  { id: "other-income", type: "income", category: "freelance", amount: 1_000, note: "", date: "2026-10-20" },
  { id: "expense", type: "expense", category: "groceries", amount: 500, note: "", date: "2026-10-21" },
  { id: "positive-adjustment", type: "adjustment", category: "discrepancy", amount: 100, note: "", date: "2026-10-22" },
  { id: "negative-adjustment", type: "adjustment", category: "discrepancy", amount: -50, note: "", date: "2026-10-23" },
];

test("available balance subtracts Salary reserve and includes signed discrepancy adjustments", () => {
  assert.equal(typeof accounting?.getAvailableBalance, "function");
  assert.equal(typeof accounting?.getEmergencyReserve, "function");
  if (!accounting) return;

  assert.equal(accounting.getEmergencyReserve(transactions, salaryPlan, 0), 600);
  assert.equal(accounting.getEmergencyReserve(transactions, salaryPlan, 50), 650);
  assert.equal(accounting.getEmergencyReserve(transactions, salaryPlan, -700), 0);
  assert.equal(accounting.getAvailableBalance(transactions, salaryPlan, 50), 2_900);
});
