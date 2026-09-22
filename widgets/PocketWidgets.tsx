import React from "react";
import {
  FlexWidget,
  TextWidget,
} from "react-native-android-widget";
import { DEFAULT_CURRENCY } from "../constants/currencies";

/**
 * Tactile Cozy Brutalist Palette from user's design preview
 */
const POCKET_COLORS = {
  bg: "#FAF5EA",
  darkbg: "#141211",
  paper: "#FFFDF9",
  border: "#29221F",
  creamDark: "#F1E9D7",
  coral: "#FF8A65",
  coralLight: "#FFE8DF",
  butter: "#F5C869",
  butterLight: "#FDF3DC",
  sage: "#8FD3B4",
  sageLight: "#E2F6EE",
  lavender: "#C6B6E8",
  lavenderLight: "#EFEAFD",
  sky: "#9FD6EA",
  muted: "#7E756F",
  subtle: "#B8ADA4",
  success: "#1F6347",
} as const;

export interface WidgetDataProps {
  currencySymbol: string;
  totalBalance: number;
  todaySpent: number;
  todayIncome?: number;
  recentTxns: Array<{
    id: string;
    type: "expense" | "income";
    amount: number;
    category: string;
    note: string;
    date?: string;
  }>;
}

/**
 * Formats numbers into clean currency strings with 2 decimals (e.g. -₱100.00).
 */
function formatAmount(num: number, symbol: string): string {
  const isNegative = num < 0;
  const abs = Math.abs(num);
  const formatted = abs.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return isNegative ? `-${symbol}${formatted}` : `${symbol}${formatted}`;
}

/**
 * Resolves category emoji matching the user's preview design.
 */
function getCategoryEmoji(category: string, note?: string): string {
  const n = (note || "").toLowerCase();
  if (n.includes("tissue") || n.includes("market") || n.includes("grocery") || n.includes("mart") || n.includes("store")) return "🛍️";
  if (n.includes("coffee") || n.includes("cafe") || n.includes("tea") || n.includes("latte") || n.includes("white")) return "☕";
  if (n.includes("lunch") || n.includes("meal") || n.includes("dinner") || n.includes("ramen") || n.includes("food")) return "🍽️";
  if (n.includes("bill") || n.includes("electric") || n.includes("water") || n.includes("wifi")) return "💡";
  if (n.includes("gas") || n.includes("fare") || n.includes("ride") || n.includes("bus")) return "🚌";

  const map: Record<string, string> = {
    food_beverage: "🍽️",
    groceries: "🛒",
    transportation: "🚌",
    bills: "💡",
    bills_utilities: "💡",
    shopping: "🛍️",
    fun: "🎬",
    travel: "✈️",
    health: "💊",
    salary: "💼",
    freelance: "💻",
    gift: "🎁",
    bonus: "💰",
  };
  return map[category] || "🛍️";
}

/**
 * Formats category key into clean human-readable label.
 */
function getCategoryLabel(category: string): string {
  const map: Record<string, string> = {
    food_beverage: "Food & Beverage",
    groceries: "Groceries",
    transportation: "Transportation",
    bills: "Bills & Utilities",
    bills_utilities: "Bills & Utilities",
    shopping: "Shopping",
    fun: "Fun",
    travel: "Travel",
    health: "Health",
    salary: "Salary",
    freelance: "Freelance",
    gift: "Gift",
    bonus: "Bonus",
  };
  return map[category] || "Shopping";
}

/**
 * 1. 1x1 Quick Entry Widget
 * Compact brutalist button that triggers instant Quick-Add popup modal.
 */
export function QuickAdd1x1Widget({ currencySymbol = DEFAULT_CURRENCY.symbol }: Partial<WidgetDataProps>) {
  return (
    <FlexWidget
      style={{
        height: "match_parent",
        width: "match_parent",
        padding: 3.5,
      }}
    >
      <FlexWidget
        style={{
          height: "match_parent",
          width: "match_parent",
          backgroundColor: POCKET_COLORS.paper,
          borderRadius: 22,
          borderColor: POCKET_COLORS.border,
          borderTopWidth: 2,
          borderLeftWidth: 2,
          borderRightWidth: 3,
          borderBottomWidth: 4.5,
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
            borderRadius: 14,
            backgroundColor: POCKET_COLORS.butter,
            borderColor: POCKET_COLORS.border,
            borderTopWidth: 1.5,
            borderLeftWidth: 1.5,
            borderRightWidth: 2,
            borderBottomWidth: 3,
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 5,
          }}
        >
          <TextWidget
            text="+"
            style={{
              fontSize: 24,
              fontWeight: "bold",
              color: POCKET_COLORS.border,
              textAlign: "center",
            }}
          />
        </FlexWidget>

        <TextWidget
          text="Quick Add"
          style={{
            fontSize: 10.5,
            fontWeight: "bold",
            color: POCKET_COLORS.border,
            textAlign: "center",
          }}
        />
      </FlexWidget>
    </FlexWidget>
  );
}

