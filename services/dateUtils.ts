import { Txn } from "../types/transaction";

export type TimeframeMode = "daily" | "week" | "month" | "history";

export type DateRange = {
  start: string; // ISO yyyy-mm-dd
  end: string;   // ISO yyyy-mm-dd
  label: string;
};

export type DayGroup = {
  date: string;
  displayDate: string;
  totalIncome: number;
  totalSpent: number;
  netFlow: number;
  txns: Txn[];
};

export type MonthArchive = {
  key: string;       // e.g. "2026-09"
  label: string;     // e.g. "September 2026"
  year: number;
  month: number;     // 0-indexed
  income: number;
  spent: number;
  balance: number;
  count: number;
};

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseISODate(iso: string): Date {
  const parts = iso.split("-");
  if (parts.length === 3) {
    return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  }
  return new Date();
}

/**
 * Returns day range for an offset (0 = today, -1 = yesterday, etc.)
 */
export function getDayRange(offsetDays = 0): DateRange {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const iso = toISODate(d);

  const dayName = d.toLocaleDateString("en-US", { weekday: "short" });
  const dateStr = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  let label: string;
  if (offsetDays === 0) {
    label = `Today (${dayName}, ${dateStr})`;
  } else if (offsetDays === -1) {
    label = `Yesterday (${dayName}, ${dateStr})`;
  } else if (offsetDays === 1) {
    label = `Tomorrow (${dayName}, ${dateStr})`;
  } else {
    label = `${dayName}, ${dateStr} ${d.getFullYear()}`;
  }

  return {
    start: iso,
    end: iso,
    label,
  };
}

/**
 * Returns week range for an offset (0 = current week, -1 = last week, etc.)
 * Week starts on Monday, ends on Sunday.
 */
export function getWeekRange(offsetWeeks = 0): DateRange {
  const now = new Date();
  const currentDay = now.getDay(); // 0 = Sun, 1 = Mon...
  const distanceToMonday = (currentDay + 6) % 7;

  const monday = new Date(now);
  monday.setDate(now.getDate() - distanceToMonday + offsetWeeks * 7);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const monLabel = monday.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const sunLabel = sunday.toLocaleDateString("en-US", { month: "short", day: "numeric" });

  let label: string;
  if (offsetWeeks === 0) {
    label = `This Week (${monLabel} – ${sunLabel})`;
  } else if (offsetWeeks === -1) {
    label = `Last Week (${monLabel} – ${sunLabel})`;
  } else {
    label = `${monLabel} – ${sunLabel}, ${sunday.getFullYear()}`;
  }

  return {
    start: toISODate(monday),
    end: toISODate(sunday),
    label,
  };
}

/**
 * Returns month range for an offset (0 = current month, -1 = last month, etc.)
 */
export function getMonthRange(offsetMonths = 0): DateRange {
  const now = new Date();
  const targetDate = new Date(now.getFullYear(), now.getMonth() + offsetMonths, 1);

  const year = targetDate.getFullYear();
  const month = targetDate.getMonth();

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  const monthName = targetDate.toLocaleDateString("en-US", { month: "long" });
  const label = offsetMonths === 0 ? `${monthName} (This Month)` : `${monthName} ${year}`;

  return {
    start: toISODate(firstDay),
    end: toISODate(lastDay),
    label,
  };
}

export function isDateInRange(dateStr: string, range: DateRange): boolean {
  const cleanDate = dateStr.slice(0, 10);
  return cleanDate >= range.start && cleanDate <= range.end;
}

export function formatFriendlyDate(iso: string): string {
  const cleanDate = iso.slice(0, 10);
  const today = toISODate(new Date());
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = toISODate(yesterdayDate);

  if (cleanDate === today) return "Today";
  if (cleanDate === yesterday) return "Yesterday";

  const d = parseISODate(cleanDate);
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/**
 * Groups a list of transactions by calendar date in descending or ascending order.
 */
export function groupTransactionsByDate(
  txns: Txn[],
  sortOrder: "desc" | "asc" = "desc"
): DayGroup[] {
  const groups: Record<string, Txn[]> = {};

  for (const t of txns) {
    const dayKey = t.date.slice(0, 10);
    if (!groups[dayKey]) {
      groups[dayKey] = [];
    }
    groups[dayKey].push(t);
  }

  const sortedDates = Object.keys(groups).sort((a, b) => {
    if (sortOrder === "asc") {
      return a > b ? 1 : a < b ? -1 : 0;
    }
    return a < b ? 1 : a > b ? -1 : 0;
  });

  return sortedDates.map((date) => {
    const list = [...groups[date]];
    if (sortOrder === "asc") {
      list.reverse();
    }
    let totalIncome = 0;
    let totalSpent = 0;
    for (const t of list) {
      if (t.type === "income") totalIncome += t.amount;
      else totalSpent += t.amount;
    }
    return {
      date,
      displayDate: formatFriendlyDate(date),
      totalIncome,
      totalSpent,
      netFlow: totalIncome - totalSpent,
      txns: list,
    };
  });
}

/**
 * Aggregates all transactions by year-month for the history archive.
 */
export function buildMonthArchives(txns: Txn[]): MonthArchive[] {
  const map: Record<string, { income: number; spent: number; count: number; date: Date }> = {};

  for (const t of txns) {
    const key = t.date.slice(0, 7); // e.g. "2026-09"
    if (!map[key]) {
      const d = parseISODate(t.date);
      map[key] = { income: 0, spent: 0, count: 0, date: d };
    }
    map[key].count += 1;
    if (t.type === "income") map[key].income += t.amount;
    else map[key].spent += t.amount;
  }

  // Ensure current month is represented
  const currentKey = toISODate(new Date()).slice(0, 7);
  if (!map[currentKey]) {
    map[currentKey] = { income: 0, spent: 0, count: 0, date: new Date() };
  }

  const sortedKeys = Object.keys(map).sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));

  return sortedKeys.map((key) => {
    const item = map[key];
    const monthName = item.date.toLocaleDateString("en-US", { month: "long" });
    return {
      key,
      label: `${monthName} ${item.date.getFullYear()}`,
      year: item.date.getFullYear(),
      month: item.date.getMonth(),
      income: item.income,
      spent: item.spent,
      balance: item.income - item.spent,
      count: item.count,
    };
  });
}
