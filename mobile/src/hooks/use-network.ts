import { useEffect, useState, useCallback } from "react";
import NetInfo from "@react-native-community/netinfo";

interface NetworkState {
  isOnline: boolean;
  isInternetReachable: boolean;
  type: string;
}

export function useNetwork(): NetworkState {
  const [state, setState] = useState<NetworkState>({
    isOnline: true,
    isInternetReachable: true,
    type: "unknown",
  });

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((netState) => {
      setState({
        isOnline: netState.isConnected ?? true,
        isInternetReachable: netState.isInternetReachable ?? true,
        type: netState.type,
      });
    });

    return () => unsubscribe();
  }, []);

  return state;
}

export function useIsOnline(): boolean {
  const { isOnline } = useNetwork();
  return isOnline;
}
