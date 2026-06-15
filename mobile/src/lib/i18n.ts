import * as Localization from "expo-localization";
import { I18n } from "i18n-js";

const en = {
  common: {
    loading: "Loading...",
    error: "Something went wrong",
    retry: "Retry",
    cancel: "Cancel",
    save: "Save",
    delete: "Delete",
    confirm: "Confirm",
    search: "Search",
    noData: "No data available",
    offline: "You are offline",
    online: "Back online",
    sync: "Sync",
    syncing: "Syncing...",
  },
  auth: {
    signIn: "Sign In",
    signUp: "Sign Up",
    signOut: "Sign Out",
    email: "Email",
    password: "Password",
    forgotPassword: "Forgot password?",
    noAccount: "Don't have an account?",
    hasAccount: "Already have an account?",
    verifyEmail: "Verify your email",
    resetPassword: "Reset Password",
  },
  member: {
    dashboard: "Dashboard",
    membership: "Membership",
    attendance: "Attendance",
    workouts: "Workouts",
    nutrition: "Diet & Nutrition",
    progress: "Progress",
    billing: "Payments & Billing",
    notifications: "Notifications",
    trainer: "My Trainer",
    referrals: "Refer a Friend",
    offers: "Offers",
    settings: "Settings",
    profile: "Profile",
    checkIn: "Check In",
    daysLeft: "Days Left",
    streak: "Day Streak",
    status: "Status",
    active: "Active",
    expired: "Expired",
  },
  admin: {
    dashboard: "Dashboard",
    members: "Members",
    payments: "Payments",
    attendance: "Attendance",
    settings: "Settings",
    staff: "Staff",
    trainers: "Trainers",
    reports: "Reports",
    revenue: "Revenue",
  },
};

const hi: typeof en = {
  common: {
    loading: "लोड हो रहा है...",
    error: "कुछ गलत हो गया",
    retry: "पुनः प्रयास करें",
    cancel: "रद्द करें",
    save: "सहेजें",
    delete: "हटाएं",
    confirm: "पुष्टि करें",
    search: "खोजें",
    noData: "कोई डेटा उपलब्ध नहीं",
    offline: "आप ऑफ़लाइन हैं",
    online: "वापस ऑनलाइन",
    sync: "सिंक करें",
    syncing: "सिंक हो रहा है...",
  },
  auth: {
    signIn: "साइन इन",
    signUp: "साइन अप",
    signOut: "साइन आउट",
    email: "ईमेल",
    password: "पासवर्ड",
    forgotPassword: "पासवर्ड भूल गए?",
    noAccount: "खाता नहीं है?",
    hasAccount: "पहले से खाता है?",
    verifyEmail: "ईमेल सत्यापित करें",
    resetPassword: "पासवर्ड रीसेट करें",
  },
  member: {
    dashboard: "डैशबोर्ड",
    membership: "सदस्यता",
    attendance: "उपस्थिति",
    workouts: "वर्कआउट",
    nutrition: "आहार और पोषण",
    progress: "प्रगति",
    billing: "भुगतान और बिलिंग",
    notifications: "सूचनाएं",
    trainer: "मेरे ट्रेनर",
    referrals: "रेफ़र करें",
    offers: "ऑफ़र",
    settings: "सेटिंग्स",
    profile: "प्रोफ़ाइल",
    checkIn: "चेक इन",
    daysLeft: "शेष दिन",
    streak: "दिनों का क्रम",
    status: "स्थिति",
    active: "सक्रिय",
    expired: "समाप्त",
  },
  admin: {
    dashboard: "डैशबोर्ड",
    members: "सदस्य",
    payments: "भुगतान",
    attendance: "उपस्थिति",
    settings: "सेटिंग्स",
    staff: "स्टाफ",
    trainers: "ट्रेनर",
    reports: "रिपोर्ट",
    revenue: "राजस्व",
  },
};

const locale = Localization.getLocales()?.[0]?.languageTag ?? "en";
const translations: Record<string, typeof en> = { en, hi };

export const i18n = new I18n(translations);
i18n.locale = locale.startsWith("hi") ? "hi" : "en";
i18n.enableFallback = true;

export function useI18n() {
  return {
    t: (path: string) => {
      const keys = path.split(".");
      let value: any = i18n;
      for (const key of keys) {
        value = value?.[key];
      }
      return (value as string) ?? path;
    },
    locale: i18n.locale,
    setLocale: (l: string) => { i18n.locale = l; },
  };
}
