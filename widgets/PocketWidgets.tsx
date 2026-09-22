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
      clickActionData={{ uri: "pocket://quick-add?fromWidget=true" }}
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
        clickActionData={{ uri: "pocket://quick-add?fromWidget=true" }}
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
          clickActionData={{ uri: "pocket://quick-add?fromWidget=true" }}
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

/**
 * 4x2 Pocket Dashboard Widget
 * Full wide dashboard layout:
 * - Left Pane: Brand, Total Balance, Today's Spent
 * - Right Pane: Recent transaction feed and 1-tap background action bar
 */
export function Dashboard4x2Widget({
  currencySymbol = "$",
  totalBalance = 0,
  todaySpent = 0,
  recentTxns = [],
}: Partial<WidgetDataProps>) {
  const displayTxns = recentTxns.slice(0, 3);

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
        flexDirection: "row",
        justifyContent: "space-between",
      }}
    >
      {/* Left Column: Financial Overview */}
      <FlexWidget
        style={{
          width: 125,
          flexDirection: "column",
          justifyContent: "space-between",
          borderRightWidth: 1,
          borderColor: W_COLORS.inkMuted,
          paddingRight: 10,
        }}
        clickAction="OPEN_APP"
      >
        <FlexWidget style={{ flexDirection: "column" }}>
          <TextWidget
            text="Pocket Journal ✿"
            style={{
              fontSize: 11,
              fontWeight: "bold",
              color: W_COLORS.ink,
              marginBottom: 4,
            }}
          />
          <TextWidget
            text="TOTAL BALANCE"
            style={{
              fontSize: 9,
              fontWeight: "bold",
              color: W_COLORS.inkSoft,
              letterSpacing: 0.5,
            }}
          />
          <TextWidget
            text={formatAmount(totalBalance, currencySymbol)}
            style={{
              fontSize: 18,
              fontWeight: "bold",
              color: W_COLORS.ink,
            }}
          />
        </FlexWidget>

        <FlexWidget
          style={{
            flexDirection: "column",
            backgroundColor: W_COLORS.paper,
            borderRadius: 10,
            padding: 6,
            borderWidth: 1,
            borderColor: W_COLORS.inkMuted,
          }}
        >
          <TextWidget
            text="TODAY'S SPENT"
            style={{
              fontSize: 8,
              fontWeight: "bold",
              color: W_COLORS.inkSoft,
            }}
          />
          <TextWidget
            text={formatAmount(todaySpent, currencySymbol)}
            style={{
              fontSize: 14,
              fontWeight: "bold",
              color: W_COLORS.danger,
            }}
          />
        </FlexWidget>
      </FlexWidget>

      {/* Right Column: Recent Feed & 1-Tap Action Bar */}
      <FlexWidget
        style={{
          flex: 1,
          flexDirection: "column",
          justifyContent: "space-between",
          paddingLeft: 10,
        }}
      >
        {/* Recent Transactions List */}
        <FlexWidget
          style={{
            flexDirection: "column",
          }}
          clickAction="OPEN_APP"
        >
          <TextWidget
            text="RECENT ACTIVITY"
            style={{
              fontSize: 9,
              fontWeight: "bold",
              color: W_COLORS.inkSoft,
              letterSpacing: 0.5,
              marginBottom: 3,
            }}
          />

          {displayTxns.length > 0 ? (
            displayTxns.map((t) => (
              <FlexWidget
                key={t.id}
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  paddingVertical: 1.5,
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

        {/* 1-Tap Background Preset Buttons & Add Button */}
        <FlexWidget
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            flexGap: 5,
            marginTop: 4,
          }}
        >
          {/* Preset 1: +$5 Coffee */}
          <FlexWidget
            style={{
              flex: 1,
              backgroundColor: W_COLORS.butter,
              borderRadius: 8,
              borderColor: W_COLORS.cardBorder,
              borderWidth: 1.5,
              paddingVertical: 5,
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
                fontSize: 9,
                fontWeight: "bold",
                color: W_COLORS.ink,
                textAlign: "center",
              }}
            />
          </FlexWidget>

          {/* Preset 2: +$15 Meal */}
          <FlexWidget
            style={{
              flex: 1,
              backgroundColor: W_COLORS.peach,
              borderRadius: 8,
              borderColor: W_COLORS.cardBorder,
              borderWidth: 1.5,
              paddingVertical: 5,
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
                fontSize: 9,
                fontWeight: "bold",
                color: W_COLORS.ink,
                textAlign: "center",
              }}
            />
          </FlexWidget>

          {/* Preset 3: +$25 Groceries */}
          <FlexWidget
            style={{
              flex: 1,
              backgroundColor: W_COLORS.lavender,
              borderRadius: 8,
              borderColor: W_COLORS.cardBorder,
              borderWidth: 1.5,
              paddingVertical: 5,
              alignItems: "center",
              justifyContent: "center",
            }}
            clickAction="ADD_PRESET"
            clickActionData={{
              amount: 25,
              category: "groceries",
              note: "Groceries",
            }}
          >
            <TextWidget
              text={`+${currencySymbol}25 Market`}
              style={{
                fontSize: 9,
                fontWeight: "bold",
                color: W_COLORS.ink,
                textAlign: "center",
              }}
            />
          </FlexWidget>

          {/* Custom Add: Opens Instant Modal */}
          <FlexWidget
            style={{
              width: 28,
              backgroundColor: W_COLORS.mint,
              borderRadius: 8,
              borderColor: W_COLORS.cardBorder,
              borderWidth: 1.5,
              paddingVertical: 5,
              alignItems: "center",
              justifyContent: "center",
            }}
            clickAction="OPEN_URI"
            clickActionData={{ uri: "pocket://quick-add?fromWidget=true" }}
          >
            <TextWidget
              text="+"
              style={{
                fontSize: 11,
                fontWeight: "bold",
                color: W_COLORS.ink,
                textAlign: "center",
              }}
            />
          </FlexWidget>
        </FlexWidget>
      </FlexWidget>
    </FlexWidget>
  );
}

