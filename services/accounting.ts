import type { Txn } from "../types/transaction";

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