/**
 * 2. 2x1 Balance & Quick Action Widget
 * Compact horizontal badge with spending, total balance, and a "+" button.
 */
export function Balance2x1Widget({
  currencySymbol = DEFAULT_CURRENCY.symbol,
  totalBalance = 0,
  todaySpent = 0,
}: Partial<WidgetDataProps>) {
  return (
    <FlexWidget
      style={{
        height: "match_parent",
        width: "match_parent",
        padding: 3.5,
      }}
    >
      <FlexWidget
        style={{
          height: "match_parent",
          width: "match_parent",
          backgroundColor: POCKET_COLORS.paper,
          borderRadius: 22,
          borderColor: POCKET_COLORS.border,
          borderTopWidth: 2,
          borderLeftWidth: 2,
          borderRightWidth: 3,
          borderBottomWidth: 4.5,
          padding: 9,
          flexDirection: "row",
          alignItems: "center",
        }}
      >
        {/* Left Column with flex: 1 */}
        <FlexWidget
          style={{
            flex: 1,
            flexDirection: "column",
            justifyContent: "center",
          }}
          clickAction="OPEN_APP"
        >
          <FlexWidget style={{ flexDirection: "row", alignItems: "center", marginBottom: 2 }}>
            <FlexWidget
              style={{
                width: 22,
                height: 22,
                borderRadius: 7,
                backgroundColor: POCKET_COLORS.coralLight,
                borderColor: POCKET_COLORS.border,
                borderWidth: 1.5,
                alignItems: "center",
                justifyContent: "center",
                marginRight: 6,
              }}
            >
              <TextWidget
                text={currencySymbol}
                style={{
                  fontSize: 10,
                  fontWeight: "bold",
                  color: POCKET_COLORS.coral,
                }}
              />
            </FlexWidget>
            <TextWidget
              text="TODAY'S SPENT"
              style={{
                fontSize: 7.5,
                fontWeight: "bold",
                color: POCKET_COLORS.muted,
                letterSpacing: 0.5,
              }}
            />
          </FlexWidget>

          <TextWidget
            text={`-${currencySymbol}${todaySpent.toFixed(2)}`}
            style={{
              fontSize: 14,
              fontWeight: "bold",
              color: POCKET_COLORS.border,
            }}
          />

          <TextWidget
            text={`Total: ${formatAmount(totalBalance, currencySymbol)}`}
            style={{
              fontSize: 9,
              fontWeight: "500",
              color: POCKET_COLORS.muted,
              marginTop: 1,
            }}
          />
        </FlexWidget>

        {/* Right Column: 1-Tap "+" Action */}
        <FlexWidget
          style={{
            width: 38,
            height: 38,
            borderRadius: 13,
            backgroundColor: POCKET_COLORS.sage,
            borderColor: POCKET_COLORS.border,
            borderTopWidth: 1.5,
            borderLeftWidth: 1.5,
            borderRightWidth: 2,
            borderBottomWidth: 3,
            alignItems: "center",
            justifyContent: "center",
          }}
          clickAction="OPEN_URI"
          clickActionData={{ uri: "pocket://quick-add?fromWidget=true" }}
        >
          <TextWidget
            text="+"
            style={{
              fontSize: 20,
              fontWeight: "bold",
              color: POCKET_COLORS.border,
              textAlign: "center",
            }}
          />
        </FlexWidget>
      </FlexWidget>
    </FlexWidget>
  );
}

/**
 * 3. 4x1 Horizontal Pill Bar Widget
 * Directly from user's widget-preview.html:
 * - Icon with currency
 * - Today's Spent (-₱100.00)
 * - Safe limit status indicator
 * - Quick Log button (+ Quick Log)
 */
