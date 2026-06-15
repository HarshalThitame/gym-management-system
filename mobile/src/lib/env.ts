import Constants from "expo-constants";

function getEnvVar(key: string): string | undefined {
  return Constants.expoConfig?.extra?.[key] as string | undefined ?? process.env[key];
}

function requireEnvVar(key: string): string {
  const value = getEnvVar(key);
  if (!value) {
    if (typeof __DEV__ !== "undefined" && __DEV__) {
      console.warn(`Missing environment variable: ${key}. Using placeholder.`);
    }
    return "";
  }
  return value;
}

export const env = {
  supabaseUrl: requireEnvVar("EXPO_PUBLIC_SUPABASE_URL"),
  supabaseAnonKey: requireEnvVar("EXPO_PUBLIC_SUPABASE_ANON_KEY"),
  apiUrl: getEnvVar("EXPO_PUBLIC_API_URL") ?? "https://apexgymmanagementsystem.vercel.app/api",
  vapidPublicKey: getEnvVar("EXPO_PUBLIC_VAPID_PUBLIC_KEY"),
  razorpayKeyId: getEnvVar("EXPO_PUBLIC_RAZORPAY_KEY_ID"),
  appName: getEnvVar("EXPO_PUBLIC_APP_NAME") ?? "Apex Performance Club",
  appEnv: getEnvVar("EXPO_PUBLIC_APP_ENV") ?? "development",
  isDev: (getEnvVar("EXPO_PUBLIC_APP_ENV") ?? "development") === "development",
};

export function hasSupabaseConfig(): boolean {
  try {
    return !!env.supabaseUrl && !!env.supabaseAnonKey;
  } catch {
    return false;
  }
}
