export interface AppUser {
  uid: string;
  email: string;
  displayName: string;
  phone: string;
  role: "user" | "admin" | "network_manager";
  managedNetwork: string;
  balance: number;
  createdAt: number;
  isActive: boolean;
}

export interface CardItem {
  id: string;
  code: string;
  price: number;
  data: string;
  duration: number;
  isUsed: boolean;
  usedBy: string | null;
  usedAt: number | null;
  tier: string;
  network: string;
  createdAt: number;
}

export interface SimCard {
  id: string;
  name: string;
  price: number;
  description: string;
  imageUrl: string;
  isAvailable: boolean;
}

export interface Advertisement {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  isActive: boolean;
}

export interface BankDetail {
  id: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
  isActive: boolean;
}

export interface CreditHistory {
  id: string;
  type: "deposit" | "purchase" | "gift" | "redeem" | "commission" | "refund";
  amount: number;
  description: string;
  date: number;
}

export interface DepositRequest {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  bankId: string;
  bankName: string;
  amount: number;
  referenceNumber: string;
  status: "pending" | "approved" | "rejected";
  createdAt: number;
  rejectionReason?: string;
}

export interface AppNotification {
  id: string;
  type: "deposit_approved" | "deposit_rejected" | "gift_received" | "new_deposit_request" | "subscription" | "general";
  title: string;
  message: string;
  isRead: boolean;
  createdAt: number;
  relatedId?: string;
}

export interface AdminSettings {
  adminWhatsApp: string;
  adminBankName: string;
}

export interface NetworkItem {
  id: string;
  name: string;
  color: string;
  bgColor: string;
  emoji: string;
  ownerId: string | null;
  ownerName: string | null;
  ownerPhone: string | null;
  location: string | null;
  provinceId: string | null;
  provinceName: string | null;
  district: string | null;
  exactLocation: string | null;
  connectionIP: string | null;
  imageBase64: string | null;
  networkType: string | null;
  coverage: string | null;
  speed: string | null;
  createdAt: number;
}

export interface TierItem {
  id: string;
  tier: string;
  price: number;
  data: string;
  duration: number;
  icon: string;
  createdAt: number;
}

export interface RedeemCode {
  id: string;
  code: string;
  amount: number;
  isUsed: boolean;
  usedBy: string | null;
  usedByName: string | null;
  usedAt: number | null;
  createdAt: number;
  createdBy: string | null;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  description: string;
  durationDays: number;
  isActive: boolean;
  createdAt: number;
}

export interface UserSubscription {
  id: string;
  planId: string;
  planName: string;
  activatedAt: number;
  expiresAt: number;
  isActive: boolean;
  autoRenew: boolean;
  uid: string;
}

export interface BulkNotification {
  id: string;
  title: string;
  message: string;
  type: AppNotification["type"];
  targetCount: number;
  sentAt: number;
  sentBy: string | null;
}

export interface StarlinkProduct {
  id: string;
  name: string;
  description: string;
  priceUSD: number;
  quantity: number;
  imageUrl: string;
  imageBase64?: string;
  specs: {
    downloadSpeed: string;
    uploadSpeed: string;
    latency: string;
    coverage: string;
  };
  isActive: boolean;
  createdAt: number;
}

// ========== فئات خاصة بالشبكة ==========
export interface NetworkTier {
  id: string;
  tier: string;
  price: number;
  data: string;
  duration: number;
  icon: string;
  networkId: string;
  createdAt: number;
}

// ========== إعدادات التطبيق ==========
export interface AppSettings {
  [key: string]: string | number | boolean | Record<string, unknown>;
}

export interface StarlinkOrder {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  userPhone: string;
  productId: string;
  productName: string;
  priceUSD: number;
  status: "pending" | "confirmed" | "shipped" | "delivered" | "cancelled";
  createdAt: number;
}

// ========== كود شحن جماعي ==========
export interface SharedRedeemCode {
  id: string;
  code: string;
  amount: number;
  maxRedemptions: number;
  currentRedemptions: number;
  description: string;
  isActive: boolean;
  createdAt: number;
  createdBy: string | null;
  redeemedBy: Record<string, { uid: string; name: string; redeemedAt: number }>;
}

// ========== أنواع جديدة: العمولات والتقديمات ==========

// طلب تقديم شبكة جديدة
export interface NetworkSubmission {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  userPhone: string;
  networkName: string;
  provinceId: string;
  provinceName: string;
  district: string;
  exactLocation: string;
  networkType: string;
  description: string;
  coverage: string;
  speed: string;
  status: "pending" | "approved" | "rejected";
  createdAt: number;
  reviewedAt: number | null;
  reviewedBy: string | null;
  rejectionReason: string | null;
  assignedNetworkId: string | null;
  imageBase64: string | null;
}

// سجل عمولة لمدير شبكة
export interface CommissionEntry {
  id: string;
  managerUid: string;
  managerName: string;
  networkId: string;
  networkName: string;
  cardId: string;
  cardTier: string;
  cardPrice: number;
  commissionRate: number;
  commissionAmount: number;
  provinceId: string;
  provinceName: string;
  district: string;
  soldAt: number;
  month: string;
  isPaid: boolean;
  paidAt: number | null;
}

// إعداد عمولة لمدير شبكة
export interface CommissionSetting {
  id: string;
  managerUid: string;
  managerName: string;
  networkId: string;
  networkName: string;
  defaultRate: number;
  provinceRates: Record<string, number>;
  districtRates: Record<string, number>;
  tierRates: Record<string, number>;
  updatedAt: number;
  updatedBy: string | null;
}

// ========== إدارة الأدوار ==========
export interface RoleManagement {
  uid: string;
  email: string;
  displayName: string;
  currentRole: "user" | "admin" | "network_manager";
  managedNetwork: string | null;
  managedNetworkName: string | null;
}

// أماكن بيع الكروت
export interface CardSaleLocation {
  id: string;
  networkId: string;
  networkName: string;
  name: string;              // اسم البقالة/المتجر
  provinceId: string;
  provinceName: string;
  district: string;
  exactLocation: string;     // العنوان التفصيلي
  phone: string | null;      // رقم هاتف المكان
  isActive: boolean;
  createdAt: number;
}

// توزيع شهوي للعمولات
export interface MonthlyPayout {
  id: string;
  month: string;
  managerUid: string;
  managerName: string;
  networkId: string;
  networkName: string;
  totalCommission: number;
  totalCards: number;
  bankName: string | null;
  bankAccount: string | null;
  status: "pending" | "processing" | "paid" | "failed";
  paidAt: number | null;
  createdAt: number;
  entries: string[];
}