export function Banner4x1Widget({
  currencySymbol = DEFAULT_CURRENCY.symbol,
  totalBalance = 0,
  todaySpent = 0,
}: Partial<WidgetDataProps>) {
  return (
    <FlexWidget
      style={{
        height: "match_parent",
        width: "match_parent",
        padding: 3.5,
      }}
    >
      <FlexWidget
        style={{
          height: "match_parent",
          width: "match_parent",
          backgroundColor: POCKET_COLORS.paper,
          borderRadius: 24,
          borderColor: POCKET_COLORS.border,
          borderTopWidth: 2,
          borderLeftWidth: 2,
          borderRightWidth: 3,
          borderBottomWidth: 4.5,
          paddingHorizontal: 12,
          paddingVertical: 7,
          flexDirection: "row",
          alignItems: "center",
        }}
      >
        {/* Left Info Group with flex: 1 */}
        <FlexWidget
          style={{
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
          }}
          clickAction="OPEN_APP"
        >
          {/* Currency Icon Box */}
          <FlexWidget
            style={{
              width: 30,
              height: 30,
              borderRadius: 9,
              backgroundColor: POCKET_COLORS.coralLight,
              borderColor: POCKET_COLORS.border,
              borderWidth: 1.5,
              alignItems: "center",
              justifyContent: "center",
              marginRight: 8,
            }}
          >
            <TextWidget
              text={currencySymbol}
              style={{
                fontSize: 11,
                fontWeight: "bold",
                color: POCKET_COLORS.coral,
              }}
            />
          </FlexWidget>

          {/* Today's Spent Text */}
          <FlexWidget style={{ flexDirection: "column" }}>
            <TextWidget
              text="TODAY'S SPENT"
              style={{
                fontSize: 7.5,
                fontWeight: "bold",
                color: POCKET_COLORS.muted,
                letterSpacing: 0.5,
              }}
            />
            <TextWidget
              text={`-${currencySymbol}${todaySpent.toFixed(2)}`}
              style={{
                fontSize: 12,
                fontWeight: "bold",
                color: POCKET_COLORS.border,
                marginTop: 1,
              }}
            />
          </FlexWidget>

          {/* Divider */}
          <FlexWidget
            style={{
              width: 1.5,
              height: 20,
              backgroundColor: "#29221F20",
              marginHorizontal: 10,
            }}
          />

          {/* Status Indicator */}
          <FlexWidget style={{ flexDirection: "row", alignItems: "center" }}>
            <FlexWidget
              style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: POCKET_COLORS.sage,
                marginRight: 4,
              }}
            />
            <TextWidget
              text={`Total: ${formatAmount(totalBalance, currencySymbol)}`}
              style={{
                fontSize: 9,
                fontWeight: "bold",
                color: POCKET_COLORS.muted,
              }}
            />
          </FlexWidget>
        </FlexWidget>

        {/* Right: Quick Log Button */}
        <FlexWidget
          style={{
            height: 30,
            backgroundColor: POCKET_COLORS.butter,
            borderColor: POCKET_COLORS.border,
            borderTopWidth: 1.5,
            borderLeftWidth: 1.5,
            borderRightWidth: 2,
            borderBottomWidth: 3,
            borderRadius: 11,
            paddingHorizontal: 10,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
          }}
          clickAction="OPEN_URI"
          clickActionData={{ uri: "pocket://quick-add?fromWidget=true" }}
        >
          <TextWidget
            text="+ Quick Log"
            style={{
              fontSize: 10.5,
              fontWeight: "bold",
              color: POCKET_COLORS.border,
            }}
          />
        </FlexWidget>
      </FlexWidget>
    </FlexWidget>
  );
}

/**
 * 4. 2x2 Pocket Journal Glance Widget
 * Compact square notebook companion matching the brutalist theme.
 */
