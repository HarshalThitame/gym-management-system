import { useState, useCallback, useEffect } from "react";
import * as LocalAuthentication from "expo-local-authentication";
import { Platform } from "react-native";

const isWeb = Platform.OS === "web";

interface BiometricState {
  isAvailable: boolean;
  biometryType: LocalAuthentication.AuthenticationType | null;
  enrolled: boolean;
}

export function useBiometric() {
  const [state, setState] = useState<BiometricState>({
    isAvailable: false,
    biometryType: null,
    enrolled: false,
  });

  useEffect(() => {
    if (isWeb) return;
    checkBiometrics();
  }, []);

  const checkBiometrics = useCallback(async () => {
    try {
      const [compatible, enrolled, biometryType] = await Promise.all([
        LocalAuthentication.hasHardwareAsync(),
        LocalAuthentication.isEnrolledAsync(),
        LocalAuthentication.supportedAuthenticationTypesAsync(),
      ]);

      setState({
        isAvailable: compatible && enrolled,
        biometryType: biometryType[0] ?? null,
        enrolled,
      });
    } catch {
      setState({ isAvailable: false, biometryType: null, enrolled: false });
    }
  }, []);

  const authenticate = useCallback(async (reason?: string): Promise<boolean> => {
    if (isWeb || !state.isAvailable) return false;

    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: reason ?? "Authenticate to continue",
        fallbackLabel: "Use passcode",
        cancelLabel: "Cancel",
        disableDeviceFallback: false,
      });
      return result.success;
    } catch {
      return false;
    }
  }, [state.isAvailable]);

  const getBiometryLabel = useCallback((): string => {
    if (isWeb) return "";
    switch (state.biometryType) {
      case LocalAuthentication.AuthenticationType.FINGERPRINT:
        return "Touch ID";
      case LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION:
        return "Face ID";
      case LocalAuthentication.AuthenticationType.IRIS:
        return "Iris";
      default:
        return "Biometric";
    }
  }, [state.biometryType]);

  return {
    ...state,
    biometryLabel: getBiometryLabel(),
    checkBiometrics,
    authenticate,
    isWeb,
  };
}
