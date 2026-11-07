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
  { id: "discrepancy-income", type: "income", category: "discrepancy", amount: 200, note: "", date: "2026-10-24" },
  { id: "discrepancy-expense", type: "expense", category: "discrepancy", amount: 100, note: "", date: "2026-10-25" },
];

test("available balance subtracts Salary reserve and applies discrepancy income or expense", () => {
  assert.equal(typeof accounting?.getAvailableBalance, "function");
  assert.equal(typeof accounting?.getEmergencyReserve, "function");
  if (!accounting) return;

  assert.equal(accounting.getEmergencyReserve(transactions, salaryPlan), 600);
  assert.equal(accounting.getAvailableBalance(transactions, salaryPlan), 3_050);
});