export function Glance2x2Widget({
  currencySymbol = DEFAULT_CURRENCY.symbol,
  totalBalance = 0,
  todaySpent = 0,
  recentTxns = [],
}: Partial<WidgetDataProps>) {
  const displayTxns = recentTxns.slice(0, 1);

  return (
    <FlexWidget
      style={{
        height: "match_parent",
        width: "match_parent",
        padding: 3.5,
      }}
    >
      <FlexWidget
        style={{
          height: "match_parent",
          width: "match_parent",
          backgroundColor: POCKET_COLORS.paper,
          borderRadius: 24,
          borderColor: POCKET_COLORS.border,
          borderTopWidth: 2,
          borderLeftWidth: 2,
          borderRightWidth: 3,
          borderBottomWidth: 4.5,
          padding: 10,
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        {/* Header: Brand & Balance */}
        <FlexWidget
          style={{
            flexDirection: "row",
            alignItems: "center",
            borderBottomWidth: 1.5,
            borderColor: "#29221F18",
            paddingBottom: 4,
          }}
          clickAction="OPEN_APP"
        >
          <FlexWidget style={{ flex: 1, flexDirection: "row", alignItems: "center" }}>
            <TextWidget
              text="pocket journal "
              style={{
                fontSize: 9.5,
                fontWeight: "bold",
                color: POCKET_COLORS.border,
              }}
            />
            <TextWidget
              text="✿"
              style={{
                fontSize: 8,
                color: POCKET_COLORS.coral,
              }}
            />
          </FlexWidget>
          <TextWidget
            text={formatAmount(totalBalance, currencySymbol)}
            style={{
              fontSize: 11,
              fontWeight: "bold",
              color: POCKET_COLORS.border,
            }}
          />
        </FlexWidget>

        {/* Today's Spent Mini Card */}
        <FlexWidget
          style={{
            backgroundColor: POCKET_COLORS.coralLight,
            borderColor: POCKET_COLORS.border,
            borderTopWidth: 1.5,
            borderLeftWidth: 1.5,
            borderRightWidth: 2,
            borderBottomWidth: 2.5,
            borderRadius: 11,
            paddingHorizontal: 8,
            paddingVertical: 5,
            marginVertical: 4,
          }}
          clickAction="OPEN_APP"
        >
          <TextWidget
            text="TODAY'S SPENT"
            style={{
              fontSize: 7,
              fontWeight: "bold",
              color: POCKET_COLORS.coral,
            }}
          />
          <TextWidget
            text={`${currencySymbol}${todaySpent.toFixed(2)}`}
            style={{
              fontSize: 12,
              fontWeight: "bold",
              color: POCKET_COLORS.coral,
              marginTop: 1,
            }}
          />
        </FlexWidget>

        {/* Recent Activity Card */}
        <FlexWidget
          style={{
            flexDirection: "column",
            justifyContent: "center",
            marginVertical: 2,
          }}
          clickAction="OPEN_APP"
        >
          {displayTxns.length > 0 ? (
            displayTxns.map((t) => (
              <FlexWidget
                key={t.id}
                style={{
                  backgroundColor: POCKET_COLORS.bg,
                  borderColor: POCKET_COLORS.border,
                  borderWidth: 1.5,
                  borderRadius: 11,
                  padding: 5,
                  flexDirection: "row",
                  alignItems: "center",
                }}
              >
                <FlexWidget
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 6,
                    backgroundColor: POCKET_COLORS.butter,
                    borderColor: POCKET_COLORS.border,
                    borderWidth: 1,
                    alignItems: "center",
                    justifyContent: "center",
                    marginRight: 6,
                  }}
                >
                  <TextWidget
                    text={getCategoryEmoji(t.category, t.note)}
                    style={{ fontSize: 9.5 }}
                  />
                </FlexWidget>

                <FlexWidget style={{ flex: 1, flexDirection: "column" }}>
                  <TextWidget
                    text={t.note ? t.note : t.category}
                    style={{
                      fontSize: 9.5,
                      fontWeight: "bold",
                      color: POCKET_COLORS.border,
                    }}
                    maxLines={1}
                    truncate="END"
                  />
                  <TextWidget
                    text={getCategoryLabel(t.category)}
                    style={{
                      fontSize: 7,
                      fontWeight: "bold",
                      color: POCKET_COLORS.muted,
                    }}
                    maxLines={1}
                  />
                </FlexWidget>

                <TextWidget
                  text={`${t.type === "income" ? "+" : "-"}${currencySymbol}${t.amount.toFixed(0)}`}
                  style={{
                    fontSize: 10,
                    fontWeight: "bold",
                    color: t.type === "income" ? POCKET_COLORS.success : POCKET_COLORS.coral,
                    marginLeft: 4,
                  }}
                />
              </FlexWidget>
            ))
          ) : (
            <TextWidget
              text="✿ No expenses yet today"
              style={{
                fontSize: 9,
                color: POCKET_COLORS.muted,
                fontStyle: "italic",
                textAlign: "center",
              }}
            />
          )}
        </FlexWidget>

        {/* Bottom Action: Log Expense button */}
        <FlexWidget
          style={{
            height: 28,
            backgroundColor: POCKET_COLORS.sage,
            borderColor: POCKET_COLORS.border,
            borderTopWidth: 1.5,
            borderLeftWidth: 1.5,
            borderRightWidth: 2,
            borderBottomWidth: 2.5,
            borderRadius: 10,
            alignItems: "center",
            justifyContent: "center",
            marginTop: 2,
          }}
          clickAction="OPEN_URI"
          clickActionData={{ uri: "pocket://quick-add?fromWidget=true" }}
        >
          <TextWidget
            text="+ Quick Log"
            style={{
              fontSize: 10,
              fontWeight: "bold",
              color: POCKET_COLORS.border,
            }}
          />
        </FlexWidget>
      </FlexWidget>
    </FlexWidget>
  );
}

/**
 * 5. 4x2 Medium Dual Dashboard Widget
 * Directly from user's widget-preview.html:
 * - Left Pane: pocket journal ✿, Total Balance, Today's Spent mini card
 * - Right Pane: Recent Activity card with category emoji, and "+ Log Expense" button
 */
