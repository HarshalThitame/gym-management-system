import React, { useEffect, useRef } from "react";
import { View, Animated, type ViewStyle } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export function Skeleton({
  width = "100%",
  height = 16,
  borderRadius,
  style,
}: SkeletonProps) {
  const { theme } = useTheme();
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.7,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        {
          width: width as ViewStyle["width"],
          height,
          borderRadius: borderRadius ?? theme.radii.md,
          backgroundColor: theme.colors.bgSurfaceMuted,
          opacity,
        },
        style,
      ]}
    />
  );
}

export function SkeletonCard() {
  const { theme } = useTheme();

  return (
    <View
      style={{
        padding: theme.spacing.lg,
        backgroundColor: theme.colors.bgSurface,
        borderRadius: theme.radii.lg,
        gap: theme.spacing.md,
      }}
    >
      <Skeleton width="40%" height={12} />
      <Skeleton width="60%" height={24} />
      <Skeleton width="100%" height={14} />
    </View>
  );
}

export function SkeletonList({ count = 3 }: { count?: number }) {
  const { theme } = useTheme();

  return (
    <View style={{ gap: theme.spacing.md }}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </View>
  );
}