/**
 * 4x1 Pocket Banner Bar Widget
 * Ultra-sleek single-row horizontal bar:
 * - Brand + Balance + Today's Spend + Quick 1-tap presets and "+" button
 */
export function Banner4x1Widget({
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
        borderRadius: 20,
        borderColor: W_COLORS.cardBorder,
        borderWidth: 2,
        paddingHorizontal: 12,
        paddingVertical: 8,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      {/* Left: Brand & Balance */}
      <FlexWidget
        style={{
          flexDirection: "column",
          justifyContent: "center",
        }}
        clickAction="OPEN_APP"
      >
        <TextWidget
          text="Pocket ✿"
          style={{
            fontSize: 10,
            fontWeight: "bold",
            color: W_COLORS.inkSoft,
          }}
        />
        <TextWidget
          text={formatAmount(totalBalance, currencySymbol)}
          style={{
            fontSize: 16,
            fontWeight: "bold",
            color: W_COLORS.ink,
          }}
        />
      </FlexWidget>

      {/* Center: Today's Spend Badge */}
      <FlexWidget
        style={{
          backgroundColor: W_COLORS.paper,
          borderRadius: 8,
          borderColor: W_COLORS.cardBorder,
          borderWidth: 1,
          paddingHorizontal: 8,
          paddingVertical: 4,
          flexDirection: "column",
          alignItems: "center",
        }}
        clickAction="OPEN_APP"
      >
        <TextWidget
          text="TODAY"
          style={{
            fontSize: 7,
            fontWeight: "bold",
            color: W_COLORS.inkSoft,
          }}
        />
        <TextWidget
          text={formatAmount(todaySpent, currencySymbol)}
          style={{
            fontSize: 12,
            fontWeight: "bold",
            color: W_COLORS.danger,
          }}
        />
      </FlexWidget>

      {/* Right: Quick Action Buttons */}
      <FlexWidget
        style={{
          flexDirection: "row",
          alignItems: "center",
          flexGap: 6,
        }}
      >
        {/* Preset: +$5 Coffee */}
        <FlexWidget
          style={{
            backgroundColor: W_COLORS.butter,
            borderRadius: 8,
            borderColor: W_COLORS.cardBorder,
            borderWidth: 1.5,
            paddingHorizontal: 8,
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
            text={`+${currencySymbol}5`}
            style={{
              fontSize: 10,
              fontWeight: "bold",
              color: W_COLORS.ink,
              textAlign: "center",
            }}
          />
        </FlexWidget>

        {/* Preset: +$15 Meal */}
        <FlexWidget
          style={{
            backgroundColor: W_COLORS.peach,
            borderRadius: 8,
            borderColor: W_COLORS.cardBorder,
            borderWidth: 1.5,
            paddingHorizontal: 8,
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
            text={`+${currencySymbol}15`}
            style={{
              fontSize: 10,
              fontWeight: "bold",
              color: W_COLORS.ink,
              textAlign: "center",
            }}
          />
        </FlexWidget>

        {/* Plus Custom Button */}
        <FlexWidget
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: W_COLORS.mint,
            borderColor: W_COLORS.cardBorder,
            borderWidth: 1.5,
            alignItems: "center",
            justifyContent: "center",
          }}
          clickAction="OPEN_URI"
          clickActionData={{ uri: "pocket://quick-add?fromWidget=true" }}
        >
          <TextWidget
            text="+"
            style={{
              fontSize: 16,
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

/**
 * 4x4 Pocket Full Journal Widget
 * Large full-screen dashboard:
 * - Top header with balance & spending metrics
 * - Expanded feed with up to 5 recent transactions
 * - Full bottom preset bar (+ Coffee, + Meal, + Market, + Bills, + Custom)
 */
export function FullJournal4x4Widget({
  currencySymbol = "$",
  totalBalance = 0,
  todaySpent = 0,
  recentTxns = [],
}: Partial<WidgetDataProps>) {
  const displayTxns = recentTxns.slice(0, 5);

  return (
    <FlexWidget
      style={{
        height: "match_parent",
        width: "match_parent",
        backgroundColor: W_COLORS.cream,
        borderRadius: 26,
        borderColor: W_COLORS.cardBorder,
        borderWidth: 2,
        padding: 16,
        flexDirection: "column",
        justifyContent: "space-between",
      }}
    >
      {/* Header Section */}
      <FlexWidget
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottomWidth: 1.5,
          borderColor: W_COLORS.inkMuted,
          paddingBottom: 8,
        }}
        clickAction="OPEN_APP"
      >
        <FlexWidget style={{ flexDirection: "column" }}>
          <TextWidget
            text="Pocket Penny Journal ✿"
            style={{
              fontSize: 13,
              fontWeight: "bold",
              color: W_COLORS.ink,
            }}
          />
          <TextWidget
            text="DAILY EXPENSE TRACKER"
            style={{
              fontSize: 8,
              fontWeight: "bold",
              color: W_COLORS.inkSoft,
              letterSpacing: 0.5,
            }}
          />
        </FlexWidget>

        <FlexWidget style={{ flexDirection: "column", alignItems: "flex-end" }}>
          <TextWidget
            text="TOTAL BALANCE"
            style={{
              fontSize: 8,
              fontWeight: "bold",
              color: W_COLORS.inkSoft,
            }}
          />
          <TextWidget
            text={formatAmount(totalBalance, currencySymbol)}
            style={{
              fontSize: 16,
              fontWeight: "bold",
              color: W_COLORS.ink,
            }}
          />
        </FlexWidget>
      </FlexWidget>

      {/* Middle: Spending Highlight + Recent Activity Feed */}
      <FlexWidget
        style={{
          flex: 1,
          flexDirection: "column",
          paddingVertical: 8,
        }}
        clickAction="OPEN_APP"
      >
        <FlexWidget
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            backgroundColor: W_COLORS.paper,
            borderRadius: 10,
            paddingHorizontal: 10,
            paddingVertical: 6,
            marginBottom: 8,
            borderWidth: 1,
            borderColor: W_COLORS.inkMuted,
          }}
        >
          <TextWidget
            text="TODAY'S TOTAL SPENT:"
            style={{
              fontSize: 10,
              fontWeight: "bold",
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

        <TextWidget
          text="RECENT TRANSACTIONS"
          style={{
            fontSize: 9,
            fontWeight: "bold",
            color: W_COLORS.inkSoft,
            letterSpacing: 0.5,
            marginBottom: 4,
          }}
        />

        {displayTxns.length > 0 ? (
          displayTxns.map((t) => (
            <FlexWidget
              key={t.id}
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                paddingVertical: 3,
                borderBottomWidth: 0.5,
                borderColor: W_COLORS.inkMuted,
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
            text="No transactions recorded yet today."
            style={{
              fontSize: 11,
              color: W_COLORS.inkSoft,
              fontStyle: "italic",
            }}
          />
        )}
      </FlexWidget>

      {/* Bottom Row: Full 1-Tap Action Bar */}
      <FlexWidget
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          flexGap: 5,
          paddingTop: 6,
          borderTopWidth: 1,
          borderColor: W_COLORS.inkMuted,
        }}
      >
        {/* Preset 1: +$5 Coffee */}
        <FlexWidget
          style={{
            flex: 1,
            backgroundColor: W_COLORS.butter,
            borderRadius: 8,
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
              fontSize: 9,
              fontWeight: "bold",
              color: W_COLORS.ink,
              textAlign: "center",
            }}
          />
        </FlexWidget>

        {/* Preset 2: +$15 Meal */}
        <FlexWidget
          style={{
            flex: 1,
            backgroundColor: W_COLORS.peach,
            borderRadius: 8,
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
              fontSize: 9,
              fontWeight: "bold",
              color: W_COLORS.ink,
              textAlign: "center",
            }}
          />
        </FlexWidget>

        {/* Preset 3: +$25 Market */}
        <FlexWidget
          style={{
            flex: 1,
            backgroundColor: W_COLORS.lavender,
            borderRadius: 8,
            borderColor: W_COLORS.cardBorder,
            borderWidth: 1.5,
            paddingVertical: 6,
            alignItems: "center",
            justifyContent: "center",
          }}
          clickAction="ADD_PRESET"
          clickActionData={{
            amount: 25,
            category: "groceries",
            note: "Groceries",
          }}
        >
          <TextWidget
            text={`+${currencySymbol}25 Market`}
            style={{
              fontSize: 9,
              fontWeight: "bold",
              color: W_COLORS.ink,
              textAlign: "center",
            }}
          />
        </FlexWidget>

        {/* Preset 4: +$50 Bills */}
        <FlexWidget
          style={{
            flex: 1,
            backgroundColor: W_COLORS.mint,
            borderRadius: 8,
            borderColor: W_COLORS.cardBorder,
            borderWidth: 1.5,
            paddingVertical: 6,
            alignItems: "center",
            justifyContent: "center",
          }}
          clickAction="ADD_PRESET"
          clickActionData={{
            amount: 50,
            category: "bills",
            note: "Bills",
          }}
        >
          <TextWidget
            text={`+${currencySymbol}50 Bills`}
            style={{
              fontSize: 9,
              fontWeight: "bold",
              color: W_COLORS.ink,
              textAlign: "center",
            }}
          />
        </FlexWidget>

        {/* Custom Plus Button */}
        <FlexWidget
          style={{
            width: 32,
            backgroundColor: W_COLORS.cream,
            borderRadius: 8,
            borderColor: W_COLORS.cardBorder,
            borderWidth: 1.5,
            paddingVertical: 6,
            alignItems: "center",
            justifyContent: "center",
          }}
          clickAction="OPEN_URI"
          clickActionData={{ uri: "pocket://quick-add?fromWidget=true" }}
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