export function Dashboard4x2Widget({
  currencySymbol = DEFAULT_CURRENCY.symbol,
  totalBalance = 0,
  todaySpent = 0,
  recentTxns = [],
}: Partial<WidgetDataProps>) {
  const displayTxns = recentTxns.slice(0, 1);

  return (
    <FlexWidget
      style={{
        height: "match_parent",
        width: "match_parent",
        padding: 3.5,
      }}
    >
      <FlexWidget
        style={{
          height: "match_parent",
          width: "match_parent",
          backgroundColor: POCKET_COLORS.paper,
          borderRadius: 26,
          borderColor: POCKET_COLORS.border,
          borderTopWidth: 2,
          borderLeftWidth: 2,
          borderRightWidth: 3.5,
          borderBottomWidth: 5,
          padding: 11,
          flexDirection: "row",
        }}
      >
        {/* Left Column (Balances & Stats) */}
        <FlexWidget
          style={{
            width: 105,
            flexDirection: "column",
            borderRightWidth: 1.5,
            borderColor: "#29221F18",
            paddingRight: 9,
            justifyContent: "space-between",
          }}
          clickAction="OPEN_APP"
        >
          <FlexWidget style={{ flexDirection: "column" }}>
            <FlexWidget style={{ flexDirection: "row", alignItems: "center" }}>
              <TextWidget
                text="pocket journal "
                style={{
                  fontSize: 10,
                  fontWeight: "bold",
                  color: POCKET_COLORS.border,
                }}
              />
              <TextWidget
                text="✿"
                style={{
                  fontSize: 8.5,
                  color: POCKET_COLORS.coral,
                }}
              />
            </FlexWidget>

            <TextWidget
              text="TOTAL BALANCE"
              style={{
                fontSize: 7.5,
                fontWeight: "bold",
                color: POCKET_COLORS.muted,
                letterSpacing: 0.5,
                marginTop: 3,
              }}
            />

            <TextWidget
              text={formatAmount(totalBalance, currencySymbol)}
              style={{
                fontSize: 14,
                fontWeight: "bold",
                color: POCKET_COLORS.border,
                marginTop: 1,
              }}
            />
          </FlexWidget>

          {/* Today Spent Mini Card */}
          <FlexWidget
            style={{
              backgroundColor: POCKET_COLORS.coralLight,
              borderColor: POCKET_COLORS.border,
              borderTopWidth: 1.5,
              borderLeftWidth: 1.5,
              borderRightWidth: 2,
              borderBottomWidth: 2.5,
              borderRadius: 11,
              padding: 6,
            }}
          >
            <TextWidget
              text="TODAY'S SPENT"
              style={{
                fontSize: 7,
                fontWeight: "bold",
                color: POCKET_COLORS.coral,
              }}
            />
            <TextWidget
              text={`${currencySymbol}${todaySpent.toFixed(2)}`}
              style={{
                fontSize: 12,
                fontWeight: "bold",
                color: POCKET_COLORS.coral,
                marginTop: 1,
              }}
            />
          </FlexWidget>
        </FlexWidget>

        {/* Right Column (Recent Activity & Instant Action) */}
        <FlexWidget
          style={{
            flex: 1,
            flexDirection: "column",
            paddingLeft: 9,
            justifyContent: "space-between",
          }}
        >
          {/* Header row */}
          <FlexWidget
            style={{
              flexDirection: "row",
              alignItems: "center",
            }}
            clickAction="OPEN_APP"
          >
            <FlexWidget style={{ flex: 1 }}>
              <TextWidget
                text="RECENT ACTIVITY"
                style={{
                  fontSize: 7.5,
                  fontWeight: "bold",
                  color: POCKET_COLORS.muted,
                  letterSpacing: 0.5,
                }}
              />
            </FlexWidget>
            <TextWidget
              text="✿"
              style={{
                fontSize: 8,
                color: POCKET_COLORS.subtle,
              }}
            />
          </FlexWidget>

          {/* Recent Activity Card */}
          <FlexWidget
            style={{
              flex: 1,
              justifyContent: "center",
              paddingVertical: 2,
            }}
            clickAction="OPEN_APP"
          >
            {displayTxns.length > 0 ? (
              displayTxns.map((t) => (
                <FlexWidget
                  key={t.id}
                  style={{
                    backgroundColor: POCKET_COLORS.bg,
                    borderColor: POCKET_COLORS.border,
                    borderWidth: 1.5,
                    borderRadius: 11,
                    padding: 6,
                    flexDirection: "row",
                    alignItems: "center",
                  }}
                >
                  <FlexWidget
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 7,
                      backgroundColor: POCKET_COLORS.butter,
                      borderColor: POCKET_COLORS.border,
                      borderWidth: 1,
                      alignItems: "center",
                      justifyContent: "center",
                      marginRight: 6,
                    }}
                  >
                    <TextWidget
                      text={getCategoryEmoji(t.category, t.note)}
                      style={{ fontSize: 10 }}
                    />
                  </FlexWidget>

                  <FlexWidget style={{ flex: 1, flexDirection: "column" }}>
                    <TextWidget
                      text={t.note ? t.note : t.category}
                      style={{
                        fontSize: 9.5,
                        fontWeight: "bold",
                        color: POCKET_COLORS.border,
                      }}
                      maxLines={1}
                      truncate="END"
                    />
                    <TextWidget
                      text={getCategoryLabel(t.category)}
                      style={{
                        fontSize: 7,
                        fontWeight: "bold",
                        color: POCKET_COLORS.muted,
                      }}
                    />
                  </FlexWidget>

                  <TextWidget
                    text={`${t.type === "income" ? "+" : "-"}${currencySymbol}${t.amount.toFixed(0)}`}
                    style={{
                      fontSize: 10.5,
                      fontWeight: "bold",
                      color: t.type === "income" ? POCKET_COLORS.success : POCKET_COLORS.coral,
                      marginLeft: 4,
                    }}
                  />
                </FlexWidget>
              ))
            ) : (
              <FlexWidget
                style={{
                  backgroundColor: POCKET_COLORS.bg,
                  borderColor: POCKET_COLORS.border,
                  borderWidth: 1.5,
                  borderRadius: 11,
                  padding: 6,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <TextWidget
                  text="✿ No expenses recorded yet"
                  style={{
                    fontSize: 8.5,
                    color: POCKET_COLORS.muted,
                    fontStyle: "italic",
                  }}
                />
              </FlexWidget>
            )}
          </FlexWidget>

          {/* Bottom Row Action Button */}
          <FlexWidget
            style={{
              height: 30,
              backgroundColor: POCKET_COLORS.sage,
              borderColor: POCKET_COLORS.border,
              borderTopWidth: 1.5,
              borderLeftWidth: 1.5,
              borderRightWidth: 2,
              borderBottomWidth: 3,
              borderRadius: 11,
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "row",
            }}
            clickAction="OPEN_URI"
            clickActionData={{ uri: "pocket://quick-add?fromWidget=true" }}
          >
            <TextWidget
              text="+ Log Expense"
              style={{
                fontSize: 10.5,
                fontWeight: "bold",
                color: POCKET_COLORS.border,
              }}
            />
          </FlexWidget>
        </FlexWidget>
      </FlexWidget>
    </FlexWidget>
  );
}

