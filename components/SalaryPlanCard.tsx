import React, { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Check, Pencil, X } from "lucide-react-native";
import { NeoCard } from "./NeoCard";
import { COLORS, FONTS } from "../constants/theme";
import { Txn } from "../types/transaction";
import {
  getEmergencyReserve,
  getAvailableBalance,
} from "../services/accounting";
import {
  DEFAULT_SALARY_ALLOCATION,
  getMonthlySalaryBudget,
  isValidSalaryAllocation,
  loadSalaryAllocation,
  loadSalaryBudgetStartMonth,
  SalaryAllocationPlan,
  saveSalaryAllocation,
  loadEmergencyReserveCorrection,
  saveEmergencyReserveCorrection,
} from "../services/salaryBudget";

type PlanKey = keyof SalaryAllocationPlan;
type PlanInputs = Record<PlanKey, string>;

interface SalaryPlanCardProps {
  transactions: Txn[];
  currencySymbol: string;
  currencyCode: string;
  onPlanSaved: () => Promise<void>;
  onAccountingChange: (available: number, reserve: number) => void;
  onReconcile: (difference: number) => Promise<void>;
}

const PLAN_ROWS: { key: PlanKey; label: string; color: string }[] = [
  { key: "needs", label: "Needs", color: "#2D8C65" },
  { key: "wants", label: "Wants", color: "#D87942" },
  { key: "savings", label: "Savings", color: "#587DCC" },
  { key: "buffer", label: "Buffer", color: "#A17D44" },
];

function asInputs(plan: SalaryAllocationPlan): PlanInputs {
  return {
    needs: String(plan.needs),
    wants: String(plan.wants),
    savings: String(plan.savings),
    buffer: String(plan.buffer),
  };
}

function parseInputs(inputs: PlanInputs): SalaryAllocationPlan {
  return {
    needs: Number(inputs.needs),
    wants: Number(inputs.wants),
    savings: Number(inputs.savings),
    buffer: Number(inputs.buffer),
  };
}

