import React from "react";
import {
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";
import Svg, {
  Circle,
  G,
  Line,
  Path,
  Rect,
  Text as SvgText,
} from "react-native-svg";

export interface PocketBrandIconProps {
  /** Total bounding box size in px (width & height). Default: 88 (test-icon.html base) */
  size?: number;
  /** Currency symbol to display on the penny coin. Default: '₱' */
  currencySymbol?: string;
  /** Whether the icon is tilted by -8 degrees as defined in test-icon.html. Default: true */
  tilted?: boolean;
  /** Custom additional container style */
  style?: StyleProp<ViewStyle>;
}

/**
 * PocketBrandIcon - 100% Exact Cross-Platform Vector Replica of test-icon.html.
 * Renders identical pixel geometry across Web, iOS, and Android.
 */
export function PocketBrandIcon({
  size = 88,
  currencySymbol = "₱",
  tilted = true,
  style,
}: PocketBrandIconProps) {
  const displaySymbol =
    currencySymbol?.length > 2 ? currencySymbol[0] : (currencySymbol || "₱");

  return (
    <View
      style={[
        {
          width: size,
          height: size,
          alignItems: "center",
          justifyContent: "center",
        },
        style,
      ]}
      accessibilityRole="image"
      accessibilityLabel="Pocket brand icon"
    >
      <Svg
        width={size}
        height={size}
        viewBox="0 0 88 88"
      >
        <G transform={tilted ? "rotate(-8 44 44)" : undefined}>
          {/* 1. Peeking Golden Penny Coin */}
          <Circle
            cx="66"
            cy="20"
            r="15"
            fill="#FFD166"
            stroke="#3B3330"
            strokeWidth="2"
          />
          <Circle
            cx="66"
            cy="20"
            r="13"
            fill="none"
            stroke="rgba(122, 79, 1, 0.35)"
            strokeWidth="1"
          />
          <SvgText
            x="66"
            y="24"
            textAnchor="middle"
            fontFamily="sans-serif"
            fontWeight="800"
            fontSize="12"
            fill="#7A4F01"
          >
            {displaySymbol}
          </SvgText>

          {/* 2. Solid Neo-Brutalist Shadow Underlay */}
          <Rect
            x="8"
            y="14"
            width="72"
            height="72"
            rx="22"
            ry="22"
            fill="#3B3330"
          />

          {/* 3. Pocket Squircle Body */}
          <Rect
            x="4"
            y="10"
            width="72"
            height="72"
            rx="22"
            ry="22"
            fill="#FF9E7E"
            stroke="#3B3330"
            strokeWidth="2"
          />

          {/* 4. Top Dashed Stitch Line */}
          <Line
            x1="14"
            y1="22"
            x2="66"
            y2="22"
            stroke="rgba(255, 255, 255, 0.85)"
            strokeWidth="2"
            strokeDasharray="4, 3"
          />

          {/* Dual Brass Corner Rivets */}
          <Circle
            cx="15.5"
            cy="21.5"
            r="2.75"
            fill="#FFD166"
            stroke="#3B3330"
            strokeWidth="1.5"
          />
          <Circle
            cx="64.5"
            cy="21.5"
            r="2.75"
            fill="#FFD166"
            stroke="#3B3330"
            strokeWidth="1.5"
          />

          {/* 5. Bottom Curved U-Stitch Pouch (Authentic broken dashed line under 'p') */}
          <Path
            d="M 14 57 L 14 61 A 14 14 0 0 0 28 75 L 52 75 A 14 14 0 0 0 66 61 L 66 57"
            fill="none"
            stroke="rgba(255, 255, 255, 0.65)"
            strokeWidth="2"
            strokeDasharray="4, 3"
          />

          {/* 6. Exact Arial Black 'p' Vector Glyph matching test-icon.html */}
          <Path
            fillRule="evenodd"
            fill="#FFFDF7"
            d="
              M 24.6 29.2 
              L 26.8 26.6 
              L 34.4 26.6 
              L 34.4 30.2 
              C 36.6 27.6 39.6 26.2 43.0 26.2 
              C 49.2 26.2 53.6 30.8 53.6 37.3 
              C 53.6 43.8 49.2 48.4 43.0 48.4 
              C 39.6 48.4 36.6 47.0 34.4 44.4 
              L 34.4 57.0 
              L 26.8 57.0 
              L 26.8 29.2 
              Z 
              M 34.4 34.4 
              L 34.4 40.2 
              C 36.2 42.0 38.6 43.0 41.2 43.0 
              C 44.4 43.0 46.4 40.8 46.4 37.3 
              C 46.4 33.8 44.4 31.6 41.2 31.6 
              C 38.6 31.6 36.2 32.6 34.4 34.4 
              Z
            "
          />
        </G>
      </Svg>
    </View>
  );
}
