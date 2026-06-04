export type Language = "ar" | "en";

export const translations = {
  ar: {
    nav: {
      home: "الرئيسية",
      cards: "الكروت",
      starlink: "Starlink",
      credit: "رصيدي",
      more: "المزيد",
    },
    menu: {
      title: "القائمة",
      home: "الرئيسية",
      buyCards: "شراء كروت",
      submitNetwork: "تقديم شبكة",
      starlink: "Starlink",
      deposit: "إيداع رصيد",
      myBalance: "رصيدي",
      myPurchases: "مشترياتي",
      profile: "الملف الشخصي",
      more: "المزيد",
      dashboard: "لوحة التحكم",
    },
    auth: {
      login: "تسجيل الدخول",
      register: "إنشاء حساب",
      logout: "تسجيل الخروج",
      loginPrompt: "سجل الدخول للوصول لكل المزايا",
    },
    splash: {
      loading: "جاري التحميل...",
    },
    permissions: {
      title: "تفعيل الإشعارات",
      titleEn: "Enable Notifications",
      body: "ابق على اطلاع بحالة طلباتك وعروض الشبكات والتحديثات المهمة",
      bodyEn: "Stay updated on your orders, network offers, and important updates",
      allow: "السماح",
      skip: "تخطي",
      camera: "الوصول للكاميرا",
      cameraBody: "مطلوب لتحميل صور ووثائق حسابك",
      location: "الوصول للموقع",
      locationBody: "لعرض الشبكات القريبة منك",
    },
    location: {
      title: "اختر موقعك",
      subtitle: "حدد محافظتك ومديريتك لعرض الشبكات القريبة منك",
      province: "المحافظة",
      district: "المديرية",
      selectProvince: "اختر المحافظة",
      selectDistrict: "اختر المديرية",
      selectProvinceFirst: "اختر المحافظة أولاً",
      save: "حفظ",
      saving: "جاري الحفظ...",
      skip: "تخطي",
      savedSuccess: "تم حفظ موقعك بنجاح",
      saveError: "حدث خطأ أثناء الحفظ",
    },
    common: {
      save: "حفظ",
      cancel: "إلغاء",
      back: "رجوع",
      close: "إغلاق",
      loading: "جاري التحميل...",
      error: "حدث خطأ",
      success: "تم بنجاح",
      retry: "إعادة المحاولة",
      admin: "أدمن",
      networkManager: "مشرف شبكة",
    },
    theme: {
      dark: "الوضع الداكن",
      light: "الوضع الفاتح",
      toggle: "تبديل السمة",
    },
    language: {
      toggle: "English",
      current: "عربي",
    },
  },
  en: {
    nav: {
      home: "Home",
      cards: "Cards",
      starlink: "Starlink",
      credit: "Balance",
      more: "More",
    },
    menu: {
      title: "Menu",
      home: "Home",
      buyCards: "Buy Cards",
      submitNetwork: "Submit Network",
      starlink: "Starlink",
      deposit: "Deposit",
      myBalance: "My Balance",
      myPurchases: "My Purchases",
      profile: "Profile",
      more: "More",
      dashboard: "Dashboard",
    },
    auth: {
      login: "Sign In",
      register: "Create Account",
      logout: "Sign Out",
      loginPrompt: "Sign in to access all features",
    },
    splash: {
      loading: "Loading...",
    },
    permissions: {
      title: "Enable Notifications",
      titleEn: "Enable Notifications",
      body: "Stay updated on your orders, network offers, and important updates",
      bodyEn: "Stay updated on your orders, network offers, and important updates",
      allow: "Allow",
      skip: "Skip",
      camera: "Camera Access",
      cameraBody: "Required to upload photos and documents for your account",
      location: "Location Access",
      locationBody: "To show nearby networks in your area",
    },
    location: {
      title: "Choose Your Location",
      subtitle: "Select your province and district to see nearby networks",
      province: "Province",
      district: "District",
      selectProvince: "Select Province",
      selectDistrict: "Select District",
      selectProvinceFirst: "Select Province First",
      save: "Save",
      saving: "Saving...",
      skip: "Skip",
      savedSuccess: "Location saved successfully",
      saveError: "An error occurred while saving",
    },
    common: {
      save: "Save",
      cancel: "Cancel",
      back: "Back",
      close: "Close",
      loading: "Loading...",
      error: "An error occurred",
      success: "Success",
      retry: "Retry",
      admin: "Admin",
      networkManager: "Network Manager",
    },
    theme: {
      dark: "Dark Mode",
      light: "Light Mode",
      toggle: "Toggle Theme",
    },
    language: {
      toggle: "عربي",
      current: "English",
    },
  },
} as const;

export type TranslationKey = typeof translations.ar;

export function t(lang: Language, path: string): string {
  const keys = path.split(".");
  let current: unknown = translations[lang];
  for (const key of keys) {
    if (current && typeof current === "object" && key in (current as object)) {
      current = (current as Record<string, unknown>)[key];
    } else {
      return path;
    }
  }
  return typeof current === "string" ? current : path;
}
