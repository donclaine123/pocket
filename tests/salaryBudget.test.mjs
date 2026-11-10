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
  assert.equal(summary.needsSpent, 600);
  assert.equal(summary.wantsSpent, 400);
  assert.equal(summary.needsBudget, 5_000);
  assert.equal(summary.wantsBudget, 3_000);
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

test("payday resets the spent display and carries the remaining money into the new limit", () => {
  const txns = [
    salary(5_000, "2026-10-15"),
    expense(500, "shopping", "2026-10-16"),
    salary(8_333.33, "2026-10-30"),
    expense(500, "shopping", "2026-11-01"),
  ];
  const summary = getSalaryBudget(txns, plan);
  assert.equal(summary.wantsSpent, 500);
  assert.equal(summary.wantsBudget, 3_500);
  assert.equal(summary.wantsBalance, 3_000);
  txns.push(salary(5_000, "2026-11-15"));
  const nextPayday = getSalaryBudget(txns, plan);
  assert.equal(nextPayday.wantsSpent, 0);
  assert.equal(nextPayday.wantsBudget, 4_500);
  assert.equal(nextPayday.wantsBalance, 4_500);
});

test("same-day expenses use their time relative to the latest salary, independent of list order", () => {
  const txns = [
    { ...expense(100, "shopping", "2026-11-11"), createdAt: "2026-11-11T02:00:00Z" },
    { ...salary(5_000, "2026-11-11"), createdAt: "2026-11-11T01:00:00Z" },
    { ...expense(200, "shopping", "2026-11-11"), createdAt: "2026-11-11T00:00:00Z" },
  ];
  const summary = getSalaryBudget(txns, plan);
  assert.equal(summary.wantsSpent, 100);
  assert.equal(summary.wantsBudget, 1_300);
  assert.equal(summary.wantsBalance, 1_200);
  assert.deepEqual(getSalaryBudget([...txns].reverse(), plan), summary);
});

test("a single Salary starts each bucket at zero spent against its allocation", () => {
  const txns = [salary(5_000, "2026-11-11")];
  const summary = getSalaryBudget(txns, plan);
  assert.equal(summary.needsSpent, 0);
  assert.equal(summary.needsBudget, 2_500);
  assert.equal(summary.wantsSpent, 0);
  assert.equal(summary.wantsBudget, 1_500);
  assert.equal(getAvailableBalance(txns, plan), 4_000);
});