/**
 * 6. 4x4 Large Journal Hub Widget
 * Directly from user's widget-preview.html:
 * - Header: Pocket Penny Journal ✿, Today sparkle badge
 * - Metric split cards: ↙ Income (+₱0.00) & ↗ Spent (-₱100.00) with progress tracks
 * - Notebook Entries list with category emoji cards + lined notebook slots
 * - Bottom Action Row: Quick note or expense... + Instant tag
 */
export function FullJournal4x4Widget({
  currencySymbol = DEFAULT_CURRENCY.symbol,
  totalBalance = 0,
  todaySpent = 0,
  todayIncome = 0,
  recentTxns = [],
}: Partial<WidgetDataProps>) {
  const displayTxns = recentTxns.slice(0, 3);
  const emptySlotsCount = Math.max(0, 3 - displayTxns.length);

  return (
    <FlexWidget
      style={{
        height: "match_parent",
        width: "match_parent",
        padding: 4,
      }}
    >
      <FlexWidget
        style={{
          height: "match_parent",
          width: "match_parent",
          backgroundColor: POCKET_COLORS.paper,
          borderRadius: 28,
          borderColor: POCKET_COLORS.border,
          borderTopWidth: 2,
          borderLeftWidth: 2,
          borderRightWidth: 3.5,
          borderBottomWidth: 5.5,
          padding: 12,
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        {/* 1. Header: Name, date & sparkle */}
        <FlexWidget
          style={{
            flexDirection: "row",
            alignItems: "center",
            borderBottomWidth: 1.5,
            borderColor: "#29221F18",
            paddingBottom: 7,
          }}
          clickAction="OPEN_APP"
        >
          <FlexWidget
            style={{
              flex: 1,
              flexDirection: "column",
            }}
          >
            <FlexWidget style={{ flexDirection: "row", alignItems: "center" }}>
              <TextWidget
                text="Pocket Penny Journal "
                style={{
                  fontSize: 12.5,
                  fontWeight: "bold",
                  color: POCKET_COLORS.border,
                }}
              />
              <TextWidget
                text="✿"
                style={{
                  fontSize: 9.5,
                  color: POCKET_COLORS.coral,
                }}
              />
            </FlexWidget>
            <TextWidget
              text="DAILY EXPENSE TRACKER"
              style={{
                fontSize: 7.5,
                fontWeight: "bold",
                color: POCKET_COLORS.muted,
                letterSpacing: 0.5,
                marginTop: 1,
              }}
            />
          </FlexWidget>

          <FlexWidget
            style={{
              backgroundColor: POCKET_COLORS.butterLight,
              borderColor: POCKET_COLORS.border,
              borderTopWidth: 1,
              borderLeftWidth: 1,
              borderRightWidth: 1.5,
              borderBottomWidth: 2,
              borderRadius: 10,
              paddingHorizontal: 7,
              paddingVertical: 3,
              flexDirection: "row",
              alignItems: "center",
            }}
          >
            <TextWidget
              text="✦ Today"
              style={{
                fontSize: 8.5,
                fontWeight: "bold",
                color: POCKET_COLORS.border,
              }}
            />
          </FlexWidget>
        </FlexWidget>

        {/* 2. Metric split cards (Income & Spent) with Progress Bars */}
        <FlexWidget
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginVertical: 4,
          }}
          clickAction="OPEN_APP"
        >
          {/* Income Card */}
          <FlexWidget
            style={{
              flex: 1,
              backgroundColor: POCKET_COLORS.sageLight,
              borderColor: POCKET_COLORS.border,
              borderTopWidth: 1.5,
              borderLeftWidth: 1.5,
              borderRightWidth: 2,
              borderBottomWidth: 2.5,
              borderRadius: 12,
              padding: 7,
              marginRight: 6,
            }}
          >
            <FlexWidget style={{ flexDirection: "row", alignItems: "center" }}>
              <FlexWidget style={{ flex: 1 }}>
                <TextWidget
                  text="↙ INCOME"
                  style={{
                    fontSize: 7.5,
                    fontWeight: "bold",
                    color: POCKET_COLORS.success,
                    letterSpacing: 0.5,
                  }}
                />
              </FlexWidget>
              <TextWidget text="🌱" style={{ fontSize: 8 }} />
            </FlexWidget>
            <TextWidget
              text={`+${currencySymbol}${todayIncome.toFixed(2)}`}
              style={{
                fontSize: 12.5,
                fontWeight: "bold",
                color: POCKET_COLORS.success,
                marginTop: 2,
              }}
            />
            {/* Progress track */}
            <FlexWidget
              style={{
                height: 3.5,
                backgroundColor: "#8FD3B450",
                borderRadius: 2,
                marginTop: 4,
              }}
            >
              <FlexWidget
                style={{
                  height: 3.5,
                  width: todayIncome > 0 ? 40 : 12,
                  backgroundColor: POCKET_COLORS.sage,
                  borderRadius: 2,
                }}
              />
            </FlexWidget>
          </FlexWidget>

          {/* Spent Card */}
          <FlexWidget
            style={{
              flex: 1,
              backgroundColor: POCKET_COLORS.coralLight,
              borderColor: POCKET_COLORS.border,
              borderTopWidth: 1.5,
              borderLeftWidth: 1.5,
              borderRightWidth: 2,
              borderBottomWidth: 2.5,
              borderRadius: 12,
              padding: 7,
            }}
          >
            <FlexWidget style={{ flexDirection: "row", alignItems: "center" }}>
              <FlexWidget style={{ flex: 1 }}>
                <TextWidget
                  text="↗ SPENT"
                  style={{
                    fontSize: 7.5,
                    fontWeight: "bold",
                    color: POCKET_COLORS.coral,
                    letterSpacing: 0.5,
                  }}
                />
              </FlexWidget>
              <TextWidget text="🔥" style={{ fontSize: 8 }} />
            </FlexWidget>
            <TextWidget
              text={`-${currencySymbol}${todaySpent.toFixed(2)}`}
              style={{
                fontSize: 12.5,
                fontWeight: "bold",
                color: POCKET_COLORS.coral,
                marginTop: 2,
              }}
            />
            {/* Progress track */}
            <FlexWidget
              style={{
                height: 3.5,
                backgroundColor: "#FF8A6540",
                borderRadius: 2,
                marginTop: 4,
              }}
            >
              <FlexWidget
                style={{
                  height: 3.5,
                  width: todaySpent > 0 ? 55 : 12,
                  backgroundColor: POCKET_COLORS.coral,
                  borderRadius: 2,
                }}
              />
            </FlexWidget>
          </FlexWidget>
        </FlexWidget>

        {/* 3. Notebook Recent Entries List */}
        <FlexWidget
          style={{
            flex: 1,
            flexDirection: "column",
            justifyContent: "flex-start",
            paddingVertical: 2,
          }}
          clickAction="OPEN_APP"
        >
          <FlexWidget
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginBottom: 4,
            }}
          >
            <FlexWidget style={{ flex: 1 }}>
              <TextWidget
                text="NOTEBOOK ENTRIES"
                style={{
                  fontSize: 7.5,
                  fontWeight: "bold",
                  color: POCKET_COLORS.muted,
                  letterSpacing: 0.5,
                }}
              />
            </FlexWidget>
            <TextWidget
              text="↓ Newest"
              style={{
                fontSize: 7.5,
                fontWeight: "bold",
                color: POCKET_COLORS.muted,
              }}
            />
          </FlexWidget>

          {/* Actual logged transactions */}
          {displayTxns.map((t) => (
            <FlexWidget
              key={t.id}
              style={{
                backgroundColor: POCKET_COLORS.bg,
                borderColor: POCKET_COLORS.border,
                borderWidth: 1.5,
                borderRadius: 11,
                padding: 5.5,
                marginBottom: 4,
                flexDirection: "row",
                alignItems: "center",
              }}
            >
              {/* Category Icon */}
              <FlexWidget
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 7,
                  backgroundColor: POCKET_COLORS.butter,
                  borderColor: POCKET_COLORS.border,
                  borderWidth: 1,
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: 6,
                }}
              >
                <TextWidget
                  text={getCategoryEmoji(t.category, t.note)}
                  style={{ fontSize: 11 }}
                />
              </FlexWidget>

              {/* Title & Category */}
              <FlexWidget style={{ flex: 1, flexDirection: "column" }}>
                <TextWidget
                  text={t.note ? t.note : t.category}
                  style={{
                    fontSize: 9.5,
                    fontWeight: "bold",
                    color: POCKET_COLORS.border,
                  }}
                  maxLines={1}
                  truncate="END"
                />
                <TextWidget
                  text={getCategoryLabel(t.category)}
                  style={{
                    fontSize: 7,
                    fontWeight: "bold",
                    color: POCKET_COLORS.muted,
                  }}
                />
              </FlexWidget>

              {/* Amount */}
              <TextWidget
                text={`${t.type === "income" ? "+" : "-"}${currencySymbol}${t.amount.toFixed(2)}`}
                style={{
                  fontSize: 10,
                  fontWeight: "bold",
                  color: t.type === "income" ? POCKET_COLORS.success : POCKET_COLORS.coral,
                  marginLeft: 4,
                }}
              />
            </FlexWidget>
          ))}

          {/* Charming Notebook Lined Placeholders so there is never an empty void */}
          {emptySlotsCount > 0 &&
            Array.from({ length: Math.min(emptySlotsCount, 2) }).map((_, idx) => (
              <FlexWidget
                key={`empty-slot-${idx}`}
                style={{
                  backgroundColor: POCKET_COLORS.bg,
                  borderColor: "#29221F25",
                  borderWidth: 1,
                  borderStyle: "dashed",
                  borderRadius: 11,
                  padding: 5.5,
                  marginBottom: 4,
                  flexDirection: "row",
                  alignItems: "center",
                }}
                clickAction="OPEN_URI"
                clickActionData={{ uri: "pocket://quick-add?fromWidget=true" }}
              >
                <FlexWidget
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 7,
                    backgroundColor: POCKET_COLORS.butterLight,
                    alignItems: "center",
                    justifyContent: "center",
                    marginRight: 6,
                  }}
                >
                  <TextWidget text="✏️" style={{ fontSize: 10 }} />
                </FlexWidget>

                <FlexWidget style={{ flex: 1 }}>
                  <TextWidget
                    text="Tap to log an expense..."
                    style={{
                      fontSize: 8.5,
                      fontStyle: "italic",
                      color: POCKET_COLORS.muted,
                    }}
                  />
                </FlexWidget>

                <TextWidget
                  text="+ Add"
                  style={{
                    fontSize: 8,
                    fontWeight: "bold",
                    color: POCKET_COLORS.border,
                  }}
                />
              </FlexWidget>
            ))}
        </FlexWidget>

        {/* 4. Bottom Action Row: Multi Quick Add Bar */}
        <FlexWidget
          style={{
            backgroundColor: POCKET_COLORS.bg,
            borderColor: POCKET_COLORS.border,
            borderTopWidth: 1.5,
            borderLeftWidth: 1.5,
            borderRightWidth: 2,
            borderBottomWidth: 3,
            borderRadius: 11,
            paddingHorizontal: 9,
            paddingVertical: 6,
            flexDirection: "row",
            alignItems: "center",
            marginTop: 2,
          }}
          clickAction="OPEN_URI"
          clickActionData={{ uri: "pocket://quick-add?fromWidget=true" }}
        >
          <FlexWidget
            style={{
              width: 18,
              height: 18,
              borderRadius: 5,
              backgroundColor: POCKET_COLORS.coral,
              alignItems: "center",
              justifyContent: "center",
              marginRight: 7,
            }}
          >
            <TextWidget
              text="+"
              style={{
                fontSize: 11,
                fontWeight: "bold",
                color: "#FFFFFF",
                textAlign: "center",
              }}
            />
          </FlexWidget>

          <FlexWidget style={{ flex: 1 }}>
            <TextWidget
              text="Quick note or expense..."
              style={{
                fontSize: 9,
                fontWeight: "bold",
                color: POCKET_COLORS.muted,
              }}
            />
          </FlexWidget>

          <FlexWidget
            style={{
              backgroundColor: POCKET_COLORS.paper,
              borderColor: POCKET_COLORS.border,
              borderWidth: 1,
              borderRadius: 5,
              paddingHorizontal: 5,
              paddingVertical: 1.5,
            }}
          >
            <TextWidget
              text="Instant"
              style={{
                fontSize: 7.5,
                fontWeight: "bold",
                color: POCKET_COLORS.subtle,
              }}
            />
          </FlexWidget>
        </FlexWidget>
      </FlexWidget>
    </FlexWidget>
  );
}
