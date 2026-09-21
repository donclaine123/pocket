import React from "react";
import {
  StyleProp,
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
 * PocketBrandIcon – Faithful cross-platform vector replica of test-icon.html.
 *
 * All coordinates below are mapped 1-to-1 from the CSS in test-icon.html
 * (88 × 88 viewBox matches the HTML's 88 × 88 .icon-box-tilted).
 *
 * Mapping reference (CSS → SVG):
 *   Coin:   top:4  right:6  32×32  → cx = 88-6-16 = 66, cy = 4+16 = 20, r = 14
 *   Shadow: top:14 left:8   72×72  → x=8  y=14
 *   Body:   top:10 left:4   72×72  → x=4  y=10  (border included via stroke)
 *   Stitch: top:12 left:10  right:10 → y = 10+12 = 22, x1 = 4+10 = 14, x2 = 4+72-10 = 66
 *   Rivets: top:8  left:8 / right:8 → cy = 10+8+3.5 = 21.5, cx = 4+8+3.5 / 4+72-8-3.5
 *   Bottom: bottom:7 left:10 right:10 height:18 → mapped to U-shaped path
 *   Letter: font-size 40, font-weight 900, color #FFFDF7, centered in body
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
          {/* ── 1. Peeking Golden Penny Coin ─────────────────────────
               HTML: top:4 right:6 width:32 height:32 → center (66, 20) r=14
               Outer border: 2px solid #3B3330
               Inner ring: 1px solid rgba(122,79,1,0.35) inset 2px each side → r=12 */}
          <Circle
            cx="66"
            cy="20"
            r="14"
            fill="#FFD166"
            stroke="#3B3330"
            strokeWidth="2"
          />
          <Circle
            cx="66"
            cy="20"
            r="11"
            fill="none"
            stroke="rgba(122, 79, 1, 0.35)"
            strokeWidth="1"
          />
          <SvgText
            x="66"
            y="24"
            textAnchor="middle"
            fontFamily="System, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif"
            fontWeight="800"
            fontSize="12"
            fill="#7A4F01"
          >
            {displaySymbol}
          </SvgText>

          {/* ── 2. Solid Shadow Underlay ──────────────────────────────
               HTML: top:14 left:8 72×72 border-radius:22 background:#3B3330 */}
          <Rect
            x="8"
            y="14"
            width="72"
            height="72"
            rx="22"
            ry="22"
            fill="#3B3330"
          />

          {/* ── 3. Pocket Squircle Body ───────────────────────────────
               HTML: top:10 left:4 72×72 border-radius:22
               border:2px solid #3B3330  background:#FF9E7E */}
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

          {/* ── 4. Top Dashed Stitch Line ─────────────────────────────
               HTML: top:12 left:10 right:10 → y=10+12=22, x1=4+10=14, x2=4+72-10=66
               border-top:2px dashed rgba(255,255,255,0.85) */}
          <Line
            x1="14"
            y1="22"
            x2="66"
            y2="22"
            stroke="rgba(255, 255, 255, 0.85)"
            strokeWidth="2"
            strokeDasharray="4, 3"
          />

          {/* ── 5. Brass Corner Rivets ────────────────────────────────
               HTML: top:8 width:7 height:7 → r=3.5
               Left rivet:  left:8  → cx = 4+8+3.5 = 15.5,  cy = 10+8+3.5 = 21.5
               Right rivet: right:8 → cx = 4+72-8-3.5 = 64.5, cy = 21.5
               border:1.5px solid #3B3330  background:#FFD166 */}
          <Circle
            cx="15.5"
            cy="21.5"
            r="3.5"
            fill="#FFD166"
            stroke="#3B3330"
            strokeWidth="1.5"
          />
          <Circle
            cx="64.5"
            cy="21.5"
            r="3.5"
            fill="#FFD166"
            stroke="#3B3330"
            strokeWidth="1.5"
          />

          {/* ── 6. Bottom Curved U-Stitch ─────────────────────────────
               HTML: bottom:7 left:10 right:10 height:18
               border-bottom-left/right-radius:14
               Mapped: top of U = body.top + body.height - 7 - 18 = 10+72-7-18 = 57
                       bottom   = 10+72-7 = 75
                       left     = 4+10 = 14,  right = 4+72-10 = 66
               border: 2px dashed rgba(255,255,255,0.65) on left/right/bottom */}
          <Path
            d="M 14 57 L 14 61 A 14 14 0 0 0 28 75 L 52 75 A 14 14 0 0 0 66 61 L 66 57"
            fill="none"
            stroke="rgba(255, 255, 255, 0.65)"
            strokeWidth="2"
            strokeDasharray="4, 3"
          />

          {/* ── 7. Bold "p" Letter ────────────────────────────────────
               HTML: font-size:40 font-weight:900 color:#FFFDF7 line-height:64
               Centered in the 72×72 pocket body (center at x=40, y=46)
               Using SvgText to match the system font rendering in test-icon.html */}
          <Path
            fillRule="evenodd"
            fill="#FFFDF7"
            stroke="#FFFDF7"
            strokeWidth="1"
            transform="translate(40, 8) scale(1.15, 1) translate(-40, 0)"
            d="M51.28 41.04Q51.28 44.32 50.17 46.84Q49.05 49.36 47.02 50.75Q44.99 52.13 42.45 52.13Q38.94 52.13 37.12 49.57L37.04 49.57L37.04 60.84L28.72 60.84L28.72 31.64L37.04 31.64L37.04 34.36L37.12 34.36Q38.12 32.86 39.70 32.01Q41.28 31.16 43.29 31.16Q47.16 31.16 49.22 33.73Q51.28 36.31 51.28 41.04M42.84 41.29Q42.84 39.40 42.11 38.32Q41.38 37.25 39.85 37.25Q38.53 37.25 37.71 38.38Q36.88 39.52 36.88 41.49L36.88 41.88Q36.88 43.77 37.59 44.91Q38.29 46.04 39.70 46.04Q41.20 46.04 42.02 44.80Q42.84 43.56 42.84 41.29"
          />
        </G>
      </Svg>
    </View>
  );
}

