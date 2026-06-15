import React, { useEffect, useRef } from "react";
import { View, Modal as RNModal, TouchableOpacity, Animated, Dimensions, type ViewStyle } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { Text } from "./Text";
import { X } from "lucide-react-native";

interface ModalProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  style?: ViewStyle;
}

export function Modal({ visible, onClose, title, children, style }: ModalProps) {
  const { theme } = useTheme();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(300)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
      ]).start();
    } else {
      fadeAnim.setValue(0);
      slideAnim.setValue(300);
    }
  }, [visible]);

  return (
    <RNModal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={{
        flex: 1, backgroundColor: "rgba(0,0,0,0.5)",
        justifyContent: "flex-end", opacity: fadeAnim,
      }}>
        <TouchableOpacity style={{ flex: 1 }} onPress={onClose} />
        <Animated.View style={[{
          backgroundColor: theme.colors.bgSurface,
          borderTopLeftRadius: theme.radii["2xl"],
          borderTopRightRadius: theme.radii["2xl"],
          paddingTop: theme.spacing.lg,
          paddingHorizontal: theme.spacing.lg,
          paddingBottom: theme.spacing["4xl"],
          maxHeight: Dimensions.get("window").height * 0.85,
          transform: [{ translateY: slideAnim }],
        }, style]}>
          {title && (
            <View style={{
              flexDirection: "row", justifyContent: "space-between", alignItems: "center",
              marginBottom: theme.spacing.lg,
            }}>
              <Text variant="h4">{title}</Text>
              <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <X size={24} color={theme.colors.fgMuted} />
              </TouchableOpacity>
            </View>
          )}
          {children}
        </Animated.View>
      </Animated.View>
    </RNModal>
  );
}

export function BottomSheet({ visible, onClose, title, children, style }: ModalProps) {
  return (
    <Modal visible={visible} onClose={onClose} title={title} style={style}>
      {children}
    </Modal>
  );
}