function money(amount: number, symbol: string): string {
  return `${symbol}${(Math.round(amount * 100) / 100).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

function formatMonth(month: string): string {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(year, monthNumber - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

export function SalaryPlanCard({
  transactions,
  currencySymbol,
  currencyCode,
  onPlanSaved,
  onAccountingChange,
  onReconcile,
}: SalaryPlanCardProps) {
  const [plan, setPlan] = useState(DEFAULT_SALARY_ALLOCATION);
  const [budgetStartMonth, setBudgetStartMonth] = useState<string>();
  const [inputs, setInputs] = useState<PlanInputs>(asInputs(DEFAULT_SALARY_ALLOCATION));
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reserveCorrection, setReserveCorrection] = useState(0);
  const [reserveInput, setReserveInput] = useState("");
  const [availableInput, setAvailableInput] = useState("");
  const [accountingError, setAccountingError] = useState<string | null>(null);
  const [savingReserve, setSavingReserve] = useState(false);
  const [reconciling, setReconciling] = useState(false);

  useEffect(() => {
    Promise.all([
      loadSalaryAllocation(),
      loadSalaryBudgetStartMonth(),
      loadEmergencyReserveCorrection(currencyCode),
    ]).then(([saved, startMonth, correction]) => {
      setPlan(saved);
      setInputs(asInputs(saved));
      setBudgetStartMonth(startMonth);
      setReserveCorrection(correction);
    });
  }, [currencyCode]);

  const summary = useMemo(
    () => getMonthlySalaryBudget(transactions, plan, undefined, budgetStartMonth),
    [transactions, plan, budgetStartMonth]
  );
  const emergencyReserve = getEmergencyReserve(transactions, plan, reserveCorrection);
  const availableBalance = getAvailableBalance(transactions, plan, reserveCorrection);
  const calculatedReserve = getEmergencyReserve(transactions, plan, 0);
  useEffect(() => {
    onAccountingChange(availableBalance, emergencyReserve);
  }, [availableBalance, emergencyReserve]);
  const draft = parseInputs(inputs);
  const totalPercent = Object.values(draft).reduce(
    (total, value) => total + (Number.isFinite(value) ? value : 0),
    0
  );
  const draftIsValid = Object.values(draft).every(Number.isFinite) && isValidSalaryAllocation(draft);
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const handleSave = async () => {
    if (!draftIsValid || saving) {
      setError("Allocation percentages must add up to 100%.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await saveSalaryAllocation(draft);
      setPlan(draft);
      setEditing(false);
      await onPlanSaved();
    } catch {
      setError("Could not save your salary plan. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveReserve = async () => {
    const actualReserve = Number(reserveInput);
    if (!reserveInput.trim() || !Number.isFinite(actualReserve) || actualReserve < 0 || savingReserve) {
      setAccountingError("Enter a reserve amount of zero or more.");
      return;
    }
    setSavingReserve(true);
    setAccountingError(null);
    try {
      const correction = Math.round((actualReserve - calculatedReserve) * 100) / 100;
      await saveEmergencyReserveCorrection(correction, currencyCode);
      setReserveCorrection(correction);
      setReserveInput("");
      await onPlanSaved();
    } catch {
      setAccountingError("Could not save the reserve amount. Please try again.");
    } finally {
      setSavingReserve(false);
    }
  };

  const handleReconcile = async () => {
    const actualAvailable = Number(availableInput);
    if (!availableInput.trim() || !Number.isFinite(actualAvailable) || actualAvailable < 0 || reconciling) {
      setAccountingError("Enter an available amount of zero or more.");
      return;
    }
    const difference = Math.round((actualAvailable - availableBalance) * 100) / 100;
    if (Math.abs(difference) < 0.005) {
      setAccountingError("Your available amount already matches.");
      return;
    }
    setReconciling(true);
    setAccountingError(null);
    try {
      await onReconcile(difference);
      setAvailableInput("");
    } catch {
      setAccountingError("Could not reconcile the balance. Please try again.");
    } finally {
      setReconciling(false);
    }
  };

  const setInput = (key: PlanKey, value: string) => {
    setInputs((previous) => ({ ...previous, [key]: value }));
    setError(null);
  };

  const renderBudgetRow = (key: "needs" | "wants", label: string, color: string) => {
    const spent = key === "needs" ? summary.needsSpent : summary.wantsSpent;
    const limit = key === "needs" ? summary.needsBudget : summary.wantsBudget;
    const remaining = limit - spent;
    const over = remaining < 0;
    const progress = limit > 0 ? Math.min(spent / limit, 1) : 0;

    return (
      <View key={key} style={styles.budgetRow}>
        <View style={styles.rowHeading}>
          <Text style={[styles.rowTitle, { color }]}>{label} · {plan[key]}%</Text>
          <Text style={styles.rowAmount}>{money(spent, currencySymbol)} / {money(limit, currencySymbol)}</Text>
        </View>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${progress * 100}%`, backgroundColor: over ? "#D35433" : color }]} />
        </View>
        <Text style={[styles.rowStatus, over && styles.overStatus]}>
          {summary.salaryIncome === 0 && limit === 0
            ? "Log income as Salary to activate this budget"
            : over
            ? `Over by ${money(-remaining, currencySymbol)}`
            : `${money(remaining, currencySymbol)} remaining`}
        </Text>
      </View>
    );
  };

  return (
    <NeoCard
      shadowOffsetX={3}
      shadowOffsetY={4}
      borderRadius={24}
      style={styles.card}
    >
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>MONTHLY SALARY PLAN</Text>
          <Text style={styles.subtitle}>
            {summary.salaryIncome > 0
              ? `Salary basis: ${money(summary.salaryIncome, currencySymbol)} · ${summary.salaryIncomeMonth === currentMonth ? "this month" : `from ${formatMonth(summary.salaryIncomeMonth!)}`}`
              : `Salary this month: ${money(0, currencySymbol)}`}
          </Text>
          <Text style={styles.subtitle}>
            Carryover: Needs {money(summary.needsCarryover, currencySymbol)} · Wants {money(summary.wantsCarryover, currencySymbol)}
          </Text>
        </View>
        <Pressable
          onPress={() => {
            setInputs(asInputs(plan));
            setEditing((value) => !value);
            setError(null);
          }}
          accessibilityRole="button"
          accessibilityLabel={editing ? "Cancel salary plan edit" : "Edit salary plan"}
          style={styles.iconButton}
        >
          {editing ? <X size={16} color={COLORS.ink} /> : <Pencil size={15} color={COLORS.ink} />}
        </Pressable>
      </View>

      <View style={styles.reservePanel}>
        <View style={styles.rowHeading}>
          <Text style={styles.reserveTitle}>Emergency reserve</Text>
          <Text style={styles.reserveAmount}>{money(emergencyReserve, currencySymbol)}</Text>
        </View>
        <Text style={styles.rowStatus}>Savings from all Salary entries, kept outside your spendable balance.</Text>
        <View style={styles.accountingActionRow}>
          <TextInput
            value={reserveInput}
            onChangeText={(value) => {
              setReserveInput(value);
              setAccountingError(null);
            }}
            keyboardType="decimal-pad"
            placeholder="Actual reserve"
            accessibilityLabel="Actual emergency reserve"
            style={styles.accountingInput}
          />
          <Pressable onPress={handleSaveReserve} disabled={savingReserve} style={styles.accountingButton}>
            <Text style={styles.accountingButtonText}>{savingReserve ? "Saving" : "Set reserve"}</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.reconcilePanel}>
        <Text style={styles.reserveTitle}>Reconcile available money</Text>
        <Text style={styles.rowStatus}>Match cash, bank, and e-wallet money you can spend. The difference is saved as Discrepancy.</Text>
        <View style={styles.accountingActionRow}>
          <TextInput
            value={availableInput}
            onChangeText={(value) => {
              setAvailableInput(value);
              setAccountingError(null);
            }}
            keyboardType="decimal-pad"
            placeholder="Actual available amount"
            accessibilityLabel="Actual available-to-spend amount"
            style={styles.accountingInput}
          />
          <Pressable onPress={handleReconcile} disabled={reconciling} style={styles.accountingButton}>
            <Text style={styles.accountingButtonText}>{reconciling ? "Saving" : "Reconcile"}</Text>
          </Pressable>
        </View>
        {accountingError ? <Text style={styles.errorText}>{accountingError}</Text> : null}
      </View>

      {editing ? (
        <View style={styles.editor}>
          {PLAN_ROWS.map((row) => (
            <View key={row.key} style={styles.editRow}>
              <Text style={[styles.editLabel, { color: row.color }]}>{row.label}</Text>
              <View style={styles.percentInputWrap}>
                <TextInput
                  value={inputs[row.key]}
                  onChangeText={(value) => setInput(row.key, value)}
                  keyboardType="decimal-pad"
                  selectTextOnFocus
                  accessibilityLabel={`${row.label} allocation percentage`}
                  style={styles.percentInput}
                />
                <Text style={styles.percentSign}>%</Text>
              </View>
            </View>
          ))}
          <Text style={[styles.totalText, Math.abs(totalPercent - 100) > 0.01 && styles.overStatus]}>
            Total: {Number.isFinite(totalPercent) ? totalPercent : 0}% / 100%
          </Text>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          <View style={styles.actionRow}>
            <Pressable
              onPress={() => {
                setInputs(asInputs(plan));
                setEditing(false);
                setError(null);
              }}
              style={styles.cancelButton}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={handleSave}
              disabled={!draftIsValid || saving}
              style={[styles.saveButton, (!draftIsValid || saving) && styles.disabledButton]}
            >
              <Check size={15} color={COLORS.cream} />
              <Text style={styles.saveText}>{saving ? "Saving" : "Save plan"}</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <>
          {renderBudgetRow("needs", "Needs", "#2D8C65")}
          {renderBudgetRow("wants", "Wants", "#D87942")}
          <View style={styles.allocationsRow}>
            {PLAN_ROWS.slice(2).map((row) => {
              const value = summary.salaryIncome * (plan[row.key] / 100);
              return (
                <View key={row.key} style={styles.allocationPill}>
                  <Text style={[styles.allocationLabel, { color: row.color }]}>{row.label} · {plan[row.key]}%</Text>
                  <Text style={styles.allocationAmount}>{money(value, currencySymbol)}</Text>
                  <Text style={styles.allocationFootnote}>allocated</Text>
                </View>
              );
            })}
          </View>
        </>
      )}
    </NeoCard>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, marginBottom: 16 },
  header: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  eyebrow: { fontFamily: FONTS.bodyBold, fontSize: 10, letterSpacing: 1, color: COLORS.inkSoft },
  subtitle: { fontFamily: FONTS.bodyMedium, fontSize: 11, color: COLORS.inkSoft, marginTop: 3 },
  iconButton: { width: 34, height: 34, borderRadius: 10, borderWidth: 1.5, borderColor: COLORS.ink, backgroundColor: COLORS.cream, alignItems: "center", justifyContent: "center" },
  budgetRow: { marginTop: 8 },
  rowHeading: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  rowTitle: { fontFamily: FONTS.bodyBold, fontSize: 12 },
  rowAmount: { fontFamily: FONTS.bodyBold, fontSize: 11, color: COLORS.ink },
  track: { height: 7, borderRadius: 99, backgroundColor: "#EFE7DA", overflow: "hidden", marginTop: 6 },
  fill: { height: "100%", borderRadius: 99 },
  rowStatus: { fontFamily: FONTS.bodyMedium, fontSize: 10, color: COLORS.inkSoft, marginTop: 3 },
  overStatus: { color: "#D35433" },
  allocationsRow: { flexDirection: "row", gap: 8, marginTop: 14 },
  reservePanel: { borderRadius: 14, backgroundColor: "#EEF5F0", padding: 11, marginBottom: 9 },
  reconcilePanel: { borderRadius: 14, backgroundColor: COLORS.cream, padding: 11, marginBottom: 8 },
  reserveTitle: { fontFamily: FONTS.bodyBold, fontSize: 12, color: COLORS.ink },
  reserveAmount: { fontFamily: FONTS.displayBold, fontSize: 14, color: "#2D8C65" },
  accountingActionRow: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 8 },
  accountingInput: { flex: 1, height: 36, borderWidth: 1.3, borderColor: COLORS.ink, borderRadius: 9, paddingHorizontal: 9, color: COLORS.ink, fontFamily: FONTS.bodyMedium, fontSize: 11 },
  accountingButton: { minHeight: 36, paddingHorizontal: 10, borderRadius: 9, backgroundColor: COLORS.ink, alignItems: "center", justifyContent: "center" },
  accountingButtonText: { fontFamily: FONTS.bodyBold, fontSize: 10, color: COLORS.cream },
  allocationPill: { flex: 1, borderRadius: 12, backgroundColor: COLORS.cream, padding: 9, borderWidth: 1, borderColor: "rgba(59, 51, 48, 0.12)" },
  allocationLabel: { fontFamily: FONTS.bodyBold, fontSize: 9 },
  allocationAmount: { fontFamily: FONTS.displayBold, fontSize: 14, color: COLORS.ink, marginTop: 3 },
  allocationFootnote: { fontFamily: FONTS.bodyMedium, fontSize: 9, color: COLORS.inkSoft },
  editor: { gap: 8 },
  editRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 3 },
  editLabel: { fontFamily: FONTS.bodyBold, fontSize: 12 },
  percentInputWrap: { flexDirection: "row", alignItems: "center", width: 90, height: 36, borderWidth: 1.5, borderColor: COLORS.ink, borderRadius: 10, backgroundColor: COLORS.cream, paddingHorizontal: 8 },
  percentInput: { flex: 1, padding: 0, textAlign: "right", fontFamily: FONTS.bodyBold, color: COLORS.ink, fontSize: 13 },
  percentSign: { fontFamily: FONTS.bodyBold, color: COLORS.inkSoft, marginLeft: 3 },
  totalText: { fontFamily: FONTS.bodyBold, fontSize: 11, color: COLORS.inkSoft, textAlign: "right", marginTop: 4 },
  errorText: { fontFamily: FONTS.bodyMedium, fontSize: 10, color: "#D35433" },
  actionRow: { flexDirection: "row", justifyContent: "flex-end", gap: 8, marginTop: 6 },
  cancelButton: { paddingHorizontal: 12, minHeight: 36, justifyContent: "center" },
  cancelText: { fontFamily: FONTS.bodyBold, fontSize: 11, color: COLORS.inkSoft },
  saveButton: { flexDirection: "row", alignItems: "center", gap: 5, minHeight: 36, paddingHorizontal: 12, borderRadius: 10, backgroundColor: COLORS.ink },
  saveText: { fontFamily: FONTS.bodyBold, fontSize: 11, color: COLORS.cream },
  disabledButton: { opacity: 0.45 },
});
