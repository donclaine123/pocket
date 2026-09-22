import React from "react";
import {
  FlexWidget,
  TextWidget,
} from "react-native-android-widget";

const W_COLORS = {
  paper: "#F7F0E3",
  ink: "#3B3330",
  inkSoft: "#A79A8C",
  inkMuted: "#EADBCC",
  peach: "#FF9E7E",
  mint: "#92D8B9",
  lavender: "#B7A6E4",
  butter: "#F7C56B",
  cream: "#FFFDF7",
  cardBorder: "#3B3330",
  danger: "#C25D42",
  success: "#1F6347",
} as const;

export interface WidgetDataProps {
  currencySymbol: string;
  totalBalance: number;
  todaySpent: number;
  recentTxns: Array<{
    id: string;
    type: "expense" | "income";
    amount: number;
    category: string;
    note: string;
  }>;
}

/**
 * Formats numbers into clean currency strings, e.g. "$24.50" or "$1,250"
 */
function formatAmount(num: number, symbol: string): string {
  const isWhole = Math.floor(num) === num;
  const formatted = isWhole
    ? num.toLocaleString("en-US", { maximumFractionDigits: 0 })
    : num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${symbol}${formatted}`;
}

/**
 * 1x1 Quick Entry Widget
 * Compact button that triggers the instant Quick-Add popup modal.
 */
export function QuickAdd1x1Widget({ currencySymbol = "$" }: Partial<WidgetDataProps>) {
  return (
    <FlexWidget
      style={{
        height: "match_parent",
        width: "match_parent",
        backgroundColor: W_COLORS.cream,
        borderRadius: 24,
        borderColor: W_COLORS.cardBorder,
        borderWidth: 2,
        alignItems: "center",
        justifyContent: "center",
        padding: 8,
      }}
      clickAction="OPEN_URI"
      clickActionData={{ uri: "pocket://quick-add" }}
    >
      <FlexWidget
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: W_COLORS.butter,
          borderColor: W_COLORS.cardBorder,
          borderWidth: 2,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <TextWidget
          text="+"
          style={{
            fontSize: 26,
            fontWeight: "bold",
            color: W_COLORS.ink,
            textAlign: "center",
          }}
        />
      </FlexWidget>

      <TextWidget
        text="Quick Add"
        style={{
          fontSize: 12,
          fontWeight: "bold",
          color: W_COLORS.ink,
          textAlign: "center",
        }}
      />
    </FlexWidget>
  );
}

/**
 * 2x1 Balance & Quick Action Widget
 * Displays today's spending, total balance, and a 1-tap "+" button.
 */
export function Balance2x1Widget({
  currencySymbol = "$",
  totalBalance = 0,
  todaySpent = 0,
}: Partial<WidgetDataProps>) {
  return (
    <FlexWidget
      style={{
        height: "match_parent",
        width: "match_parent",
        backgroundColor: W_COLORS.cream,
        borderRadius: 22,
        borderColor: W_COLORS.cardBorder,
        borderWidth: 2,
        padding: 12,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      {/* Left Column: Spending & Balance */}
      <FlexWidget
        style={{
          flex: 1,
          flexDirection: "column",
          justifyContent: "center",
        }}
        clickAction="OPEN_APP"
      >
        <TextWidget
          text="TODAY'S SPENT"
          style={{
            fontSize: 9,
            fontWeight: "bold",
            color: W_COLORS.inkSoft,
            letterSpacing: 0.5,
          }}
        />
        <TextWidget
          text={formatAmount(todaySpent, currencySymbol)}
          style={{
            fontSize: 18,
            fontWeight: "bold",
            color: W_COLORS.ink,
          }}
        />
        <TextWidget
          text={`Total Balance: ${formatAmount(totalBalance, currencySymbol)}`}
          style={{
            fontSize: 11,
            color: W_COLORS.inkSoft,
          }}
        />
      </FlexWidget>

      {/* Right Column: 1-Tap "+" Action */}
      <FlexWidget
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: W_COLORS.mint,
          borderColor: W_COLORS.cardBorder,
          borderWidth: 2,
          alignItems: "center",
          justifyContent: "center",
        }}
        clickAction="OPEN_URI"
        clickActionData={{ uri: "pocket://quick-add" }}
      >
        <TextWidget
          text="+"
          style={{
            fontSize: 24,
            fontWeight: "bold",
            color: W_COLORS.ink,
            textAlign: "center",
          }}
        />
      </FlexWidget>
    </FlexWidget>
  );
}

/**
 * 2x2 Pocket Journal Glance Widget
 * Full dashboard widget:
 * - Header: Pocket Journal & Total Balance
 * - Middle: Today's spend & 2 recent entries
 * - Bottom: Background 1-tap presets (+ Coffee, + Lunch) & Custom add
 */
export function Glance2x2Widget({
  currencySymbol = "$",
  totalBalance = 0,
  todaySpent = 0,
  recentTxns = [],
}: Partial<WidgetDataProps>) {
  const displayTxns = recentTxns.slice(0, 2);

  return (
    <FlexWidget
      style={{
        height: "match_parent",
        width: "match_parent",
        backgroundColor: W_COLORS.cream,
        borderRadius: 24,
        borderColor: W_COLORS.cardBorder,
        borderWidth: 2,
        padding: 14,
        flexDirection: "column",
        justifyContent: "space-between",
      }}
    >
      {/* Top Row: Brand & Balance */}
      <FlexWidget
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottomWidth: 1,
          borderColor: W_COLORS.inkMuted,
          paddingBottom: 6,
        }}
        clickAction="OPEN_APP"
      >
        <TextWidget
          text="Pocket Journal ✿"
          style={{
            fontSize: 12,
            fontWeight: "bold",
            color: W_COLORS.ink,
          }}
        />
        <TextWidget
          text={formatAmount(totalBalance, currencySymbol)}
          style={{
            fontSize: 14,
            fontWeight: "bold",
            color: W_COLORS.ink,
          }}
        />
      </FlexWidget>

      {/* Middle Section: Today's Spend & Recent Activity */}
      <FlexWidget
        style={{
          flexDirection: "column",
          paddingVertical: 4,
        }}
        clickAction="OPEN_APP"
      >
        <FlexWidget
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 4,
          }}
        >
          <TextWidget
            text="Today's Spent:"
            style={{
              fontSize: 11,
              color: W_COLORS.inkSoft,
            }}
          />
          <TextWidget
            text={formatAmount(todaySpent, currencySymbol)}
            style={{
              fontSize: 15,
              fontWeight: "bold",
              color: W_COLORS.danger,
            }}
          />
        </FlexWidget>

        {/* Recent Transactions list */}
        {displayTxns.length > 0 ? (
          displayTxns.map((t) => (
            <FlexWidget
              key={t.id}
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                paddingVertical: 2,
              }}
            >
              <TextWidget
                text={t.note ? t.note : t.category}
                style={{
                  fontSize: 11,
                  color: W_COLORS.ink,
                }}
                maxLines={1}
                truncate="END"
              />
              <TextWidget
                text={`${t.type === "income" ? "+" : "-"}${formatAmount(t.amount, currencySymbol)}`}
                style={{
                  fontSize: 11,
                  fontWeight: "bold",
                  color: t.type === "income" ? W_COLORS.success : W_COLORS.ink,
                }}
              />
            </FlexWidget>
          ))
        ) : (
          <TextWidget
            text="No transactions yet today"
            style={{
              fontSize: 11,
              color: W_COLORS.inkSoft,
              fontStyle: "italic",
            }}
          />
        )}
      </FlexWidget>

      {/* Bottom Action Row: Background Presets & Custom Quick-Add */}
      <FlexWidget
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          flexGap: 6,
        }}
      >
        {/* Preset 1: +$5 Coffee (100% background, never opens app) */}
        <FlexWidget
          style={{
            flex: 1,
            backgroundColor: W_COLORS.butter,
            borderRadius: 10,
            borderColor: W_COLORS.cardBorder,
            borderWidth: 1.5,
            paddingVertical: 6,
            alignItems: "center",
            justifyContent: "center",
          }}
          clickAction="ADD_PRESET"
          clickActionData={{
            amount: 5,
            category: "food_beverage",
            note: "Coffee",
          }}
        >
          <TextWidget
            text={`+${currencySymbol}5 Coffee`}
            style={{
              fontSize: 10,
              fontWeight: "bold",
              color: W_COLORS.ink,
              textAlign: "center",
            }}
          />
        </FlexWidget>

        {/* Preset 2: +$15 Meal (100% background, never opens app) */}
        <FlexWidget
          style={{
            flex: 1,
            backgroundColor: W_COLORS.peach,
            borderRadius: 10,
            borderColor: W_COLORS.cardBorder,
            borderWidth: 1.5,
            paddingVertical: 6,
            alignItems: "center",
            justifyContent: "center",
          }}
          clickAction="ADD_PRESET"
          clickActionData={{
            amount: 15,
            category: "food_beverage",
            note: "Meal",
          }}
        >
          <TextWidget
            text={`+${currencySymbol}15 Meal`}
            style={{
              fontSize: 10,
              fontWeight: "bold",
              color: W_COLORS.ink,
              textAlign: "center",
            }}
          />
        </FlexWidget>

        {/* Custom Button: Opens quick-add sheet */}
        <FlexWidget
          style={{
            width: 34,
            backgroundColor: W_COLORS.mint,
            borderRadius: 10,
            borderColor: W_COLORS.cardBorder,
            borderWidth: 1.5,
            paddingVertical: 6,
            alignItems: "center",
            justifyContent: "center",
          }}
          clickAction="OPEN_URI"
          clickActionData={{ uri: "pocket://quick-add" }}
        >
          <TextWidget
            text="+"
            style={{
              fontSize: 12,
              fontWeight: "bold",
              color: W_COLORS.ink,
              textAlign: "center",
            }}
          />
        </FlexWidget>
      </FlexWidget>
    </FlexWidget>
  );
}
