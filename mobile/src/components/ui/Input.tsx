import React, { useState } from "react";
import {
  TextInput as RNTextInput,
  View,
  TouchableOpacity,
  type TextInputProps as RNTextInputProps,
  type ViewStyle,
} from "react-native";
import { Eye, EyeOff } from "lucide-react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { Text } from "./Text";

interface InputProps extends RNTextInputProps {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  containerStyle?: ViewStyle;
  isPassword?: boolean;
}

export function Input({
  label,
  error,
  hint,
  leftIcon,
  rightIcon,
  containerStyle,
  isPassword,
  style,
  ...props
}: InputProps) {
  const { theme } = useTheme();
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const borderColor = error
    ? theme.colors.danger
    : isFocused
    ? theme.colors.primary
    : theme.colors.border;

  return (
    <View style={containerStyle}>
      {label && (
        <Text
          variant="caption"
          style={{
            marginBottom: theme.spacing.xs,
            color: error ? theme.colors.danger : theme.colors.fgMuted,
          }}
        >
          {label}
        </Text>
      )}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: theme.colors.bgSurface,
          borderRadius: theme.radii.md,
          borderWidth: 1.5,
          borderColor,
          paddingHorizontal: theme.spacing.lg,
          minHeight: 48,
        }}
      >
        {leftIcon && (
          <View style={{ marginRight: theme.spacing.sm }}>
            {leftIcon}
          </View>
        )}
        <RNTextInput
          style={[
            {
              flex: 1,
              fontSize: 15,
              fontWeight: "400",
              color: theme.colors.fg,
              paddingVertical: theme.spacing.md,
            },
            style,
          ]}
          placeholderTextColor={theme.colors.fgMuted}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          secureTextEntry={isPassword && !showPassword}
          autoCapitalize="none"
          {...props}
        />
        {isPassword && (
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
            {showPassword ? (
              <EyeOff size={20} color={theme.colors.fgMuted} />
            ) : (
              <Eye size={20} color={theme.colors.fgMuted} />
            )}
          </TouchableOpacity>
        )}
        {rightIcon && !isPassword && (
          <View style={{ marginLeft: theme.spacing.sm }}>
            {rightIcon}
          </View>
        )}
      </View>
      {error && (
        <Text
          variant="caption"
          color={theme.colors.danger}
          style={{ marginTop: theme.spacing.xs }}
        >
          {error}
        </Text>
      )}
      {hint && !error && (
        <Text
          variant="caption"
          muted
          style={{ marginTop: theme.spacing.xs }}
        >
          {hint}
        </Text>
      )}
    </View>
  );
}
