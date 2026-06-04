export const NETWORKS = [
  { id: "apple-net", name: "Apple Net", color: "#1B7A3D", bgColor: "#E8F5E9", emoji: "🍎" },
  { id: "al-faris-net", name: "Al-Faris Net", color: "#FF9500", bgColor: "#FFF3E0", emoji: "⚔️" },
  { id: "hi-net", name: "Hi-Net", color: "#007AFF", bgColor: "#E3F2FD", emoji: "📡" },
  { id: "bashib-net", name: "BASHIB NET", color: "#AF52DE", bgColor: "#F3E5F5", emoji: "🔥" },
];

export const CARD_TIERS = [
  { tier: "200", price: 200, data: "800 ميجابايت", duration: 2, icon: "🟢" },
  { tier: "300", price: 300, data: "1 جيجابايت", duration: 3, icon: "🔵" },
  { tier: "500", price: 500, data: "2 جيجابايت", duration: 5, icon: "🟡" },
  { tier: "1000", price: 1000, data: "4 جيجابايت", duration: 10, icon: "🔴" },
  { tier: "2000", price: 2000, data: "8 جيجابايت", duration: 15, icon: "🟣" },
];

export const ADMIN_WHATSAPP = "967774146432";

// iOS-style spring animation configs
export const iOSSpring = {
  /** Page Enter: spring(120, 14) */
  gentle: { type: "spring" as const, stiffness: 120, damping: 14, mass: 1 },
  /** Sheet transition: spring(120, 14) */
  sheet: { type: "spring" as const, stiffness: 120, damping: 14, mass: 1 },
  /** Page enter transition: spring(120, 14) */
  pageEnter: { type: "spring" as const, stiffness: 120, damping: 14, mass: 1 },
  /** Nav indicator: spring(500, 30) with layoutId */
  navIndicator: { type: "spring" as const, stiffness: 500, damping: 30, mass: 1 },
  bouncy: { type: "spring" as const, stiffness: 300, damping: 15, mass: 0.8 },
  stiff: { type: "spring" as const, stiffness: 400, damping: 25, mass: 1 },
  slow: { type: "spring" as const, stiffness: 80, damping: 20, mass: 1.2 },
};

/** iOS Tap animation: scale(0.97), duration 100ms */
export const iOSTap = {
  whileTap: { scale: 0.97 },
  transition: { duration: 0.1 },
};

export const formatDate = (timestamp: number) => {
  const d = new Date(timestamp);
  return d.toLocaleDateString("ar-YE", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
};

export const formatDateShort = (timestamp: number) => {
  const d = new Date(timestamp);
  return d.toLocaleDateString("ar-YE", { month: "short", day: "numeric" });
};

// Rate limiting helper
export const checkRateLimit = (attempts: number[], maxAttempts: number, windowMs: number): { allowed: boolean; remainingMs: number } => {
  const now = Date.now();
  const recentAttempts = attempts.filter(t => now - t < windowMs);
  if (recentAttempts.length >= maxAttempts) {
    const oldestInWindow = recentAttempts[0];
    const remainingMs = windowMs - (now - oldestInWindow);
    return { allowed: false, remainingMs };
  }
  return { allowed: true, remainingMs: 0 };
};

export const generateWhatsAppLink = (phone: string, message: string) => {
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
};

// ========== بيانات المحافظات والمديريات ==========
export interface Province {
  id: string;
  name: string;
  isCapital?: boolean;
  districts: string[];
}

export const PROVINCES: Province[] = [
  {
    id: "aden",
    name: "العاصمة المؤقتة عدن",
    isCapital: true,
    districts: ["صيرة (كريتر)", "المعلا", "التواهي", "خور مكسر", "المنصورة", "الشيخ عثمان", "دار سعد", "البريقة"],
  },
  {
    id: "lahj",
    name: "لحج",
    districts: ["الحوطة", "تبن", "المقاطرة", "القبيطة", "طور الباحة", "المضاربة ورأس العارة", "المفلحي", "يهر", "لبعوس", "الحد", "الملاح", "المسيمير", "حبيل جبر", "ردفان (الحبيلين)"],
  },
  {
    id: "abyan",
    name: "أبين",
    districts: ["زنجبار", "خنفر (جعار)", "لودر", "مودية", "الوضيع", "أحور", "المحفد", "جيشان", "سباح", "رصد", "سرار"],
  },
  {
    id: "aldhale",
    name: "الضالع",
    districts: ["الضالع", "قعطبة", "دمت", "الأزارق", "جحاف", "الحشاء", "الشعيب", "الحصين", "جبن"],
  },
  {
    id: "shabwah",
    name: "شبوة",
    districts: ["عتق", "بيحان", "عسيلان", "عين", "مرخة العليا", "مرخة السفلى", "نصاب", "حطيب", "الصعيد", "الروضة", "حبان", "ميفعة", "الرضوم", "دعر", "جردان", "الطلح", "عرماء"],
  },
  {
    id: "hadramout",
    name: "حضرموت",
    districts: ["المكلا", "أرياف المكلا", "الشحر", "غيل باوزير", "غيل بن يمين", "الدين", "حجر", "بروم وميفع", "الريدة وقصيعر", "قصيعر", "سيئون", "تريم", "شبام", "القطن", "وادي العين", "حورة", "حريضة", "عمد", "رخية", "السوم", "ثمود", "رماه", "القف", "زمخ ومنوخ", "ساه", "دوعن", "الضليعة", "يبعث", "حجر الصيعر", "العبر"],
  },
  {
    id: "almahrah",
    name: "المهرة",
    districts: ["الغيضة", "شحن", "حات", "حوف", "سيحوت", "المسيلة", "قشن", "حصوين", "منعر"],
  },
  {
    id: "socotra",
    name: "أرخبيل سقطرى",
    districts: ["حديبو", "قلنسية وعبد الكوري"],
  },
  {
    id: "marib",
    name: "مأرب",
    districts: ["مدينة مأرب", "مأرب (المديرية)", "الوادي", "صرواح", "مجزر", "مدغل الجدعان", "رغوان", "حريب", "العبدية", "ماهلية", "رحبة", "الجوبة", "جبل مراد", "حريب القراميش"],
  },
  {
    id: "taiz",
    name: "تعز",
    districts: ["القاهرة", "المظفر", "صالة", "التعزية", "صبر الموادم", "المشرعة والحدنان", "المعافر", "الشمايتين (التربة)", "المواسط", "الصلو", "حيفان", "المسراخ", "جبل حبشي", "مقبنة", "شرعب الرونة", "شرعب السلام", "موزع", "الوازعية", "ذوباب (باب المندب)", "المخا", "الخوخة", "السياني", "سامع"],
  },
];

// قائمة أسماء المحافظات فقط (للاستخدام السريع)
export const PROVINCE_NAMES = PROVINCES.map(p => p.name);

// الحصول على مديريات محافظة معينة
export const getDistricts = (provinceId: string): string[] => {
  const province = PROVINCES.find(p => p.id === provinceId);
  return province ? province.districts : [];
};

// @deprecated Use PROVINCES/getDistricts instead
export const ADEN_DISTRICTS = PROVINCES.find(p => p.id === "aden")?.districts || [];
