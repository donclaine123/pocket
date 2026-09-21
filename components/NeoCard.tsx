import React, { useState } from "react";
import {
  Pressable,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";
import { COLORS } from "../constants/theme";

export interface NeoCardProps {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
  shadowColor?: string;
  borderRadius?: number;
  borderWidth?: number;
  borderColor?: string;
  backgroundColor?: string;
  onPress?: () => void;
  onLongPress?: () => void;
  hitSlop?: any;
  accessibilityLabel?: string;
  disabled?: boolean;
  [key: string]: any;
}

export function NeoCard({
  children,
  style,
  containerStyle,
  shadowOffsetX = 3.5,
  shadowOffsetY = 4.5,
  shadowColor = COLORS.ink,
  borderRadius: propBorderRadius = 24,
  borderWidth: propBorderWidth = 2,
  borderColor: propBorderColor = COLORS.cardBorder,
  backgroundColor: propBackgroundColor = COLORS.cream,
  onPress,
  onLongPress,
  hitSlop,
  accessibilityLabel,
  disabled,
  ...rest
}: NeoCardProps) {
  const [isPressed, setIsPressed] = useState(false);

  // Flatten incoming style to separate container positioning from card surface styling
  const flattened = (StyleSheet.flatten(style) || {}) as Record<string, any>;
  const containerMargins: Record<string, any> = {};
  const innerCardStyle: Record<string, any> = {};

  const effectiveBorderRadius = flattened.borderRadius ?? propBorderRadius;
  const effectiveBorderWidth = flattened.borderWidth ?? propBorderWidth;
  const effectiveBorderColor = flattened.borderColor ?? propBorderColor;
  const effectiveBackgroundColor = flattened.backgroundColor ?? propBackgroundColor;

  for (const [key, value] of Object.entries(flattened)) {
    if (
      key.startsWith("margin") ||
      key === "flex" ||
      key === "alignSelf" ||
      key === "width" ||
      key === "maxWidth" ||
      key === "minWidth" ||
      key === "zIndex"
    ) {
      containerMargins[key] = value;
    } else if (
      key !== "borderRadius" &&
      key !== "borderWidth" &&
      key !== "borderColor" &&
      key !== "backgroundColor"
    ) {
      innerCardStyle[key] = value;
    }
  }

  const hasShadow = shadowOffsetX > 0 || shadowOffsetY > 0;

  // When pressed, translate card toward the shadow for a tactile 3D button press feel
  const pressTransform =
    onPress && isPressed && hasShadow
      ? [
          { translateX: Math.min(shadowOffsetX, 2) },
          { translateY: Math.min(shadowOffsetY, 2.5) },
        ]
      : undefined;

  const cardSurfaceStyle: any = [
    {
      backgroundColor: effectiveBackgroundColor,
      borderRadius: effectiveBorderRadius,
      borderWidth: effectiveBorderWidth,
      borderColor: effectiveBorderColor,
      overflow: "hidden",
      ...(hasShadow && {
        marginRight: shadowOffsetX,
        marginBottom: shadowOffsetY,
      }),
      ...(containerMargins.flex ? { flex: 1 } : null),
    },
    innerCardStyle,
    pressTransform ? { transform: pressTransform } : null,
  ];

  return (
    <View style={[styles.wrapper, containerMargins, containerStyle]}>
      {/* Neobrutalist Solid Shadow Underlay - 100% inside container so Android never clips it */}
      {hasShadow && (
        <View
          pointerEvents="none"
          style={[
            styles.underlay,
            {
              top: shadowOffsetY,
              left: shadowOffsetX,
              right: 0,
              bottom: 0,
              backgroundColor: shadowColor,
              borderRadius: effectiveBorderRadius,
            },
          ]}
        />
      )}

      {/* Foreground Card Surface */}
      {onPress ? (
        <Pressable
          onPress={onPress}
          onLongPress={onLongPress}
          onPressIn={() => setIsPressed(true)}
          onPressOut={() => setIsPressed(false)}
          hitSlop={hitSlop}
          disabled={disabled}
          accessibilityLabel={accessibilityLabel}
          style={cardSurfaceStyle}
          {...rest}
        >
          {children}
        </Pressable>
      ) : (
        <View style={cardSurfaceStyle} {...rest}>
          {children}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "relative",
    overflow: "visible",
  },
  underlay: {
    position: "absolute",
  },
});
