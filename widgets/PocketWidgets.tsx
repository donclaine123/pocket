import React from "react";
import { Appearance } from "react-native";
import {
  FlexWidget,
  TextWidget,
  ImageWidget,
} from "react-native-android-widget";
import { DEFAULT_CURRENCY } from "../constants/currencies";
import { POCKET_LOGO_BASE64 } from "./logoAsset";

/**
 * Tactile Cozy Brutalist Palette - Supports dynamic Light & Dark themes
 */
export const POCKET_COLORS = {
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

export type WidgetTheme = ReturnType<typeof getWidgetTheme>;

export function getWidgetTheme(isDark: boolean) {
  if (isDark) {
    return {
      isDark: true,
      shadow: "#000000",
      paper: "#1B1715",
      border: "#423934",
      borderSubtle: "#332B26",
      divider: "#2D2622",
      bg: "#241F1C",
      textPrimary: "#F7F2EB",
      textMuted: "#A3978E",
      textSubtle: "#756B63",
      coral: "#FF9270",
      coralLight: "#38221B",
      coralBorder: "#5A3026",
      butter: "#F5C869",
      butterLight: "#362A17",
      butterBorder: "#544122",
      tagButterText: "#F5C869",
      sage: "#8FD3B4",
      sageLight: "#183226",
      sageBorder: "#254D3B",
      incomeText: "#8FD3B4",
      actionBtnBg: "#8FD3B4",
      actionBtnText: "#18261E",
      actionBtnBorder: "#423934",
      instantPillBg: "#29231F",
      instantPillText: "#A3978E",
      placeholderBg: "#221D1A",
      placeholderBorder: "#38302B",
      trackIncomeBg: "#204233",
      trackSpentBg: "#47271E",
    } as const;
  }
  return {
    isDark: false,
    shadow: "#29221F",
    paper: "#FFFDF9",
    border: "#29221F",
    borderSubtle: "#29221F25",
    divider: "#29221F18",
    bg: "#FAF5EA",
    textPrimary: "#29221F",
    textMuted: "#7E756F",
    textSubtle: "#B8ADA4",
    coral: "#FF8A65",
    coralLight: "#FFE8DF",
    coralBorder: "#29221F",
    butter: "#F5C869",
    butterLight: "#FDF3DC",
    butterBorder: "#29221F",
    tagButterText: "#29221F",
    sage: "#8FD3B4",
    sageLight: "#E2F6EE",
    sageBorder: "#29221F",
    incomeText: "#1F6347",
    actionBtnBg: "#8FD3B4",
    actionBtnText: "#29221F",
    actionBtnBorder: "#29221F",
    instantPillBg: "#FFFDF9",
    instantPillText: "#B8ADA4",
    placeholderBg: "#FAF5EA",
    placeholderBorder: "#29221F25",
    trackIncomeBg: "#8FD3B450",
    trackSpentBg: "#FF8A6540",
  } as const;
}

export function resolveIsDark(propsDark?: boolean): boolean {
  if (typeof propsDark === "boolean") return propsDark;
  try {
    return Appearance.getColorScheme() === "dark";
  } catch {
    return false;
  }
}

export interface WidgetDataProps {
  currencySymbol: string;
  totalBalance: number;
  todaySpent: number;
  todayIncome?: number;
  isDark?: boolean;
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
export function QuickAdd1x1Widget(props: Partial<WidgetDataProps>) {
  const { currencySymbol = DEFAULT_CURRENCY.symbol } = props;
  const isDark = resolveIsDark(props.isDark);
  const theme = getWidgetTheme(isDark);

  return (
    <FlexWidget
      style={{
        height: "match_parent",
        width: "match_parent",
        padding: 3,
      }}
    >
      {/* Brutalist Shadow Container */}
      <FlexWidget
        style={{
          height: "match_parent",
          width: "match_parent",
          backgroundColor: theme.shadow,
          borderRadius: 24,
          paddingRight: 3,
          paddingBottom: 4,
        }}
      >
        {/* Main Card */}
        <FlexWidget
          style={{
            height: "match_parent",
            width: "match_parent",
            backgroundColor: theme.paper,
            borderRadius: 22,
            borderColor: theme.border,
            borderWidth: 2,
            alignItems: "center",
            justifyContent: "center",
            padding: 8,
          }}
          clickAction="OPEN_URI"
          clickActionData={{ uri: "pocket://quick-add?fromWidget=true" }}
        >
          {/* Button with Brutalist Shadow */}
          <FlexWidget
            style={{
              backgroundColor: theme.shadow,
              borderRadius: 14,
              paddingRight: 2,
              paddingBottom: 2.5,
              marginBottom: 5,
            }}
          >
            <FlexWidget
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                backgroundColor: theme.butter,
                borderColor: theme.butterBorder,
                borderWidth: 1.5,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ImageWidget
                image={POCKET_LOGO_BASE64}
                imageWidth={28}
                imageHeight={28}
              />
            </FlexWidget>
          </FlexWidget>

          <TextWidget
            text="Quick Add"
            style={{
              fontSize: 10.5,
              fontWeight: "bold",
              color: theme.textPrimary,
              textAlign: "center",
            }}
          />
        </FlexWidget>
      </FlexWidget>
    </FlexWidget>
  );
}

/**
 * 2. 2x1 Balance & Quick Action Widget
 * Compact horizontal badge with spending, total balance, and a "+" button.
 */
export function Balance2x1Widget(props: Partial<WidgetDataProps>) {
  const {
    currencySymbol = DEFAULT_CURRENCY.symbol,
    totalBalance = 0,
    todaySpent = 0,
  } = props;
  const isDark = resolveIsDark(props.isDark);
  const theme = getWidgetTheme(isDark);

  return (
    <FlexWidget
      style={{
        height: "match_parent",
        width: "match_parent",
        padding: 3,
      }}
    >
      <FlexWidget
        style={{
          height: "match_parent",
          width: "match_parent",
          backgroundColor: theme.shadow,
          borderRadius: 24,
          paddingRight: 3,
          paddingBottom: 4,
        }}
      >
        <FlexWidget
          style={{
            height: "match_parent",
            width: "match_parent",
            backgroundColor: theme.paper,
            borderRadius: 22,
            borderColor: theme.border,
            borderWidth: 2,
            padding: 10,
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
                  backgroundColor: theme.coralLight,
                  borderColor: theme.coralBorder,
                  borderWidth: 1.5,
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: 6,
                }}
              >
                <ImageWidget
                  image={POCKET_LOGO_BASE64}
                  imageWidth={16}
                  imageHeight={16}
                />
              </FlexWidget>
              <TextWidget
                text="TODAY'S SPENT"
                style={{
                  fontSize: 7.5,
                  fontWeight: "bold",
                  color: theme.textMuted,
                  letterSpacing: 0.5,
                }}
              />
            </FlexWidget>

            <TextWidget
              text={`-${currencySymbol}${todaySpent.toFixed(2)}`}
              style={{
                fontSize: 14,
                fontWeight: "bold",
                color: theme.textPrimary,
              }}
            />

            <TextWidget
              text={`Total: ${formatAmount(totalBalance, currencySymbol)}`}
              style={{
                fontSize: 9,
                fontWeight: "500",
                color: theme.textMuted,
                marginTop: 1,
              }}
            />
          </FlexWidget>

          {/* Right Column: 1-Tap "+" Action with Brutalist Shadow */}
          <FlexWidget
            style={{
              backgroundColor: theme.shadow,
              borderRadius: 14,
              paddingRight: 2,
              paddingBottom: 2.5,
            }}
            clickAction="OPEN_URI"
            clickActionData={{ uri: "pocket://quick-add?fromWidget=true" }}
          >
            <FlexWidget
              style={{
                width: 38,
                height: 38,
                borderRadius: 12,
                backgroundColor: theme.actionBtnBg,
                borderColor: theme.actionBtnBorder,
                borderWidth: 1.5,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <TextWidget
                text="+"
                style={{
                  fontSize: 20,
                  fontWeight: "bold",
                  color: theme.actionBtnText,
                  textAlign: "center",
                }}
              />
            </FlexWidget>
          </FlexWidget>
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
export function Banner4x1Widget(props: Partial<WidgetDataProps>) {
  const {
    currencySymbol = DEFAULT_CURRENCY.symbol,
    totalBalance = 0,
    todaySpent = 0,
  } = props;
  const isDark = resolveIsDark(props.isDark);
  const theme = getWidgetTheme(isDark);

  return (
    <FlexWidget
      style={{
        height: "match_parent",
        width: "match_parent",
        padding: 3,
      }}
    >
      <FlexWidget
        style={{
          height: "match_parent",
          width: "match_parent",
          backgroundColor: theme.shadow,
          borderRadius: 24,
          paddingRight: 3,
          paddingBottom: 4,
        }}
      >
        <FlexWidget
          style={{
            height: "match_parent",
            width: "match_parent",
            backgroundColor: theme.paper,
            borderRadius: 22,
            borderColor: theme.border,
            borderWidth: 2,
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
                backgroundColor: theme.coralLight,
                borderColor: theme.coralBorder,
                borderWidth: 1.5,
                alignItems: "center",
                justifyContent: "center",
                marginRight: 8,
              }}
            >
              <ImageWidget
                image={POCKET_LOGO_BASE64}
                imageWidth={22}
                imageHeight={22}
              />
            </FlexWidget>

            {/* Today's Spent Text */}
            <FlexWidget style={{ flexDirection: "column" }}>
              <TextWidget
                text="TODAY'S SPENT"
                style={{
                  fontSize: 7.5,
                  fontWeight: "bold",
                  color: theme.textMuted,
                  letterSpacing: 0.5,
                }}
              />
              <TextWidget
                text={`-${currencySymbol}${todaySpent.toFixed(2)}`}
                style={{
                  fontSize: 12,
                  fontWeight: "bold",
                  color: theme.textPrimary,
                  marginTop: 1,
                }}
              />
            </FlexWidget>

            {/* Divider */}
            <FlexWidget
              style={{
                width: 1.5,
                height: 20,
                backgroundColor: theme.divider,
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
                  backgroundColor: theme.sage,
                  marginRight: 4,
                }}
              />
              <TextWidget
                text={`Total: ${formatAmount(totalBalance, currencySymbol)}`}
                style={{
                  fontSize: 9,
                  fontWeight: "bold",
                  color: theme.textMuted,
                }}
              />
            </FlexWidget>
          </FlexWidget>

          {/* Right: Quick Log Button with Brutalist Shadow */}
          <FlexWidget
            style={{
              backgroundColor: theme.shadow,
              borderRadius: 13,
              paddingRight: 2,
              paddingBottom: 2.5,
            }}
            clickAction="OPEN_URI"
            clickActionData={{ uri: "pocket://quick-add?fromWidget=true" }}
          >
            <FlexWidget
              style={{
                height: 30,
                backgroundColor: theme.butter,
                borderColor: theme.butterBorder,
                borderWidth: 1.5,
                borderRadius: 11,
                paddingHorizontal: 11,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <TextWidget
                text="+ Quick Log"
                style={{
                  fontSize: 10.5,
                  fontWeight: "bold",
                  color: "#29221F",
                }}
              />
            </FlexWidget>
          </FlexWidget>
        </FlexWidget>
      </FlexWidget>
    </FlexWidget>
  );
}

/**
 * 4. 2x2 Pocket Journal Glance Widget
 * Compact square notebook companion matching the brutalist theme.
 */
export function Glance2x2Widget(props: Partial<WidgetDataProps>) {
  const {
    currencySymbol = DEFAULT_CURRENCY.symbol,
    totalBalance = 0,
    todaySpent = 0,
    recentTxns = [],
  } = props;
  const isDark = resolveIsDark(props.isDark);
  const theme = getWidgetTheme(isDark);
  const displayTxns = recentTxns.slice(0, 1);

  return (
    <FlexWidget
      style={{
        height: "match_parent",
        width: "match_parent",
        padding: 3,
      }}
    >
      <FlexWidget
        style={{
          height: "match_parent",
          width: "match_parent",
          backgroundColor: theme.shadow,
          borderRadius: 24,
          paddingRight: 3,
          paddingBottom: 4,
        }}
      >
        <FlexWidget
          style={{
            height: "match_parent",
            width: "match_parent",
            backgroundColor: theme.paper,
            borderRadius: 22,
            borderColor: theme.border,
            borderWidth: 2,
            padding: 10,
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          {/* Header: Brand & Balance */}
          <FlexWidget
            style={{
              width: "match_parent",
              flexDirection: "row",
              alignItems: "center",
              borderBottomWidth: 1.5,
              borderColor: theme.divider,
              paddingBottom: 4,
            }}
            clickAction="OPEN_APP"
          >
            <FlexWidget style={{ flex: 1, flexDirection: "row", alignItems: "center" }}>
              <ImageWidget
                image={POCKET_LOGO_BASE64}
                imageWidth={16}
                imageHeight={16}
                style={{ marginRight: 5 }}
              />
              <TextWidget
                text="pocket journal "
                style={{
                  fontSize: 9.5,
                  fontWeight: "bold",
                  color: theme.textPrimary,
                }}
              />
              <TextWidget
                text="✿"
                style={{
                  fontSize: 8,
                  color: theme.coral,
                }}
              />
            </FlexWidget>
            <TextWidget
              text={formatAmount(totalBalance, currencySymbol)}
              style={{
                fontSize: 11,
                fontWeight: "bold",
                color: theme.textPrimary,
              }}
            />
          </FlexWidget>

          {/* Today's Spent Mini Card with Brutalist Shadow */}
          <FlexWidget
            style={{
              width: "match_parent",
              backgroundColor: theme.shadow,
              borderRadius: 12,
              paddingRight: 1.5,
              paddingBottom: 2,
              marginVertical: 3,
            }}
            clickAction="OPEN_APP"
          >
            <FlexWidget
              style={{
                width: "match_parent",
                backgroundColor: theme.coralLight,
                borderColor: theme.coralBorder,
                borderWidth: 1.5,
                borderRadius: 11,
                paddingHorizontal: 8,
                paddingVertical: 5,
              }}
            >
              <TextWidget
                text="TODAY'S SPENT"
                style={{
                  fontSize: 7,
                  fontWeight: "bold",
                  color: theme.coral,
                }}
              />
              <TextWidget
                text={`${currencySymbol}${todaySpent.toFixed(2)}`}
                style={{
                  fontSize: 12,
                  fontWeight: "bold",
                  color: theme.coral,
                  marginTop: 1,
                }}
              />
            </FlexWidget>
          </FlexWidget>

          {/* Recent Activity Card */}
          <FlexWidget
            style={{
              width: "match_parent",
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
                    width: "match_parent",
                    backgroundColor: theme.bg,
                    borderColor: theme.borderSubtle,
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
                      backgroundColor: theme.butter,
                      borderColor: theme.butterBorder,
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
                        color: theme.textPrimary,
                      }}
                      maxLines={1}
                      truncate="END"
                    />
                    <TextWidget
                      text={getCategoryLabel(t.category)}
                      style={{
                        fontSize: 7,
                        fontWeight: "bold",
                        color: theme.textMuted,
                      }}
                      maxLines={1}
                    />
                  </FlexWidget>

                  <TextWidget
                    text={`${t.type === "income" ? "+" : "-"}${currencySymbol}${t.amount.toFixed(0)}`}
                    style={{
                      fontSize: 10,
                      fontWeight: "bold",
                      color: t.type === "income" ? theme.sage : theme.coral,
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
                  color: theme.textMuted,
                  fontStyle: "italic",
                  textAlign: "center",
                }}
              />
            )}
          </FlexWidget>

          {/* Bottom Action: Log Expense button with Brutalist Shadow */}
          <FlexWidget
            style={{
              width: "match_parent",
              backgroundColor: theme.shadow,
              borderRadius: 12,
              paddingRight: 1.5,
              paddingBottom: 2,
              marginTop: 2,
            }}
            clickAction="OPEN_URI"
            clickActionData={{ uri: "pocket://quick-add?fromWidget=true" }}
          >
            <FlexWidget
              style={{
                width: "match_parent",
                height: 28,
                backgroundColor: theme.actionBtnBg,
                borderColor: theme.actionBtnBorder,
                borderWidth: 1.5,
                borderRadius: 10,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <TextWidget
                text="+ Quick Log"
                style={{
                  fontSize: 10,
                  fontWeight: "bold",
                  color: theme.actionBtnText,
                }}
              />
            </FlexWidget>
          </FlexWidget>
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
export function Dashboard4x2Widget(props: Partial<WidgetDataProps>) {
  const {
    currencySymbol = DEFAULT_CURRENCY.symbol,
    totalBalance = 0,
    todaySpent = 0,
    recentTxns = [],
  } = props;
  const isDark = resolveIsDark(props.isDark);
  const theme = getWidgetTheme(isDark);
  const displayTxns = recentTxns.slice(0, 1);

  return (
    <FlexWidget
      style={{
        height: "match_parent",
        width: "match_parent",
        padding: 3,
      }}
    >
      <FlexWidget
        style={{
          height: "match_parent",
          width: "match_parent",
          backgroundColor: theme.shadow,
          borderRadius: 26,
          paddingRight: 3,
          paddingBottom: 4.5,
        }}
      >
        <FlexWidget
          style={{
            height: "match_parent",
            width: "match_parent",
            backgroundColor: theme.paper,
            borderRadius: 24,
            borderColor: theme.border,
            borderWidth: 2,
            padding: 11,
            flexDirection: "row",
          }}
        >
          {/* Left Column (Balances & Stats) */}
          <FlexWidget
            style={{
              height: "match_parent",
              width: 115,
              flexDirection: "column",
              borderRightWidth: 1.5,
              borderColor: theme.divider,
              paddingRight: 9,
              justifyContent: "space-between",
            }}
            clickAction="OPEN_APP"
          >
            <FlexWidget style={{ width: "match_parent", flexDirection: "column" }}>
              <FlexWidget style={{ width: "match_parent", flexDirection: "row", alignItems: "center" }}>
                <ImageWidget
                  image={POCKET_LOGO_BASE64}
                  imageWidth={16}
                  imageHeight={16}
                  style={{ marginRight: 5 }}
                />
                <TextWidget
                  text="pocket journal "
                  style={{
                    fontSize: 10,
                    fontWeight: "bold",
                    color: theme.textPrimary,
                  }}
                />
                <TextWidget
                  text="✿"
                  style={{
                    fontSize: 8.5,
                    color: theme.coral,
                  }}
                />
              </FlexWidget>

              <TextWidget
                text="TOTAL BALANCE"
                style={{
                  fontSize: 7.5,
                  fontWeight: "bold",
                  color: theme.textMuted,
                  letterSpacing: 0.5,
                  marginTop: 3,
                }}
              />

              <TextWidget
                text={formatAmount(totalBalance, currencySymbol)}
                style={{
                  fontSize: 14,
                  fontWeight: "bold",
                  color: theme.textPrimary,
                  marginTop: 1,
                }}
              />
            </FlexWidget>

            {/* Today Spent Mini Card with Brutalist Shadow */}
            <FlexWidget
              style={{
                width: "match_parent",
                backgroundColor: theme.shadow,
                borderRadius: 12,
                paddingRight: 1.5,
                paddingBottom: 2,
              }}
            >
              <FlexWidget
                style={{
                  width: "match_parent",
                  backgroundColor: theme.coralLight,
                  borderColor: theme.coralBorder,
                  borderWidth: 1.5,
                  borderRadius: 11,
                  padding: 6,
                }}
              >
                <TextWidget
                  text="TODAY'S SPENT"
                  style={{
                    fontSize: 7,
                    fontWeight: "bold",
                    color: theme.coral,
                  }}
                />
                <TextWidget
                  text={`${currencySymbol}${todaySpent.toFixed(2)}`}
                  style={{
                    fontSize: 12,
                    fontWeight: "bold",
                    color: theme.coral,
                    marginTop: 1,
                  }}
                />
              </FlexWidget>
            </FlexWidget>
          </FlexWidget>

          {/* Right Column (Recent Activity & Instant Action) with flex: 1 */}
          <FlexWidget
            style={{
              height: "match_parent",
              flex: 1,
              flexDirection: "column",
              paddingLeft: 9,
              justifyContent: "space-between",
            }}
          >
            {/* Header row */}
            <FlexWidget
              style={{
                width: "match_parent",
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
                    color: theme.textMuted,
                    letterSpacing: 0.5,
                  }}
                />
              </FlexWidget>
              <TextWidget
                text="✿"
                style={{
                  fontSize: 8,
                  color: theme.textSubtle,
                }}
              />
            </FlexWidget>

            {/* Recent Activity Card */}
            <FlexWidget
              style={{
                width: "match_parent",
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
                      width: "match_parent",
                      backgroundColor: theme.bg,
                      borderColor: theme.borderSubtle,
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
                        backgroundColor: theme.butter,
                        borderColor: theme.butterBorder,
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
                          color: theme.textPrimary,
                        }}
                        maxLines={1}
                        truncate="END"
                      />
                      <TextWidget
                        text={getCategoryLabel(t.category)}
                        style={{
                          fontSize: 7,
                          fontWeight: "bold",
                          color: theme.textMuted,
                        }}
                      />
                    </FlexWidget>

                    <TextWidget
                      text={`${t.type === "income" ? "+" : "-"}${currencySymbol}${t.amount.toFixed(0)}`}
                      style={{
                        fontSize: 10.5,
                        fontWeight: "bold",
                        color: t.type === "income" ? theme.sage : theme.coral,
                        marginLeft: 4,
                      }}
                    />
                  </FlexWidget>
                ))
              ) : (
                <FlexWidget
                  style={{
                    width: "match_parent",
                    backgroundColor: theme.bg,
                    borderColor: theme.borderSubtle,
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
                      color: theme.textMuted,
                      fontStyle: "italic",
                    }}
                  />
                </FlexWidget>
              )}
            </FlexWidget>

            {/* Bottom Row Action Button with Brutalist Shadow */}
            <FlexWidget
              style={{
                width: "match_parent",
                backgroundColor: theme.shadow,
                borderRadius: 13,
                paddingRight: 2,
                paddingBottom: 2.5,
              }}
              clickAction="OPEN_URI"
              clickActionData={{ uri: "pocket://quick-add?fromWidget=true" }}
            >
              <FlexWidget
                style={{
                  width: "match_parent",
                  height: 30,
                  backgroundColor: theme.actionBtnBg,
                  borderColor: theme.actionBtnBorder,
                  borderWidth: 1.5,
                  borderRadius: 11,
                  alignItems: "center",
                  justifyContent: "center",
                  flexDirection: "row",
                }}
              >
                <TextWidget
                  text="+ Log Expense"
                  style={{
                    fontSize: 10.5,
                    fontWeight: "bold",
                    color: theme.actionBtnText,
                  }}
                />
              </FlexWidget>
            </FlexWidget>
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
 * - Notebook Entries list with category emoji cards + interactive category shortcuts
 * - Bottom Action Row: Quick note or expense... + Instant tag
 */
export function FullJournal4x4Widget(props: Partial<WidgetDataProps>) {
  const {
    currencySymbol = DEFAULT_CURRENCY.symbol,
    totalBalance = 0,
    todaySpent = 0,
    todayIncome = 0,
    recentTxns = [],
  } = props;
  const isDark = resolveIsDark(props.isDark);
  const theme = getWidgetTheme(isDark);
  const displayTxns = recentTxns.slice(0, 4);

  // Shortcuts to fill remaining slots so the notebook is always full, balanced, and interactive
  const shortcutSlots = [
    { emoji: "☕", label: "Coffee & Food", note: "Coffee" },
    { emoji: "🛒", label: "Groceries & Mart", note: "Groceries" },
    { emoji: "💡", label: "Bills & Utilities", note: "Bills" },
    { emoji: "🚌", label: "Transit & Gas", note: "Transport" },
  ];
  const remainingCount = Math.max(0, 4 - displayTxns.length);
  const placeholders = shortcutSlots.slice(0, remainingCount);

  return (
    <FlexWidget
      style={{
        height: "match_parent",
        width: "match_parent",
        padding: 3,
      }}
    >
      {/* Brutalist Shadow Container */}
      <FlexWidget
        style={{
          height: "match_parent",
          width: "match_parent",
          backgroundColor: theme.shadow,
          borderRadius: 28,
          paddingRight: 3.5,
          paddingBottom: 5,
        }}
      >
        {/* Main Card */}
        <FlexWidget
          style={{
            height: "match_parent",
            width: "match_parent",
            backgroundColor: theme.paper,
            borderRadius: 26,
            borderColor: theme.border,
            borderWidth: 2,
            padding: 12,
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          {/* 1. Header: Name, date & sparkle */}
          <FlexWidget
            style={{
              width: "match_parent",
              flexDirection: "row",
              alignItems: "center",
              borderBottomWidth: 1.5,
              borderColor: theme.divider,
              paddingBottom: 7,
            }}
            clickAction="OPEN_APP"
          >
            <FlexWidget style={{ flex: 1, flexDirection: "column" }}>
              <FlexWidget style={{ flexDirection: "row", alignItems: "center" }}>
                <ImageWidget
                  image={POCKET_LOGO_BASE64}
                  imageWidth={20}
                  imageHeight={20}
                  style={{ marginRight: 6 }}
                />
                <TextWidget
                  text="Pocket Penny Journal "
                  style={{
                    fontSize: 12.5,
                    fontWeight: "bold",
                    color: theme.textPrimary,
                  }}
                />
                <TextWidget
                  text="✿"
                  style={{
                    fontSize: 9.5,
                    color: theme.coral,
                  }}
                />
              </FlexWidget>
              <TextWidget
                text="DAILY EXPENSE TRACKER"
                style={{
                  fontSize: 7.5,
                  fontWeight: "bold",
                  color: theme.textMuted,
                  letterSpacing: 0.5,
                  marginTop: 1,
                }}
              />
            </FlexWidget>

            {/* Sparkle Tag */}
            <FlexWidget
              style={{
                backgroundColor: theme.butterLight,
                borderColor: theme.butterBorder,
                borderWidth: 1.5,
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
                  color: theme.tagButterText,
                }}
              />
            </FlexWidget>
          </FlexWidget>

          {/* 2. Metric split cards (Income & Spent) with Progress Bars */}
          <FlexWidget
            style={{
              width: "match_parent",
              flexDirection: "row",
              alignItems: "center",
              marginVertical: 4,
            }}
            clickAction="OPEN_APP"
          >
            {/* Income Card with shadow */}
            <FlexWidget
              style={{
                flex: 1,
                backgroundColor: theme.shadow,
                borderRadius: 13,
                paddingRight: 1.5,
                paddingBottom: 2,
                marginRight: 6,
              }}
            >
              <FlexWidget
                style={{
                  width: "match_parent",
                  backgroundColor: theme.sageLight,
                  borderColor: theme.sageBorder,
                  borderWidth: 1.5,
                  borderRadius: 12,
                  padding: 7,
                }}
              >
                <FlexWidget style={{ width: "match_parent", flexDirection: "row", alignItems: "center" }}>
                  <FlexWidget style={{ flex: 1 }}>
                    <TextWidget
                      text="↙ INCOME"
                      style={{
                        fontSize: 7.5,
                        fontWeight: "bold",
                        color: theme.incomeText,
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
                    color: theme.incomeText,
                    marginTop: 2,
                  }}
                />
                {/* Progress track */}
                <FlexWidget
                  style={{
                    width: "match_parent",
                    height: 3.5,
                    backgroundColor: theme.trackIncomeBg,
                    borderRadius: 2,
                    marginTop: 4,
                  }}
                >
                  <FlexWidget
                    style={{
                      height: 3.5,
                      width: todayIncome > 0 ? 40 : 12,
                      backgroundColor: theme.sage,
                      borderRadius: 2,
                    }}
                  />
                </FlexWidget>
              </FlexWidget>
            </FlexWidget>

            {/* Spent Card with shadow */}
            <FlexWidget
              style={{
                flex: 1,
                backgroundColor: theme.shadow,
                borderRadius: 13,
                paddingRight: 1.5,
                paddingBottom: 2,
              }}
            >
              <FlexWidget
                style={{
                  width: "match_parent",
                  backgroundColor: theme.coralLight,
                  borderColor: theme.coralBorder,
                  borderWidth: 1.5,
                  borderRadius: 12,
                  padding: 7,
                }}
              >
                <FlexWidget style={{ width: "match_parent", flexDirection: "row", alignItems: "center" }}>
                  <FlexWidget style={{ flex: 1 }}>
                    <TextWidget
                      text="↗ SPENT"
                      style={{
                        fontSize: 7.5,
                        fontWeight: "bold",
                        color: theme.coral,
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
                    color: theme.coral,
                    marginTop: 2,
                  }}
                />
                {/* Progress track */}
                <FlexWidget
                  style={{
                    width: "match_parent",
                    height: 3.5,
                    backgroundColor: theme.trackSpentBg,
                    borderRadius: 2,
                    marginTop: 4,
                  }}
                >
                  <FlexWidget
                    style={{
                      height: 3.5,
                      width: todaySpent > 0 ? 55 : 12,
                      backgroundColor: theme.coral,
                      borderRadius: 2,
                    }}
                  />
                </FlexWidget>
              </FlexWidget>
            </FlexWidget>
          </FlexWidget>

          {/* 3. Notebook Recent Entries List - spans 100% width and evenly fills height */}
          <FlexWidget
            style={{
              width: "match_parent",
              flex: 1,
              flexDirection: "column",
              justifyContent: "space-between",
              paddingVertical: 2,
            }}
          >
            <FlexWidget
              style={{
                width: "match_parent",
                flexDirection: "row",
                alignItems: "center",
                marginBottom: 2,
              }}
              clickAction="OPEN_APP"
            >
              <FlexWidget style={{ flex: 1 }}>
                <TextWidget
                  text="NOTEBOOK ENTRIES"
                  style={{
                    fontSize: 7.5,
                    fontWeight: "bold",
                    color: theme.textMuted,
                    letterSpacing: 0.5,
                  }}
                />
              </FlexWidget>
              <TextWidget
                text="↓ Newest"
                style={{
                  fontSize: 7.5,
                  fontWeight: "bold",
                  color: theme.textMuted,
                }}
              />
            </FlexWidget>

            {/* Actual logged transactions */}
            {displayTxns.map((t) => (
              <FlexWidget
                key={t.id}
                style={{
                  width: "match_parent",
                  backgroundColor: theme.bg,
                  borderColor: theme.borderSubtle,
                  borderWidth: 1.5,
                  borderRadius: 11,
                  padding: 5.5,
                  flexDirection: "row",
                  alignItems: "center",
                }}
                clickAction="OPEN_APP"
              >
                {/* Category Icon */}
                <FlexWidget
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 7,
                    backgroundColor: theme.butter,
                    borderColor: theme.butterBorder,
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
                      color: theme.textPrimary,
                    }}
                    maxLines={1}
                    truncate="END"
                  />
                  <TextWidget
                    text={getCategoryLabel(t.category)}
                    style={{
                      fontSize: 7,
                      fontWeight: "bold",
                      color: theme.textMuted,
                    }}
                  />
                </FlexWidget>

                {/* Amount */}
                <TextWidget
                  text={`${t.type === "income" ? "+" : "-"}${currencySymbol}${t.amount.toFixed(2)}`}
                  style={{
                    fontSize: 10,
                    fontWeight: "bold",
                    color: t.type === "income" ? theme.sage : theme.coral,
                    marginLeft: 4,
                  }}
                />
              </FlexWidget>
            ))}

            {/* Interactive category shortcuts so the entire notebook is balanced and useful */}
            {placeholders.map((p, idx) => (
              <FlexWidget
                key={`slot-${idx}`}
                style={{
                  width: "match_parent",
                  backgroundColor: theme.placeholderBg,
                  borderColor: theme.placeholderBorder,
                  borderWidth: 1,
                  borderRadius: 11,
                  padding: 5,
                  flexDirection: "row",
                  alignItems: "center",
                }}
                clickAction="OPEN_URI"
                clickActionData={{ uri: `pocket://quick-add?fromWidget=true&note=${encodeURIComponent(p.note)}` }}
              >
                <FlexWidget
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 7,
                    backgroundColor: theme.butterLight,
                    borderColor: theme.butterBorder,
                    borderWidth: 1,
                    alignItems: "center",
                    justifyContent: "center",
                    marginRight: 6,
                  }}
                >
                  <TextWidget text={p.emoji} style={{ fontSize: 10 }} />
                </FlexWidget>

                <FlexWidget style={{ flex: 1 }}>
                  <TextWidget
                    text={p.label}
                    style={{
                      fontSize: 8.5,
                      fontWeight: "bold",
                      color: theme.textMuted,
                    }}
                  />
                </FlexWidget>

                <TextWidget
                  text="+ Quick Log"
                  style={{
                    fontSize: 8,
                    fontWeight: "bold",
                    color: theme.textPrimary,
                  }}
                />
              </FlexWidget>
            ))}
          </FlexWidget>

          {/* 4. Bottom Action Row: Multi Quick Add Bar with Brutalist Shadow */}
          <FlexWidget
            style={{
              width: "match_parent",
              backgroundColor: theme.shadow,
              borderRadius: 13,
              paddingRight: 2,
              paddingBottom: 2.5,
              marginTop: 4,
            }}
            clickAction="OPEN_URI"
            clickActionData={{ uri: "pocket://quick-add?fromWidget=true" }}
          >
            <FlexWidget
              style={{
                width: "match_parent",
                backgroundColor: theme.bg,
                borderColor: theme.border,
                borderWidth: 1.5,
                borderRadius: 11,
                paddingHorizontal: 9,
                paddingVertical: 6,
                flexDirection: "row",
                alignItems: "center",
              }}
            >
              <FlexWidget
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 5,
                  backgroundColor: theme.coral,
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
                    color: theme.textMuted,
                  }}
                />
              </FlexWidget>

              <FlexWidget
                style={{
                  backgroundColor: theme.instantPillBg,
                  borderColor: theme.borderSubtle,
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
                    color: theme.instantPillText,
                  }}
                />
              </FlexWidget>
            </FlexWidget>
          </FlexWidget>
        </FlexWidget>
      </FlexWidget>
    </FlexWidget>
  );
}
