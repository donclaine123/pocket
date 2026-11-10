import assert from "node:assert/strict";
import test from "node:test";
import { getAvailableBalance, getSalaryBudget } from "../services/accounting.ts";

const plan = { needs: 50, wants: 30, savings: 20, buffer: 0 };
const salary = (amount, date) => ({ type: "income", category: "salary", amount, date });
const expense = (amount, category, date, budgetGroup) => ({
  type: "expense", category, amount, date, budgetGroup,
});

test("each payday adds to the remaining balance across months", () => {
  const txns = [salary(12_000, "2026-10-15"), expense(2_500, "groceries", "2026-10-20")];
  assert.equal(getSalaryBudget(txns, plan).needsBalance, 3_500);
  txns.push(salary(12_000, "2026-10-30"));
  assert.equal(getSalaryBudget(txns, plan).needsBalance, 9_500);
  txns.push(expense(2_500, "groceries", "2026-11-01"));
  assert.equal(getSalaryBudget(txns, plan).needsBalance, 7_000);
  txns.push(salary(12_000, "2026-11-15"));
  assert.equal(getSalaryBudget(txns, plan).needsBalance, 13_000);
});

test("expenses affect only their bucket; discrepancies and other income do not fund budgets", () => {
  const summary = getSalaryBudget([
    salary(10_000, "2026-10-15"),
    expense(600, "food_beverage", "2026-10-16", "needs"),
    expense(400, "shopping", "2026-11-02"),
    expense(800, "discrepancy", "2026-11-03", "needs"),
    { type: "income", category: "bonus", amount: 2_000 },
    { type: "adjustment", category: "discrepancy", amount: -500 },
  ], plan);
  assert.equal(summary.salaryIncome, 10_000);
  assert.equal(summary.needsBalance, 4_400);
  assert.equal(summary.wantsBalance, 2_600);
});

test("overspending remains deducted when a later salary arrives", () => {
  const txns = [salary(1_000, "2026-10-15"), expense(800, "groceries", "2026-10-16")];
  assert.equal(getSalaryBudget(txns, plan).needsBalance, -300);
  txns.push(salary(1_000, "2026-11-15"));
  assert.equal(getSalaryBudget(txns, plan).needsBalance, 200);
});

test("empty history and transaction edits recalculate without stored carryover", () => {
  assert.equal(getSalaryBudget([], plan).needsBalance, 0);
  const txns = [salary(1_000, "2026-10-15"), expense(100, "groceries", "2026-10-16")];
  assert.equal(getSalaryBudget(txns, plan).needsBalance, 400);
  txns[1].amount = 200;
  assert.equal(getSalaryBudget(txns, plan).needsBalance, 300);
  assert.equal(getSalaryBudget(txns.slice(0, 1), plan).needsBalance, 500);
});

test("Savings and Buffer allocations do not enter Needs or Wants balances", () => {
  const allocation = { needs: 40, wants: 20, savings: 30, buffer: 10 };
  const txns = [salary(10_000, "2026-10-15"), salary(10_000, "2026-11-15")];
  const summary = getSalaryBudget(txns, allocation);
  assert.equal(summary.needsBalance, 8_000);
  assert.equal(summary.wantsBalance, 4_000);
  assert.equal(getAvailableBalance(txns, allocation), 14_000);
});
