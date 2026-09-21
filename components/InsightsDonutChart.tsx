import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, G } from "react-native-svg";
import { COLORS, FONTS } from "../constants/theme";

export interface CategoryBreakdownItem {
  key: string;
  label: string;
  emoji: string;
  bg?: string;
  amount: number;
  count?: number;
  percentage: number;
  color?: string;
}

export interface InsightsDonutChartProps {
  items?: CategoryBreakdownItem[];
  data?: CategoryBreakdownItem[];
  totalAmount?: number;
  totalSpent?: number;
  currencySymbol: string;
  selectedKey?: string | null;
  selectedCategoryKey?: string | null;
  onSelectKey?: (key: string | null) => void;
  onSelectCategory?: (key: string | null) => void;
  size?: number;
  donutThickness?: number;
}

const PALETTE = [
  "#FF9E7E", // peach
  "#92D8B9", // mint
  "#F7C56B", // butter
  "#B7A6E4", // lavender
  "#8AC6FD", // sky
  "#FF9EB7", // rose
  "#FFA578", // coral
  "#A6D997", // sage
  "#9DA7F5", // periwinkle
  "#F5B971", // warm amber
];

export function getCategorySliceColor(index: number, bg?: string): string {
  if (bg === "peach") return "#FF9E7E";
  if (bg === "mint") return "#78D3AB";
  if (bg === "butter") return "#F7C56B";
  if (bg === "lavender") return "#B7A6E4";
  return PALETTE[index % PALETTE.length];
}

export function InsightsDonutChart({
  items,
  data,
  totalAmount,
  totalSpent,
  currencySymbol = "$",
  selectedKey,
  selectedCategoryKey,
  onSelectKey,
  onSelectCategory,
  size = 210,
  donutThickness = 24,
}: InsightsDonutChartProps) {
  const activeItems = items || data || [];
  const total = (totalAmount !== undefined ? totalAmount : totalSpent) ?? 0;
  const activeSelectedKey = selectedKey !== undefined ? selectedKey : (selectedCategoryKey ?? null);
  const handleSelect = onSelectKey || onSelectCategory || (() => {});

  const strokeWidth = donutThickness;
  const cx = size / 2;
  const cy = size / 2;
  const radius = (size - strokeWidth - 8) / 2;
  const circumference = 2 * Math.PI * radius;

  const validItems = activeItems.filter((it) => it && it.amount > 0);
  const effectiveTotal = total > 0 ? total : validItems.reduce((s, it) => s + it.amount, 0);

  const selectedItem = validItems.find((it) => it.key === activeSelectedKey);

  // Compute slice geometries
  let cumulativePercent = 0;
  const slices = validItems.map((item, idx) => {
    const fraction = effectiveTotal > 0 ? item.amount / effectiveTotal : 0;
    const gap = validItems.length > 1 ? 2.5 : 0;
    const strokeDash = Math.max(0, fraction * circumference - gap);
    const strokeOffset = -cumulativePercent * circumference;
    cumulativePercent += fraction;

    const sliceColor = getCategorySliceColor(idx, item.bg);
    const isSelected = activeSelectedKey === item.key;

    return {
      ...item,
      sliceColor,
      strokeDash,
      strokeOffset,
      isSelected,
    };
  });

  return (
    <View style={styles.container}>
      <View style={{ width: size, height: size, position: "relative" }}>
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {/* Subtle background track */}
          <Circle
            cx={cx}
            cy={cy}
            r={radius}
            stroke="rgba(59, 51, 48, 0.08)"
            strokeWidth={strokeWidth}
            fill="transparent"
          />

          {/* Slices group rotated to start at top (12 o'clock) */}
          <G rotation="-90" origin={`${cx}, ${cy}`}>
            {slices.map((slice) => (
              <Circle
                key={slice.key}
                cx={cx}
                cy={cy}
                r={radius}
                stroke={slice.sliceColor}
                strokeWidth={slice.isSelected ? strokeWidth + 4 : strokeWidth}
                strokeDasharray={`${slice.strokeDash} ${circumference}`}
                strokeDashoffset={slice.strokeOffset}
                fill="transparent"
                strokeLinecap="butt"
                onPress={() => handleSelect(slice.isSelected ? null : slice.key)}
              />
            ))}
          </G>
        </Svg>

        {/* Center Interactive Focus Hole */}
        <View style={styles.centerHoleWrapper} pointerEvents="box-none">
          <Pressable
            onPress={() => handleSelect(null)}
            style={[styles.centerHole, { width: (radius - strokeWidth / 2) * 1.7, height: (radius - strokeWidth / 2) * 1.7 }]}
            hitSlop={8}
          >
            {selectedItem ? (
              <View style={styles.centerContent}>
                <Text style={styles.centerEmoji}>{selectedItem.emoji}</Text>
                <Text style={styles.centerLabel} numberOfLines={1}>
                  {selectedItem.label}
                </Text>
                <Text style={styles.centerAmount}>
                  −{currencySymbol}
                  {selectedItem.amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Text>
                <View style={styles.centerPill}>
                  <Text style={styles.centerPillText}>{selectedItem.percentage}% of spent</Text>
                </View>
              </View>
            ) : (
              <View style={styles.centerContent}>
                <Text style={styles.centerEyebrow}>TOTAL SPENT</Text>
                <Text style={styles.centerAmountBig} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                  −{currencySymbol}
                  {effectiveTotal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Text>
                <Text style={styles.centerSubtext}>
                  {validItems.length} {validItems.length === 1 ? "category" : "categories"}
                </Text>
              </View>
            )}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 12,
  },
  centerHoleWrapper: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  centerHole: {
    borderRadius: 9999,
    backgroundColor: COLORS.cream,
    borderWidth: 1.5,
    borderColor: "rgba(59, 51, 48, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    padding: 8,
  },
  centerContent: {
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
  centerEyebrow: {
    fontFamily: FONTS.bodyBold,
    fontSize: 9.5,
    letterSpacing: 1,
    color: COLORS.inkSoft,
    textTransform: "uppercase",
  },
  centerEmoji: {
    fontSize: 20,
    marginBottom: 2,
  },
  centerLabel: {
    fontFamily: FONTS.displayBold,
    fontSize: 11.5,
    color: COLORS.ink,
    textAlign: "center",
  },
  centerAmount: {
    fontFamily: FONTS.displayBold,
    fontSize: 14,
    color: "#D35433",
    marginTop: 2,
  },
  centerAmountBig: {
    fontFamily: FONTS.displayBold,
    fontSize: 18,
    color: "#D35433",
    marginTop: 3,
  },
  centerSubtext: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 10,
    color: COLORS.inkSoft,
    marginTop: 2,
  },
  centerPill: {
    backgroundColor: "rgba(59, 51, 48, 0.08)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 9999,
    marginTop: 4,
  },
  centerPillText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 9,
    color: COLORS.ink,
  },
});
