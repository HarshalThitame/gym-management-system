export type Locale = "en" | "hi" | "mr" | "gu";

export const locales: Locale[] = ["en", "hi", "mr", "gu"];
export const localeNames: Record<Locale, string> = { en: "English", hi: "हिन्दी", mr: "मराठी", gu: "ગુજરાતી" };

type TranslationMap = Record<string, Record<string, string>>;

export const translations: TranslationMap = {
  // Navigation
  "Dashboard": { en: "Dashboard", hi: "डैशबोर्ड", mr: "डॅशबोर्ड", gu: "ડેશબોર્ડ" },
  "Gyms": { en: "Gyms", hi: "जिम", mr: "जिम", gu: "જીમ" },
  "Staff": { en: "Staff", hi: "स्टाफ", mr: "स्टाफ", gu: "સ્ટાફ" },
  "Members": { en: "Members", hi: "सदस्य", mr: "सदस्य", gu: "સભ્યો" },
  "Memberships": { en: "Memberships", hi: "सदस्यता", mr: "सदस्यत्व", gu: "સભ્યપદ" },
  "Revenue": { en: "Revenue", hi: "राजस्व", mr: "महसूल", gu: "આવક" },
  "Trainers": { en: "Trainers", hi: "प्रशिक्षक", mr: "प्रशिक्षक", gu: "ટ્રેનર્સ" },
  "Attendance": { en: "Attendance", hi: "उपस्थिति", mr: "उपस्थिती", gu: "હાજરી" },
  "Classes": { en: "Classes", hi: "कक्षाएं", mr: "वर्ग", gu: "વર્ગો" },
  "Communications": { en: "Communications", hi: "संचार", mr: "संवाद", gu: "સંદેશાવ્યવહાર" },
  "Analytics": { en: "Analytics", hi: "एनालिटिक्स", mr: "विश्लेषण", gu: "એનાલિટિક્સ" },
  "Branding": { en: "Branding", hi: "ब्रांडिंग", mr: "ब्रँडिंग", gu: "બ્રાન્ડિંગ" },
  "Domains": { en: "Domains", hi: "डोमेन", mr: "डोमेन", gu: "ડોમેન્સ" },
  "Billing": { en: "Billing", hi: "बिलिंग", mr: "बिलिंग", gu: "બિલિંગ" },
  "Settings": { en: "Settings", hi: "सेटिंग्स", mr: "सेटिंग्ज", gu: "સેટિંગ્સ" },
  "Security": { en: "Security", hi: "सुरक्षा", mr: "सुरक्षा", gu: "સુરક્ષા" },

  // Common actions
  "Create": { en: "Create", hi: "बनाएं", mr: "तयार करा", gu: "બનાવો" },
  "Edit": { en: "Edit", hi: "संपादित", mr: "संपादित", gu: "સંપાદિત" },
  "Save": { en: "Save", hi: "सहेजें", mr: "जतन करा", gu: "સાચવો" },
  "Delete": { en: "Delete", hi: "हटाएं", mr: "हटवा", gu: "કાઢી નાખો" },
  "Cancel": { en: "Cancel", hi: "रद्द करें", mr: "रद्द करा", gu: "રદ કરો" },
  "Search": { en: "Search", hi: "खोजें", mr: "शोधा", gu: "શોધો" },
  "Filter": { en: "Filter", hi: "फ़िल्टर", mr: "फिल्टर", gu: "ફિલ્ટર" },
  "Export": { en: "Export", hi: "निर्यात", mr: "निर्यात", gu: "નિકાસ" },
  "Previous": { en: "Previous", hi: "पिछला", mr: "मागील", gu: "પાછળનું" },
  "Next": { en: "Next", hi: "अगला", mr: "पुढील", gu: "આગળનું" },

  // Status
  "Active": { en: "Active", hi: "सक्रिय", mr: "सक्रिय", gu: "સક્રિય" },
  "Inactive": { en: "Inactive", hi: "निष्क्रिय", mr: "निष्क्रिय", gu: "નિષ્ક્રિય" },
  "Suspended": { en: "Suspended", hi: "निलंबित", mr: "निलंबित", gu: "સસ્પેન્ડેડ" },
  "Archived": { en: "Archived", hi: "संग्रहीत", mr: "संग्रहित", gu: "આર્કાઇવ્ડ" },

  // Placeholders
  "Organization Owner Portal": { en: "Organization Owner Portal", hi: "संगठन स्वामी पोर्टल", mr: "संस्था मालक पोर्टल", gu: "સંસ્થા માલિક પોર્ટલ" },
  "Organization Command Center": { en: "Organization Command Center", hi: "संगठन कमांड सेंटर", mr: "संस्था कमांड सेंटर", gu: "સંસ્થા કમાન્ડ સેન્ટર" },
};

export function t(key: string, locale: Locale): string {
  return translations[key]?.[locale] ?? key;
}

export function useLocale(): Locale {
  if (typeof window === "undefined") return "en";
  try {
    const stored = localStorage.getItem("org-owner-locale") as Locale | null;
    if (stored && locales.includes(stored)) return stored;
  } catch {}
  return "en";
}
