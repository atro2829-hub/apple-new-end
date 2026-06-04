"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Wifi, Users, Wallet, Gift, Receipt, Building2, Megaphone, Smartphone,
  Plus, Eye, EyeOff, Send, TrendingUp, BarChart3, Search, Check, Phone,
  CreditCard, Clock, Mail, ShieldCheck, ShoppingBag, ChevronDown, Copy,
  UserX, Pencil, Save, Globe, Crown, UserCog, Hash, Trash2, Download,
  Satellite, Package, Upload, MapPin, Banknote, Bell, FileText,
  Settings as SettingsIcon, Star, AlertTriangle, ToggleLeft, ToggleRight,
  Smartphone as SimIcon, Image as ImageIcon, Link, Info, MessageSquare,
  FileCheck, XCircle, CheckCircle2, Signal, Gauge, Store
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { db, auth } from "@/lib/firebase";
import { ref, set, get, push, update, remove, onValue, runTransaction } from "firebase/database";
import { toast } from "sonner";
import {
  CARD_TIERS as DEFAULT_TIERS, NETWORKS as DEFAULT_NETWORKS,
  PROVINCES, getDistricts, formatDate, iOSSpring, ADMIN_WHATSAPP
} from "@/lib/constants";
import { compressImageToBase64 } from "@/lib/utils";
import {
  AppUser, CardItem, BankDetail, Advertisement, SimCard, DepositRequest,
  NetworkItem, TierItem, RedeemCode, SubscriptionPlan, UserSubscription,
  BulkNotification, StarlinkProduct, StarlinkOrder, SharedRedeemCode,
  CommissionSetting, CommissionEntry, MonthlyPayout, CardSaleLocation
} from "@/lib/types";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// ─── Helper: format number with commas ─────────────────────
function fmt(n: number): string {
  return n.toLocaleString("en-US");
}

// ─── Helper: generate random redeem code ────────────────────
function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "AP";
  for (let i = 0; i < 8; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
  return code;
}

// ─── Tab definitions ────────────────────────────────────────
const ADMIN_TABS = [
  { id: "overview", icon: BarChart3, label: "الإحصائيات" },
  { id: "balances", icon: Wallet, label: "أرصدة" },
  { id: "users", icon: Users, label: "المستخدمين" },
  { id: "networks", icon: Wifi, label: "الشبكات" },
  { id: "networkRequests", icon: FileCheck, label: "طلبات الشبكات" },
  { id: "cards", icon: CreditCard, label: "الكروت" },
  { id: "orders", icon: Receipt, label: "الطلبات" },
  { id: "tiers", icon: Star, label: "الفئات" },
  { id: "starlink", icon: Satellite, label: "Starlink" },
  { id: "banks", icon: Building2, label: "البنوك" },
  { id: "sims", icon: SimIcon, label: "شرائح SIM" },
  { id: "ads", icon: Megaphone, label: "الإعلانات" },
  { id: "homeBanners", icon: ImageIcon, label: "بانرات الرئيسية" },
  { id: "gifts", icon: Gift, label: "أكواد الهدايا" },
  { id: "commissions", icon: Banknote, label: "العمولات" },
  { id: "subscriptions", icon: Crown, label: "الاشتراكات" },
  { id: "notifications", icon: Bell, label: "الإشعارات" },
  { id: "content", icon: FileText, label: "محتوى التطبيق" },
  { id: "saleLocations", icon: Store, label: "أماكن البيع" },
  { id: "settings", icon: SettingsIcon, label: "الإعدادات" },
];

const sectionVariants = {
  initial: { opacity: 0, y: 15 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -15 },
};

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════
export function AdminPanel({ onClose }: { onClose: () => void }) {
  const [activeTab, setActiveTab] = useState("overview");

  // ─── Firebase data ─────────────────────────────────────────
  const [allUsers, setAllUsers] = useState<Record<string, AppUser>>({});
  const [allCards, setAllCards] = useState<Record<string, CardItem>>({});
  const [allOrders, setAllOrders] = useState<Record<string, { userId: string; cardCode: string; price: number; status: string; createdAt: number }>>({});
  const [allBanks, setAllBanks] = useState<Record<string, BankDetail>>({});
  const [allAds, setAllAds] = useState<Record<string, Advertisement>>({});
  const [allSims, setAllSims] = useState<Record<string, SimCard>>({});
  const [allDeposits, setAllDeposits] = useState<Record<string, DepositRequest>>({});
  const [allRedeemCodes, setAllRedeemCodes] = useState<Record<string, RedeemCode>>({});
  const [allSharedRedeemCodes, setAllSharedRedeemCodes] = useState<Record<string, SharedRedeemCode>>({});
  const [fbNetworks, setFbNetworks] = useState<Record<string, NetworkItem>>({});
  const [fbTiers, setFbTiers] = useState<Record<string, TierItem>>({});
  const [subscriptionPlans, setSubscriptionPlans] = useState<Record<string, SubscriptionPlan>>({});
  const [userSubscriptions, setUserSubscriptions] = useState<Record<string, UserSubscription>>({});
  const [allBulkNotifications, setAllBulkNotifications] = useState<Record<string, BulkNotification>>({});
  const [allStarlinkProducts, setAllStarlinkProducts] = useState<Record<string, StarlinkProduct>>({});
  const [allStarlinkOrders, setAllStarlinkOrders] = useState<Record<string, StarlinkOrder>>({});
  const [allCommissionSettings, setAllCommissionSettings] = useState<Record<string, CommissionSetting>>({});
  const [allCommissionEntries, setAllCommissionEntries] = useState<Record<string, CommissionEntry>>({});
  const [allMonthlyPayouts, setAllMonthlyPayouts] = useState<Record<string, MonthlyPayout>>({});
  const [userBalances, setUserBalances] = useState<Record<string, number>>({});
  const [userHistories, setUserHistories] = useState<Record<string, { type: string; amount: number; description: string; date: number }[]>>({});
  const [hiddenSections, setHiddenSections] = useState<Record<string, boolean>>({});

  // ─── Settings ──────────────────────────────────────────────
  const [adminWhatsApp, setAdminWhatsApp] = useState(ADMIN_WHATSAPP);
  const [maxBalance, setMaxBalance] = useState(0);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [appDownloadUrl, setAppDownloadUrl] = useState("");
  const [latestAppVersion, setLatestAppVersion] = useState("");
  const [updateMessage, setUpdateMessage] = useState("");

  // ─── Form states ───────────────────────────────────────────
  const [userSearch, setUserSearch] = useState("");
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [editDisplayName, setEditDisplayName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Sale Locations
  const [saleLocations, setSaleLocations] = useState<Record<string, CardSaleLocation>>({});
  const [newLocName, setNewLocName] = useState("");
  const [newLocNetworkId, setNewLocNetworkId] = useState("");
  const [newLocProvinceId, setNewLocProvinceId] = useState("");
  const [newLocDistrict, setNewLocDistrict] = useState("");
  const [newLocExactLocation, setNewLocExactLocation] = useState("");
  const [newLocPhone, setNewLocPhone] = useState("");

  // Card forms
  const [newCardCode, setNewCardCode] = useState("");
  const [newCardPrice, setNewCardPrice] = useState("");
  const [newCardData, setNewCardData] = useState("");
  const [newCardDuration, setNewCardDuration] = useState("");
  const [newCardTier, setNewCardTier] = useState("200");
  const [newCardNetwork, setNewCardNetwork] = useState("apple-net");
  const [bulkCardCount, setBulkCardCount] = useState("10");
  const [bulkCardNetwork, setBulkCardNetwork] = useState("apple-net");
  const [bulkCardTier, setBulkCardTier] = useState("200");
  const [cardFilterNetwork, setCardFilterNetwork] = useState("all");
  const [cardFilterTier, setCardFilterTier] = useState("all");
  const [cardFilterStatus, setCardFilterStatus] = useState("all");
  const [isAddingBulk, setIsAddingBulk] = useState(false);
  const [cardAddMode, setCardAddMode] = useState<"single" | "bulk-codes">("single");
  const [bulkCodesText, setBulkCodesText] = useState("");
  const [bulkCodesNetwork, setBulkCodesNetwork] = useState("apple-net");
  const [bulkCodesTier, setBulkCodesTier] = useState("200");
  const [bulkCodesCustom, setBulkCodesCustom] = useState(false);
  const [bulkCodesCustomPrice, setBulkCodesCustomPrice] = useState("");
  const [bulkCodesCustomData, setBulkCodesCustomData] = useState("");
  const [bulkCodesCustomDuration, setBulkCodesCustomDuration] = useState("");
  const [isAddingBulkCodes, setIsAddingBulkCodes] = useState(false);
  const [bulkCodesProgress, setBulkCodesProgress] = useState({ done: 0, total: 0 });

  // Network forms
  const [newNetName, setNewNetName] = useState("");
  const [newNetProvinceId, setNewNetProvinceId] = useState("");
  const [newNetDistrict, setNewNetDistrict] = useState("");
  const [newNetLocation, setNewNetLocation] = useState("");
  const [newNetIP, setNewNetIP] = useState("");
  const [newNetImage, setNewNetImage] = useState("");
  const [editingNetId, setEditingNetId] = useState<string | null>(null);
  const [editNetName, setEditNetName] = useState("");
  const [editNetProvinceId, setEditNetProvinceId] = useState("");
  const [editNetDistrict, setEditNetDistrict] = useState("");
  const [editNetLocation, setEditNetLocation] = useState("");
  const [editNetIP, setEditNetIP] = useState("");
  const [editNetImage, setEditNetImage] = useState("");
  const [editNetManager, setEditNetManager] = useState("");

  // Tier forms
  const [newTierPrice, setNewTierPrice] = useState("");
  const [newTierData, setNewTierData] = useState("");
  const [newTierDuration, setNewTierDuration] = useState("");
  const [newTierIcon, setNewTierIcon] = useState("");
  const [editingTier, setEditingTier] = useState<string | null>(null);
  const [editTierPrice, setEditTierPrice] = useState("");
  const [editTierData, setEditTierData] = useState("");
  const [editTierDuration, setEditTierDuration] = useState("");
  const [editTierIcon, setEditTierIcon] = useState("");

  // Starlink forms
  const [newStarName, setNewStarName] = useState("");
  const [newStarDesc, setNewStarDesc] = useState("");
  const [newStarPrice, setNewStarPrice] = useState("");
  const [newStarQty, setNewStarQty] = useState("");
  const [newStarImage, setNewStarImage] = useState("");
  const [newStarDownload, setNewStarDownload] = useState("");
  const [newStarUpload, setNewStarUpload] = useState("");
  const [newStarLatency, setNewStarLatency] = useState("");
  const [newStarCoverage, setNewStarCoverage] = useState("");
  const [editingStar, setEditingStar] = useState<string | null>(null);

  // Bank forms
  const [newBankName, setNewBankName] = useState("");
  const [newBankAccount, setNewBankAccount] = useState("");
  const [newBankNumber, setNewBankNumber] = useState("");

  // SIM forms
  const [newSimName, setNewSimName] = useState("");
  const [newSimPrice, setNewSimPrice] = useState("");
  const [newSimDesc, setNewSimDesc] = useState("");
  const [newSimImage, setNewSimImage] = useState("");

  // Ad forms
  const [newAdTitle, setNewAdTitle] = useState("");
  const [newAdDesc, setNewAdDesc] = useState("");
  const [newAdImage, setNewAdImage] = useState("");

  // Home Banner forms
  const [newBannerTitle, setNewBannerTitle] = useState("");
  const [newBannerDesc, setNewBannerDesc] = useState("");
  const [newBannerImage, setNewBannerImage] = useState("");
  const [newBannerLink, setNewBannerLink] = useState("");
  const [newBannerOrder, setNewBannerOrder] = useState("0");
  const [allHomeBanners, setAllHomeBanners] = useState<Record<string, { id: string; title: string; description: string; imageUrl: string; linkUrl?: string; isActive: boolean; order: number; createdAt: number }>>({});

  // Gift/redeem code forms
  const [redeemCodeAmount, setRedeemCodeAmount] = useState("");
  const [redeemCodeCount, setRedeemCodeCount] = useState("1");
  const [lastGeneratedCodes, setLastGeneratedCodes] = useState<{ code: string; amount: number }[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [sharedCodeAmount, setSharedCodeAmount] = useState("");
  const [sharedCodeMaxUses, setSharedCodeMaxUses] = useState("");
  const [sharedCodeDesc, setSharedCodeDesc] = useState("");

  // Subscription forms
  const [newPlanName, setNewPlanName] = useState("");
  const [newPlanPrice, setNewPlanPrice] = useState("");
  const [newPlanDesc, setNewPlanDesc] = useState("");
  const [newPlanDuration, setNewPlanDuration] = useState("");

  // Notification forms
  const [bulkTitle, setBulkTitle] = useState("");
  const [bulkMessage, setBulkMessage] = useState("");
  const [isSendingBulk, setIsSendingBulk] = useState(false);

  // App content
  const [appContent, setAppContent] = useState<Record<string, string>>({});

  // Balance management forms
  const [balanceAction, setBalanceAction] = useState<"credit" | "debit">("credit");
  const [balanceUserId, setBalanceUserId] = useState("");
  const [balanceAmount, setBalanceAmount] = useState("");
  const [balanceDescription, setBalanceDescription] = useState("");
  const [balanceSearch, setBalanceSearch] = useState("");
  const [isProcessingBalance, setIsProcessingBalance] = useState(false);

  // Network submissions forms
  const [allNetworkSubmissions, setAllNetworkSubmissions] = useState<Record<string, NetworkSubmission>>({});
  const [rejectionReason, setRejectionReason] = useState("");
  const [rejectingSubmissionId, setRejectingSubmissionId] = useState<string | null>(null);

  // ─── Firebase listeners ────────────────────────────────────
  useEffect(() => {
    const unsubs: (() => void)[] = [];
    const paths: { path: string; setter: React.Dispatch<React.SetStateAction<Record<string, never>>> }[] = [
      { path: "users", setter: setAllUsers as React.Dispatch<React.SetStateAction<Record<string, never>>> },
      { path: "cards", setter: setAllCards as React.Dispatch<React.SetStateAction<Record<string, never>>> },
      { path: "orders", setter: setAllOrders as React.Dispatch<React.SetStateAction<Record<string, never>>> },
      { path: "bankDetails", setter: setAllBanks as React.Dispatch<React.SetStateAction<Record<string, never>>> },
      { path: "advertisements", setter: setAllAds as React.Dispatch<React.SetStateAction<Record<string, never>>> },
      { path: "simCards", setter: setAllSims as React.Dispatch<React.SetStateAction<Record<string, never>>> },
      { path: "depositRequests", setter: setAllDeposits as React.Dispatch<React.SetStateAction<Record<string, never>>> },
      { path: "redeemCodes", setter: setAllRedeemCodes as React.Dispatch<React.SetStateAction<Record<string, never>>> },
    ];
    paths.forEach(({ path, setter }) => {
      const unsub = onValue(ref(db, path), (snap) => setter(snap.val() || {}));
      unsubs.push(unsub);
    });

    const netUnsub = onValue(ref(db, "networks"), async (snap) => {
      const data = snap.val();
      if (!data) {
        for (const n of DEFAULT_NETWORKS) {
          await set(ref(db, `networks/${n.id}`), { ...n, ownerId: null, ownerName: null, ownerPhone: null, location: null, createdAt: Date.now() });
        }
      } else {
        setFbNetworks(data);
      }
    });
    unsubs.push(netUnsub);

    const tierUnsub = onValue(ref(db, "tiers"), async (snap) => {
      const data = snap.val();
      if (!data) {
        for (const t of DEFAULT_TIERS) {
          await set(ref(db, `tiers/${t.tier}`), { ...t, id: t.tier, createdAt: Date.now() });
        }
      } else {
        setFbTiers(data);
      }
    });
    unsubs.push(tierUnsub);

    const settingsUnsub = onValue(ref(db, "settings"), (snap) => {
      const data = snap.val();
      if (data) {
        if (data.adminWhatsApp) setAdminWhatsApp(data.adminWhatsApp);
        if (data.maxBalance !== undefined) setMaxBalance(data.maxBalance);
        if (data.maintenanceMode) setMaintenanceMode(data.maintenanceMode);
        if (data.appDownloadUrl) setAppDownloadUrl(data.appDownloadUrl);
        if (data.latestAppVersion) setLatestAppVersion(data.latestAppVersion);
        if (data.updateMessage) setUpdateMessage(data.updateMessage);
      }
    });
    unsubs.push(settingsUnsub);

    const plansUnsub = onValue(ref(db, "subscriptionPlans"), (snap) => setSubscriptionPlans(snap.val() || {}));
    unsubs.push(plansUnsub);
    const subsUnsub = onValue(ref(db, "userSubscriptions"), (snap) => setUserSubscriptions(snap.val() || {}));
    unsubs.push(subsUnsub);
    const bulkUnsub = onValue(ref(db, "bulkNotifications"), (snap) => setAllBulkNotifications(snap.val() || {}));
    unsubs.push(bulkUnsub);
    const starUnsub = onValue(ref(db, "starlinkProducts"), (snap) => setAllStarlinkProducts(snap.val() || {}));
    unsubs.push(starUnsub);
    const starOrdUnsub = onValue(ref(db, "starlinkOrders"), (snap) => setAllStarlinkOrders(snap.val() || {}));
    unsubs.push(starOrdUnsub);
    const commSetUnsub = onValue(ref(db, "commissionSettings"), (snap) => setAllCommissionSettings(snap.val() || {}));
    unsubs.push(commSetUnsub);
    const commEntryUnsub = onValue(ref(db, "commissionEntries"), (snap) => setAllCommissionEntries(snap.val() || {}));
    unsubs.push(commEntryUnsub);
    const payoutUnsub = onValue(ref(db, "monthlyPayouts"), (snap) => setAllMonthlyPayouts(snap.val() || {}));
    unsubs.push(payoutUnsub);
    const sharedCodesUnsub = onValue(ref(db, "sharedRedeemCodes"), (snap) => setAllSharedRedeemCodes(snap.val() || {}));
    unsubs.push(sharedCodesUnsub);
    const hiddenUnsub = onValue(ref(db, "settings/hiddenSections"), (snap) => setHiddenSections(snap.val() || {}));
    unsubs.push(hiddenUnsub);

    const creditUnsub = onValue(ref(db, "credit"), (snap) => {
      const data = snap.val() || {};
      const balances: Record<string, number> = {};
      const histories: Record<string, { type: string; amount: number; description: string; date: number }[]> = {};
      Object.entries(data).forEach(([uid, val]: [string, unknown]) => {
        const creditData = val as Record<string, unknown>;
        balances[uid] = (creditData.amount as number) || 0;
        if (creditData.history) {
          histories[uid] = Object.values(creditData.history) as { type: string; amount: number; description: string; date: number }[];
        }
      });
      setUserBalances(balances);
      setUserHistories(histories);
    });
    unsubs.push(creditUnsub);

    const contentUnsub = onValue(ref(db, "appContent"), (snap) => setAppContent(snap.val() || {}));
    unsubs.push(contentUnsub);

    const homeBannersUnsub = onValue(ref(db, "homeBanners"), (snap) => setAllHomeBanners(snap.val() || {}));
    unsubs.push(homeBannersUnsub);

    const netSubUnsub = onValue(ref(db, "networkSubmissions"), (snap) => setAllNetworkSubmissions(snap.val() || {}));
    unsubs.push(netSubUnsub);

    const saleLocUnsub = onValue(ref(db, "cardSaleLocations"), (snap) => setSaleLocations(snap.val() || {}));
    unsubs.push(saleLocUnsub);

    return () => unsubs.forEach(u => u());
  }, []);

  // ─── Derived lists ─────────────────────────────────────────
  const usersList = Object.entries(allUsers).map(([id, val]) => ({ id, ...val }));
  const cardsList = Object.entries(allCards).map(([id, val]) => ({ id, ...val }));
  const banksList = Object.entries(allBanks).map(([id, val]) => ({ id, ...val }));
  const adsList = Object.entries(allAds).map(([id, val]) => ({ id, ...val }));
  const simsList = Object.entries(allSims).map(([id, val]) => ({ id, ...val }));
  const depositsList = Object.entries(allDeposits).map(([id, val]) => ({ id, ...val })).sort((a: DepositRequest, b: DepositRequest) => (b.createdAt || 0) - (a.createdAt || 0));
  const pendingDeposits = depositsList.filter(d => d.status === "pending");
  const redeemCodesList = Object.entries(allRedeemCodes).map(([id, val]) => ({ id, ...val })).sort((a: RedeemCode, b: RedeemCode) => (b.createdAt || 0) - (a.createdAt || 0));
  const sharedCodesList = Object.entries(allSharedRedeemCodes).map(([id, val]) => ({ id, ...val }));
  const plansList = Object.entries(subscriptionPlans).map(([id, val]) => ({ id, ...val }));
  const subsList = Object.entries(userSubscriptions).map(([id, val]) => ({ id, ...val }));
  const bulkNotifList = Object.entries(allBulkNotifications).map(([id, val]) => ({ id, ...val })).sort((a: BulkNotification, b: BulkNotification) => (b.sentAt || 0) - (a.sentAt || 0));
  const starProductsList = Object.entries(allStarlinkProducts).map(([id, val]) => ({ id, ...val }));
  const starOrdersList = Object.entries(allStarlinkOrders).map(([id, val]) => ({ id, ...val })).sort((a: StarlinkOrder, b: StarlinkOrder) => (b.createdAt || 0) - (a.createdAt || 0));
  const commSettingsList = Object.entries(allCommissionSettings).map(([id, val]) => ({ id, ...val }));
  const commEntriesList = Object.entries(allCommissionEntries).map(([id, val]) => ({ id, ...val })).sort((a: CommissionEntry, b: CommissionEntry) => (b.soldAt || 0) - (a.soldAt || 0));
  const payoutList = Object.entries(allMonthlyPayouts).map(([id, val]) => ({ id, ...val }));

  const networkSubmissionsList = Object.entries(allNetworkSubmissions).map(([id, val]) => ({ id, ...val })).sort((a: NetworkSubmission, b: NetworkSubmission) => (b.createdAt || 0) - (a.createdAt || 0));
  const pendingNetworkSubmissions = networkSubmissionsList.filter(s => s.status === "pending");
  const approvedNetworkSubmissions = networkSubmissionsList.filter(s => s.status === "approved");
  const rejectedNetworkSubmissions = networkSubmissionsList.filter(s => s.status === "rejected");

  const networksList = Object.keys(fbNetworks).length > 0
    ? Object.entries(fbNetworks).map(([id, val]) => ({ id, ...val }))
    : DEFAULT_NETWORKS.map(n => ({ ...n, ownerId: null, ownerName: null, createdAt: 0 }));

  const tiersList = Object.keys(fbTiers).length > 0
    ? Object.entries(fbTiers).map(([id, val]) => ({ id, ...val }))
    : DEFAULT_TIERS.map(t => ({ ...t, id: t.tier, createdAt: 0 }));

  const filteredUsers = userSearch
    ? usersList.filter(u => (u.displayName || "").includes(userSearch) || (u.email || "").includes(userSearch) || (u.phone || "").includes(userSearch))
    : usersList;

  // Card filters
  const filteredCards = cardsList.filter(c => {
    if (cardFilterNetwork !== "all" && c.network !== cardFilterNetwork) return false;
    if (cardFilterTier !== "all" && c.tier !== cardFilterTier) return false;
    if (cardFilterStatus === "available" && c.isUsed) return false;
    if (cardFilterStatus === "sold" && !c.isUsed) return false;
    return true;
  });

  const soldCards = cardsList.filter(c => c.isUsed);
  const totalRevenue = soldCards.reduce((s, c) => s + (c.price || 0), 0);

  // ─── Actions ───────────────────────────────────────────────
  const approveDeposit = async (depId: string, dep: DepositRequest) => {
    try {
      const amountRef = ref(db, `credit/${dep.userId}/amount`);
      let actualAmount = dep.amount;
      const result = await runTransaction(amountRef, (cur) => {
        const bal = (cur || 0) as number;
        let newBal = bal + dep.amount;
        if (maxBalance > 0 && newBal > maxBalance) {
          actualAmount = Math.max(maxBalance - bal, 0);
          if (actualAmount <= 0) return bal;
          newBal = maxBalance;
        }
        return newBal;
      });
      if (!result.committed || actualAmount <= 0) {
        toast.error(`رصيد المستخدم وصل للسقف (${maxBalance} ر.ي)`);
        return;
      }
      await update(ref(db, `credit/${dep.userId}`), { updatedAt: Date.now() });
      const histRef = push(ref(db, `credit/${dep.userId}/history`));
      await set(histRef, { type: "deposit", amount: actualAmount, description: `إيداع - ${dep.bankName || "تحويل"}`, date: Date.now() });
      await update(ref(db, `depositRequests/${depId}`), { status: "approved", reviewedAt: Date.now(), reviewedBy: auth.currentUser?.uid });
      const notifRef = push(ref(db, `notifications/${dep.userId}`));
      await set(notifRef, { type: "deposit_approved", title: "تم قبول الإيداع", message: `تم شحن رصيدك بمبلغ ${actualAmount} ر.ي`, isRead: false, createdAt: Date.now() });
      toast.success(`تم قبول الإيداع وإضافة ${actualAmount} ر.ي`);
    } catch { toast.error("حدث خطأ أثناء قبول الإيداع"); }
  };

  const rejectDeposit = async (depId: string, dep: DepositRequest, reason?: string) => {
    try {
      await update(ref(db, `depositRequests/${depId}`), { status: "rejected", rejectionReason: reason || "مرفوض", reviewedAt: Date.now(), reviewedBy: auth.currentUser?.uid });
      const notifRef = push(ref(db, `notifications/${dep.userId}`));
      await set(notifRef, { type: "deposit_rejected", title: "تم رفض الإيداع", message: `تم رفض طلب إيداعك بمبلغ ${dep.amount} ر.ي${reason ? ` - السبب: ${reason}` : ""}`, isRead: false, createdAt: Date.now() });
      toast.success("تم رفض الإيداع");
    } catch { toast.error("حدث خطأ"); }
  };

  const addSingleCard = async () => {
    if (!newCardCode || !newCardPrice || !newCardData || !newCardDuration || !newCardNetwork) {
      toast.error("يرجى ملء جميع الحقول"); return;
    }
    try {
      const cardRef = push(ref(db, "cards"));
      await set(cardRef, { code: newCardCode, price: Number(newCardPrice), data: newCardData, duration: Number(newCardDuration), isUsed: false, usedBy: null, usedAt: null, tier: newCardTier, network: newCardNetwork, createdAt: Date.now() });
      toast.success("تم إضافة الكرت");
      setNewCardCode(""); setNewCardPrice(""); setNewCardData(""); setNewCardDuration("");
    } catch { toast.error("حدث خطأ"); }
  };

  const addBulkCards = async () => {
    const count = Number(bulkCardCount);
    if (!count || count < 1 || count > 500) { toast.error("عدد الكروت بين 1 و 500"); return; }
    if (!bulkCardNetwork || !bulkCardTier) { toast.error("اختر الشبكة والفئة"); return; }
    const tierInfo = tiersList.find(t => t.tier === bulkCardTier);
    if (!tierInfo) { toast.error("فئة غير صالحة"); return; }

    setIsAddingBulk(true);
    let added = 0;
    try {
      for (let i = 0; i < count; i++) {
        const cardRef = push(ref(db, "cards"));
        const pushId = cardRef.key!.substring(0, 6).toUpperCase();
        const code = `AP-${pushId}-${String(i + 1).padStart(3, "0")}`;
        await set(cardRef, {
          code, price: tierInfo.price, data: tierInfo.data, duration: tierInfo.duration,
          isUsed: false, usedBy: null, usedAt: null, tier: bulkCardTier, network: bulkCardNetwork, createdAt: Date.now(),
        });
        added++;
      }
      toast.success(`تم إضافة ${added} كرت بنجاح`);
    } catch { toast.error("حدث خطأ أثناء الإضافة"); }
    setIsAddingBulk(false);
  };

  const addBulkCodesByPasting = async () => {
    const codes = bulkCodesText.split("\n").map(c => c.trim()).filter(c => c.length > 0);
    if (codes.length === 0) { toast.error("أدخل أكواد الكروت"); return; }
    if (!bulkCodesNetwork) { toast.error("اختر الشبكة"); return; }

    let price: number, data: string, duration: number, tier: string;

    if (bulkCodesCustom) {
      if (!bulkCodesCustomPrice || !bulkCodesCustomData || !bulkCodesCustomDuration) {
        toast.error("يرجى ملء حقول الفئة المخصصة"); return;
      }
      price = Number(bulkCodesCustomPrice);
      data = bulkCodesCustomData;
      duration = Number(bulkCodesCustomDuration);
      tier = `${price}-custom`;
    } else {
      if (!bulkCodesTier) { toast.error("اختر الفئة"); return; }
      const tierInfo = tiersList.find(t => t.tier === bulkCodesTier);
      if (!tierInfo) { toast.error("فئة غير صالحة"); return; }
      price = tierInfo.price;
      data = tierInfo.data;
      duration = tierInfo.duration;
      tier = bulkCodesTier;
    }

    setIsAddingBulkCodes(true);
    setBulkCodesProgress({ done: 0, total: codes.length });
    let added = 0;
    try {
      for (let i = 0; i < codes.length; i++) {
        const cardRef = push(ref(db, "cards"));
        await set(cardRef, {
          code: codes[i], price, data, duration,
          isUsed: false, usedBy: null, usedAt: null, tier, network: bulkCodesNetwork, createdAt: Date.now(),
        });
        added++;
        setBulkCodesProgress({ done: added, total: codes.length });
      }
      toast.success(`تم إضافة ${added} كرت بنجاح`);
      setBulkCodesText("");
    } catch { toast.error("حدث خطأ أثناء الإضافة"); }
    setIsAddingBulkCodes(false);
    setBulkCodesProgress({ done: 0, total: 0 });
  };

  const deleteCard = async (id: string) => {
    if (deleteConfirm === id) {
      try { await remove(ref(db, `cards/${id}`)); toast.success("تم حذف الكرت"); setDeleteConfirm(null); }
      catch { toast.error("حدث خطأ"); }
    } else {
      setDeleteConfirm(id);
      setTimeout(() => setDeleteConfirm(null), 3000);
    }
  };

  const addNetwork = async () => {
    if (!newNetName.trim()) { toast.error("أدخل اسم الشبكة"); return; }
    if (!/^[a-zA-Z0-9\s\-]+$/.test(newNetName.trim())) {
      toast.error("اسم الشبكة يجب أن يكون باللغة الإنجليزية فقط (حروف وأرقام)");
      return;
    }
    const id = newNetName.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") + "-net";
    if (networksList.find(n => n.id === id)) { toast.error("هذه الشبكة موجودة بالفعل"); return; }
    try {
      const provinceObj = PROVINCES.find(p => p.id === newNetProvinceId);
      await set(ref(db, `networks/${id}`), {
        name: newNetName.trim(), color: "#1B7A3D", bgColor: "#1B7A3D1A", emoji: "📶",
        ownerId: null, ownerName: null, ownerPhone: null,
        location: newNetDistrict || provinceObj?.name || null,
        provinceId: newNetProvinceId || null, provinceName: provinceObj?.name || null,
        district: newNetDistrict || null, exactLocation: newNetLocation || null,
        connectionIP: newNetIP || null, imageBase64: newNetImage || null, createdAt: Date.now(),
      });
      toast.success(`تم إضافة شبكة ${newNetName}`);
      setNewNetName(""); setNewNetProvinceId(""); setNewNetDistrict(""); setNewNetLocation(""); setNewNetIP(""); setNewNetImage("");
    } catch { toast.error("حدث خطأ"); }
  };

  const startEditNet = (net: NetworkItem & { id: string }) => {
    setEditingNetId(net.id);
    setEditNetName(net.name || "");
    setEditNetProvinceId(net.provinceId || "");
    setEditNetDistrict(net.district || "");
    setEditNetLocation(net.exactLocation || "");
    setEditNetIP(net.connectionIP || "");
    setEditNetImage(net.imageBase64 || "");
    setEditNetManager(net.ownerId || "");
  };

  const saveEditNet = async (netId: string) => {
    if (!editNetName.trim()) { toast.error("اسم الشبكة مطلوب"); return; }
    if (!/^[a-zA-Z0-9\s\-]+$/.test(editNetName.trim())) {
      toast.error("اسم الشبكة يجب أن يكون باللغة الإنجليزية فقط (حروف وأرقام)");
      return;
    }
    try {
      const provinceObj = PROVINCES.find(p => p.id === editNetProvinceId);
      const updates: Record<string, unknown> = {
        name: editNetName.trim(), provinceId: editNetProvinceId || null, provinceName: provinceObj?.name || null,
        district: editNetDistrict || null, exactLocation: editNetLocation || null,
        connectionIP: editNetIP?.trim() || null, imageBase64: editNetImage || null,
        location: editNetDistrict || provinceObj?.name || null,
      };
      // Assign manager
      if (editNetManager) {
        const mgr = allUsers[editNetManager];
        updates.ownerId = editNetManager;
        updates.ownerName = mgr?.displayName || mgr?.email || "مستخدم";
        await update(ref(db, `users/${editNetManager}`), { role: "network_manager", managedNetwork: netId });
      } else {
        // Remove current manager if cleared
        const curNet = fbNetworks[netId];
        if (curNet?.ownerId) {
          await update(ref(db, `users/${curNet.ownerId}`), { role: "user", managedNetwork: "" });
        }
        updates.ownerId = null;
        updates.ownerName = null;
      }
      await update(ref(db, `networks/${netId}`), updates);
      toast.success("تم تحديث الشبكة");
      setEditingNetId(null);
    } catch { toast.error("حدث خطأ"); }
  };

  const deleteNetwork = async (id: string) => {
    if (deleteConfirm === `net-${id}`) {
      try { await remove(ref(db, `networks/${id}`)); toast.success("تم حذف الشبكة"); setDeleteConfirm(null); }
      catch { toast.error("حدث خطأ"); }
    } else {
      setDeleteConfirm(`net-${id}`);
      setTimeout(() => setDeleteConfirm(null), 3000);
    }
  };

  const addTier = async () => {
    if (!newTierPrice || !newTierData || !newTierDuration) { toast.error("يرجى ملء جميع الحقول"); return; }
    const tierKey = newTierPrice.trim();
    if (tiersList.find(t => t.tier === tierKey)) { toast.error("هذه الفئة موجودة بالفعل"); return; }
    try {
      await set(ref(db, `tiers/${tierKey}`), { tier: tierKey, price: Number(newTierPrice), data: newTierData.trim(), duration: Number(newTierDuration), icon: newTierIcon || "🟢", createdAt: Date.now() });
      toast.success(`تم إضافة فئة ${newTierPrice} ر.ي`);
      setNewTierPrice(""); setNewTierData(""); setNewTierDuration(""); setNewTierIcon("");
    } catch { toast.error("حدث خطأ"); }
  };

  const startEditTier = (tier: TierItem & { id: string }) => {
    setEditingTier(tier.id);
    setEditTierPrice(String(tier.price));
    setEditTierData(tier.data);
    setEditTierDuration(String(tier.duration));
    setEditTierIcon(tier.icon);
  };

  const saveEditTier = async (tierKey: string) => {
    if (!editTierPrice || !editTierData || !editTierDuration) { toast.error("يرجى ملء جميع الحقول"); return; }
    try {
      await update(ref(db, `tiers/${tierKey}`), { price: Number(editTierPrice), data: editTierData.trim(), duration: Number(editTierDuration), icon: editTierIcon || "🟢" });
      toast.success("تم تحديث الفئة");
      setEditingTier(null);
    } catch { toast.error("حدث خطأ"); }
  };

  const deleteTier = async (tier: string) => {
    if (deleteConfirm === `tier-${tier}`) {
      try { await remove(ref(db, `tiers/${tier}`)); toast.success("تم حذف الفئة"); setDeleteConfirm(null); }
      catch { toast.error("حدث خطأ"); }
    } else {
      setDeleteConfirm(`tier-${tier}`);
      setTimeout(() => setDeleteConfirm(null), 3000);
    }
  };

  const changeUserRole = async (uid: string, newRole: "user" | "admin" | "network_manager", managedNetwork?: string) => {
    try {
      const updates: Record<string, unknown> = { role: newRole };
      if (newRole === "network_manager" && managedNetwork) {
        updates.managedNetwork = managedNetwork;
      } else {
        updates.managedNetwork = "";
      }
      await update(ref(db, `users/${uid}`), updates);
      // If assigning as manager, update network owner
      if (newRole === "network_manager" && managedNetwork) {
        const u = allUsers[uid];
        await update(ref(db, `networks/${managedNetwork}`), { ownerId: uid, ownerName: u?.displayName || u?.email || "مستخدم" });
      }
      toast.success("تم تغيير الدور");
    } catch { toast.error("حدث خطأ"); }
  };

  const toggleUserActive = async (uid: string, isActive: boolean) => {
    try {
      await update(ref(db, `users/${uid}`), { isActive: !isActive });
      toast.success(isActive ? "تم تعطيل المستخدم" : "تم تفعيل المستخدم");
    } catch { toast.error("حدث خطأ"); }
  };

  // Network submission approve/reject
  const approveNetworkSubmission = async (subId: string, sub: NetworkSubmission) => {
    try {
      // Create new network from submission data
      const netId = sub.networkName.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") + "-net";
      if (networksList.find(n => n.id === netId)) {
        toast.error("شبكة بنفس الاسم موجودة بالفعل");
        return;
      }
      const provinceObj = PROVINCES.find(p => p.id === sub.provinceId);
      await set(ref(db, `networks/${netId}`), {
        name: sub.networkName.trim(),
        color: "#1B7A3D",
        bgColor: "#1B7A3D1A",
        emoji: "📶",
        ownerId: sub.userId,
        ownerName: sub.userName || "مستخدم",
        ownerPhone: sub.userPhone || null,
        location: sub.district || provinceObj?.name || null,
        provinceId: sub.provinceId || null,
        provinceName: provinceObj?.name || null,
        district: sub.district || null,
        exactLocation: sub.exactLocation || null,
        connectionIP: null,
        imageBase64: sub.imageBase64 || null,
        networkType: sub.networkType || null,
        coverage: sub.coverage || null,
        speed: sub.speed || null,
        createdAt: Date.now(),
      });

      // Update submission status
      await update(ref(db, `networkSubmissions/${subId}`), {
        status: "approved",
        reviewedAt: Date.now(),
        reviewedBy: auth.currentUser?.uid,
        assignedNetworkId: netId,
      });

      // Assign the submitter as network_manager
      await update(ref(db, `users/${sub.userId}`), {
        role: "network_manager",
        managedNetwork: netId,
      });

      // Send notification to the user
      const notifRef = push(ref(db, `notifications/${sub.userId}`));
      await set(notifRef, {
        type: "general",
        title: "تمت الموافقة على شبكتك! 🎉",
        message: `تم إنشاء شبكة "${sub.networkName}" وتعيينك كمدير لها`,
        isRead: false,
        createdAt: Date.now(),
      });

      toast.success(`تمت الموافقة على شبكة "${sub.networkName}" وإنشائها بنجاح`);
    } catch {
      toast.error("حدث خطأ أثناء الموافقة على الطلب");
    }
  };

  const rejectNetworkSubmission = async (subId: string, sub: NetworkSubmission, reason: string) => {
    try {
      await update(ref(db, `networkSubmissions/${subId}`), {
        status: "rejected",
        rejectionReason: reason || "مرفوض",
        reviewedAt: Date.now(),
        reviewedBy: auth.currentUser?.uid,
      });

      // Send notification to the user
      const notifRef = push(ref(db, `notifications/${sub.userId}`));
      await set(notifRef, {
        type: "general",
        title: "تم رفض طلب الشبكة",
        message: `تم رفض طلب تسجيل شبكة "${sub.networkName}"${reason ? ` - السبب: ${reason}` : ""}`,
        isRead: false,
        createdAt: Date.now(),
      });

      toast.success("تم رفض الطلب");
      setRejectingSubmissionId(null);
      setRejectionReason("");
    } catch {
      toast.error("حدث خطأ أثناء رفض الطلب");
    }
  };

  // Starlink CRUD
  const addStarlinkProduct = async () => {
    if (!newStarName || !newStarPrice) { toast.error("يرجى ملء الحقول المطلوبة"); return; }
    try {
      const prodRef = push(ref(db, "starlinkProducts"));
      await set(prodRef, {
        name: newStarName.trim(), description: newStarDesc.trim(), priceUSD: Number(newStarPrice),
        quantity: Number(newStarQty) || 0, imageBase64: newStarImage || "",
        specs: { downloadSpeed: newStarDownload || "", uploadSpeed: newStarUpload || "", latency: newStarLatency || "", coverage: newStarCoverage || "" },
        isActive: true, createdAt: Date.now(),
      });
      toast.success("تم إضافة المنتج");
      setNewStarName(""); setNewStarDesc(""); setNewStarPrice(""); setNewStarQty(""); setNewStarImage(""); setNewStarDownload(""); setNewStarUpload(""); setNewStarLatency(""); setNewStarCoverage("");
    } catch { toast.error("حدث خطأ"); }
  };

  const deleteStarlinkProduct = async (id: string) => {
    if (deleteConfirm === `star-${id}`) {
      try { await remove(ref(db, `starlinkProducts/${id}`)); toast.success("تم حذف المنتج"); setDeleteConfirm(null); }
      catch { toast.error("حدث خطأ"); }
    } else { setDeleteConfirm(`star-${id}`); setTimeout(() => setDeleteConfirm(null), 3000); }
  };

  const updateStarlinkOrderStatus = async (orderId: string, status: string) => {
    try {
      await update(ref(db, `starlinkOrders/${orderId}`), { status });
      toast.success("تم تحديث حالة الطلب");
    } catch { toast.error("حدث خطأ"); }
  };

  // Bank CRUD
  const addBank = async () => {
    if (!newBankName || !newBankAccount || !newBankNumber) { toast.error("يرجى ملء جميع الحقول"); return; }
    try {
      const bankRef = push(ref(db, "bankDetails"));
      await set(bankRef, { bankName: newBankName.trim(), accountName: newBankAccount.trim(), accountNumber: newBankNumber.trim(), isActive: true });
      toast.success("تم إضافة البنك");
      setNewBankName(""); setNewBankAccount(""); setNewBankNumber("");
    } catch { toast.error("حدث خطأ"); }
  };

  const deleteBank = async (id: string) => {
    if (deleteConfirm === `bank-${id}`) {
      try { await remove(ref(db, `bankDetails/${id}`)); toast.success("تم حذف البنك"); setDeleteConfirm(null); }
      catch { toast.error("حدث خطأ"); }
    } else { setDeleteConfirm(`bank-${id}`); setTimeout(() => setDeleteConfirm(null), 3000); }
  };

  // SIM CRUD
  const addSim = async () => {
    if (!newSimName || !newSimPrice) { toast.error("يرجى ملء الحقول المطلوبة"); return; }
    try {
      const simRef = push(ref(db, "simCards"));
      await set(simRef, { name: newSimName.trim(), price: Number(newSimPrice), description: newSimDesc.trim(), imageUrl: newSimImage || "", isAvailable: true });
      toast.success("تم إضافة شريحة SIM");
      setNewSimName(""); setNewSimPrice(""); setNewSimDesc(""); setNewSimImage("");
    } catch { toast.error("حدث خطأ"); }
  };

  const deleteSim = async (id: string) => {
    if (deleteConfirm === `sim-${id}`) {
      try { await remove(ref(db, `simCards/${id}`)); toast.success("تم حذف الشريحة"); setDeleteConfirm(null); }
      catch { toast.error("حدث خطأ"); }
    } else { setDeleteConfirm(`sim-${id}`); setTimeout(() => setDeleteConfirm(null), 3000); }
  };

  // Ad CRUD
  const addAd = async () => {
    if (!newAdTitle || !newAdImage) { toast.error("يرجى إدخال العنوان والصورة"); return; }
    try {
      const adRef = push(ref(db, "advertisements"));
      await set(adRef, { title: newAdTitle.trim(), description: newAdDesc.trim(), imageUrl: newAdImage, isActive: true });
      toast.success("تم إضافة الإعلان");
      setNewAdTitle(""); setNewAdDesc(""); setNewAdImage("");
    } catch { toast.error("حدث خطأ"); }
  };

  const deleteAd = async (id: string) => {
    if (deleteConfirm === `ad-${id}`) {
      try { await remove(ref(db, `advertisements/${id}`)); toast.success("تم حذف الإعلان"); setDeleteConfirm(null); }
      catch { toast.error("حدث خطأ"); }
    } else { setDeleteConfirm(`ad-${id}`); setTimeout(() => setDeleteConfirm(null), 3000); }
  };

  const toggleAd = async (id: string, isActive: boolean) => {
    try { await update(ref(db, `advertisements/${id}`), { isActive: !isActive }); toast.success("تم التحديث"); }
    catch { toast.error("حدث خطأ"); }
  };

  // Home Banner CRUD
  const addHomeBanner = async () => {
    if (!newBannerTitle || !newBannerImage) { toast.error("يرجى إدخال العنوان والصورة"); return; }
    try {
      const bannerRef = push(ref(db, "homeBanners"));
      await set(bannerRef, {
        title: newBannerTitle.trim(),
        description: newBannerDesc.trim(),
        imageUrl: newBannerImage,
        linkUrl: newBannerLink.trim() || null,
        isActive: true,
        order: Number(newBannerOrder) || 0,
        createdAt: Date.now(),
      });
      toast.success("تم إضافة البانر");
      setNewBannerTitle(""); setNewBannerDesc(""); setNewBannerImage(""); setNewBannerLink(""); setNewBannerOrder("0");
    } catch { toast.error("حدث خطأ"); }
  };

  const deleteHomeBanner = async (id: string) => {
    if (deleteConfirm === `hb-${id}`) {
      try { await remove(ref(db, `homeBanners/${id}`)); toast.success("تم حذف البانر"); setDeleteConfirm(null); }
      catch { toast.error("حدث خطأ"); }
    } else {
      setDeleteConfirm(`hb-${id}`);
      setTimeout(() => setDeleteConfirm(null), 3000);
    }
  };

  const toggleHomeBanner = async (id: string, isActive: boolean) => {
    try { await update(ref(db, `homeBanners/${id}`), { isActive: !isActive }); toast.success("تم التحديث"); }
    catch { toast.error("حدث خطأ"); }
  };

  // Redeem codes
  const generateRedeemCodes = async () => {
    const amount = Number(redeemCodeAmount);
    const count = Number(redeemCodeCount) || 1;
    if (!amount || amount < 1) { toast.error("أدخل مبلغ صحيح"); return; }
    if (count < 1 || count > 100) { toast.error("عدد الأكواد بين 1 و 100"); return; }
    setIsGenerating(true);
    try {
      const generated: { code: string; amount: number }[] = [];
      for (let i = 0; i < count; i++) {
        const code = generateCode();
        generated.push({ code, amount });
        const codeRef = push(ref(db, "redeemCodes"));
        await set(codeRef, { code, amount, isUsed: false, usedBy: null, usedByName: null, usedAt: null, createdAt: Date.now(), createdBy: auth.currentUser?.uid || null });
        await set(ref(db, `redeemCodeLookup/${code}`), { pushId: codeRef.key, amount, isUsed: false, createdAt: Date.now() });
      }
      setLastGeneratedCodes(generated);
      toast.success(`تم توليد ${count} كود`);
      setRedeemCodeAmount(""); setRedeemCodeCount("1");
    } catch { toast.error("حدث خطأ"); }
    setIsGenerating(false);
  };

  const deleteRedeemCode = async (id: string, code?: string) => {
    if (deleteConfirm === `rc-${id}`) {
      try {
        await remove(ref(db, `redeemCodes/${id}`));
        if (code) await remove(ref(db, `redeemCodeLookup/${code}`));
        toast.success("تم حذف الكود"); setDeleteConfirm(null);
      } catch { toast.error("حدث خطأ"); }
    } else { setDeleteConfirm(`rc-${id}`); setTimeout(() => setDeleteConfirm(null), 3000); }
  };

  // Shared codes
  const addSharedCode = async () => {
    const amount = Number(sharedCodeAmount);
    const maxUses = Number(sharedCodeMaxUses) || 1;
    if (!amount || amount < 1) { toast.error("أدخل مبلغ صحيح"); return; }
    if (maxUses < 1) { toast.error("أدخل عدد مرات الاستخدام"); return; }
    try {
      const code = generateCode();
      const codeRef = push(ref(db, "sharedRedeemCodes"));
      await set(codeRef, { code, amount, maxRedemptions: maxUses, currentRedemptions: 0, description: sharedCodeDesc.trim(), isActive: true, createdAt: Date.now(), createdBy: auth.currentUser?.uid || null, redeemedBy: {} });
      toast.success(`تم إنشاء كود هدية: ${code}`);
      setSharedCodeAmount(""); setSharedCodeMaxUses(""); setSharedCodeDesc("");
    } catch { toast.error("حدث خطأ"); }
  };

  const toggleSharedCode = async (id: string, isActive: boolean) => {
    try { await update(ref(db, `sharedRedeemCodes/${id}`), { isActive: !isActive }); toast.success("تم التحديث"); }
    catch { toast.error("حدث خطأ"); }
  };

  // Subscription plans
  const addPlan = async () => {
    if (!newPlanName || !newPlanPrice || !newPlanDuration) { toast.error("يرجى ملء جميع الحقول"); return; }
    try {
      const planRef = push(ref(db, "subscriptionPlans"));
      await set(planRef, { name: newPlanName.trim(), price: Number(newPlanPrice), description: newPlanDesc.trim(), durationDays: Number(newPlanDuration), isActive: true, createdAt: Date.now() });
      toast.success("تم إضافة الخطة");
      setNewPlanName(""); setNewPlanPrice(""); setNewPlanDesc(""); setNewPlanDuration("");
    } catch { toast.error("حدث خطأ"); }
  };

  const togglePlan = async (id: string, isActive: boolean) => {
    try { await update(ref(db, `subscriptionPlans/${id}`), { isActive: !isActive }); toast.success("تم التحديث"); }
    catch { toast.error("حدث خطأ"); }
  };

  // Bulk notifications
  const sendBulkNotification = async () => {
    if (!bulkTitle || !bulkMessage) { toast.error("يرجى إدخال العنوان والرسالة"); return; }
    setIsSendingBulk(true);
    try {
      const targetUsers = usersList.filter(u => u.isActive !== false);
      let sentCount = 0;
      for (const u of targetUsers) {
        const notifRef = push(ref(db, `notifications/${u.id}`));
        await set(notifRef, { type: "general", title: bulkTitle.trim(), message: bulkMessage.trim(), isRead: false, createdAt: Date.now() });
        sentCount++;
      }
      const bulkRef = push(ref(db, "bulkNotifications"));
      await set(bulkRef, { title: bulkTitle.trim(), message: bulkMessage.trim(), type: "general", targetCount: sentCount, sentAt: Date.now(), sentBy: auth.currentUser?.uid || null });
      toast.success(`تم إرسال الإشعار إلى ${sentCount} مستخدم`);
      setBulkTitle(""); setBulkMessage("");
    } catch { toast.error("حدث خطأ"); }
    setIsSendingBulk(false);
  };

  // Mark commission as paid
  const markCommissionPaid = async (entryId: string) => {
    try {
      await update(ref(db, `commissionEntries/${entryId}`), { isPaid: true, paidAt: Date.now() });
      toast.success("تم تحديد كمدفوع");
    } catch { toast.error("حدث خطأ"); }
  };

  // Save app content
  const saveAppContent = async (key: string, value: string) => {
    try {
      await update(ref(db, "appContent"), { [key]: value });
      toast.success("تم الحفظ");
    } catch { toast.error("حدث خطأ"); }
  };

  // Save settings
  const saveSettings = async (updates: Record<string, unknown>) => {
    try {
      await update(ref(db, "settings"), updates);
      toast.success("تم حفظ الإعدادات");
    } catch { toast.error("حدث خطأ"); }
  };

  // Image upload handler
  const handleImageUpload = (setter: (v: string) => void, maxSize = 128) => async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const base64 = await compressImageToBase64(file, maxSize, 0.6);
      setter(base64);
    } catch { toast.error("فشل رفع الصورة"); }
  };

  // Copy to clipboard
  const copyCode = async (code: string) => {
    try { await navigator.clipboard.writeText(code); toast.success("تم النسخ"); }
    catch { toast.error("فشل النسخ"); }
  };

  // ─── Balance management actions ─────────────────────────────
  const handleSendBalance = async () => {
    const amount = Number(balanceAmount);
    if (!balanceUserId) { toast.error("اختر المستخدم"); return; }
    if (!amount || amount <= 0) { toast.error("أدخل مبلغ صحيح"); return; }
    if (!balanceDescription.trim()) { toast.error("أدخل وصف العملية"); return; }
    setIsProcessingBalance(true);
    try {
      const amountRef = ref(db, `credit/${balanceUserId}/amount`);
      const result = await runTransaction(amountRef, (cur) => {
        const bal = (cur || 0) as number;
        let newBal = bal + amount;
        if (maxBalance > 0 && newBal > maxBalance) {
          newBal = maxBalance;
        }
        return newBal;
      });
      if (!result.committed) { toast.error("فشلت العملية"); setIsProcessingBalance(false); return; }
      await update(ref(db, `credit/${balanceUserId}`), { updatedAt: Date.now() });
      const histRef = push(ref(db, `credit/${balanceUserId}/history`));
      await set(histRef, { type: "admin_credit", amount, description: balanceDescription.trim(), date: Date.now() });
      // Send notification
      const notifRef = push(ref(db, `notifications/${balanceUserId}`));
      await set(notifRef, { type: "general", title: "إضافة رصيد", message: `تم إضافة ${fmt(amount)} ر.ي لحسابك - ${balanceDescription.trim()}`, isRead: false, createdAt: Date.now() });
      toast.success(`تم إضافة ${fmt(amount)} ر.ي بنجاح`);
      setBalanceAmount(""); setBalanceDescription(""); setBalanceUserId("");
    } catch { toast.error("حدث خطأ أثناء إضافة الرصيد"); }
    setIsProcessingBalance(false);
  };

  const handleWithdrawBalance = async () => {
    const amount = Number(balanceAmount);
    if (!balanceUserId) { toast.error("اختر المستخدم"); return; }
    if (!amount || amount <= 0) { toast.error("أدخل مبلغ صحيح"); return; }
    if (!balanceDescription.trim()) { toast.error("أدخل سبب السحب"); return; }
    const currentBalance = userBalances[balanceUserId] || 0;
    if (amount > currentBalance) { toast.error(`رصيد المستخدم غير كافي (${fmt(currentBalance)} ر.ي فقط)`); return; }
    setIsProcessingBalance(true);
    try {
      const amountRef = ref(db, `credit/${balanceUserId}/amount`);
      const result = await runTransaction(amountRef, (cur) => {
        const bal = (cur || 0) as number;
        if (bal < amount) return bal; // abort if insufficient
        return bal - amount;
      });
      if (!result.committed) { toast.error("رصيد المستخدم غير كافي"); setIsProcessingBalance(false); return; }
      await update(ref(db, `credit/${balanceUserId}`), { updatedAt: Date.now() });
      const histRef = push(ref(db, `credit/${balanceUserId}/history`));
      await set(histRef, { type: "admin_debit", amount: -amount, description: balanceDescription.trim(), date: Date.now() });
      // Send notification
      const notifRef = push(ref(db, `notifications/${balanceUserId}`));
      await set(notifRef, { type: "general", title: "سحب رصيد", message: `تم سحب ${fmt(amount)} ر.ي من حسابك - ${balanceDescription.trim()}`, isRead: false, createdAt: Date.now() });
      toast.success(`تم سحب ${fmt(amount)} ر.ي بنجاح`);
      setBalanceAmount(""); setBalanceDescription(""); setBalanceUserId("");
    } catch { toast.error("حدث خطأ أثناء سحب الرصيد"); }
    setIsProcessingBalance(false);
  };

  // ─── Sale Location actions ─────────────────────────────────
  const addSaleLocation = async () => {
    if (!newLocName || !newLocNetworkId || !newLocProvinceId) {
      toast.error("يرجى ملء اسم المكان والشبكة والمحافظة"); return;
    }
    try {
      const provinceObj = PROVINCES.find(p => p.id === newLocProvinceId);
      const netInfo = networksList.find(n => n.id === newLocNetworkId);
      const locRef = push(ref(db, "cardSaleLocations"));
      await set(locRef, {
        networkId: newLocNetworkId,
        networkName: netInfo?.name || "",
        name: newLocName.trim(),
        provinceId: newLocProvinceId,
        provinceName: provinceObj?.name || "",
        district: newLocDistrict || "",
        exactLocation: newLocExactLocation.trim(),
        phone: newLocPhone.trim() || null,
        isActive: true,
        createdAt: Date.now(),
      });
      toast.success("تم إضافة مكان البيع");
      setNewLocName(""); setNewLocNetworkId(""); setNewLocProvinceId(""); setNewLocDistrict(""); setNewLocExactLocation(""); setNewLocPhone("");
    } catch { toast.error("حدث خطأ"); }
  };

  const deleteSaleLocation = async (id: string) => {
    if (deleteConfirm === `sl-${id}`) {
      try { await remove(ref(db, `cardSaleLocations/${id}`)); toast.success("تم حذف مكان البيع"); setDeleteConfirm(null); }
      catch { toast.error("حدث خطأ"); }
    } else {
      setDeleteConfirm(`sl-${id}`);
      setTimeout(() => setDeleteConfirm(null), 3000);
    }
  };

  const toggleSaleLocation = async (id: string, currentActive: boolean) => {
    try {
      await update(ref(db, `cardSaleLocations/${id}`), { isActive: !currentActive });
      toast.success(!currentActive ? "تم تفعيل مكان البيع" : "تم تعطيل مكان البيع");
    } catch { toast.error("حدث خطأ"); }
  };

  // ─── RENDER ────────────────────────────────────────────────
  return (
    <motion.div
      initial={{ opacity: 0, y: "100%" }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: "100%" }}
      transition={iOSSpring.gentle}
      className="fixed inset-0 z-50 bg-white overflow-hidden flex flex-col"
      dir="rtl"
    >
      {/* ─── Top Bar ─── */}
      <div className="flex-shrink-0 bg-white border-b border-gray-100 shadow-sm">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#1B7A3D] flex items-center justify-center">
              <ShieldCheck className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-black text-gray-900">لوحة التحكم</h1>
              <p className="text-[9px] text-[#1B7A3D] font-bold">الأدمن</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="text-gray-400 hover:text-gray-600 rounded-xl">
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* ─── Tab Bar ─── */}
        <div className="px-4 pb-2 flex gap-2 overflow-x-auto no-scrollbar">
          {ADMIN_TABS.map(tab => {
            const badgeCount = (() => {
              if (tab.id === "overview") return pendingDeposits.length + pendingNetworkSubmissions.length;
              if (tab.id === "networkRequests") return pendingNetworkSubmissions.length;
              if (tab.id === "orders") return pendingDeposits.length;
              return 0;
            })();
            return (
              <motion.button
                key={tab.id}
                whileTap={{ scale: 0.95 }}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  activeTab === tab.id
                    ? "bg-gradient-to-l from-[#1B7A3D] to-[#22A24D] text-white shadow-md"
                    : "bg-gray-50 text-gray-500 hover:bg-gray-100"
                }`}
              >
                <tab.icon className="w-3 h-3" />{tab.label}
                {badgeCount > 0 && (
                  <motion.span
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity, repeatType: "loop" }}
                    className="absolute -top-1.5 -left-1.5 min-w-[16px] h-4 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center px-1 shadow-sm"
                  >
                    {badgeCount > 99 ? "99+" : badgeCount}
                  </motion.span>
                )}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* ─── Content Area ─── */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-4 pb-8">
          <AnimatePresence mode="wait">

            {/* ═══ TAB 1: الإحصائيات (Enhanced) ═══ */}
            {activeTab === "overview" && (
              <motion.div key="overview" variants={sectionVariants} initial="initial" animate="animate" exit="exit" transition={iOSSpring.gentle} className="space-y-4">
                {/* ─── KPI Cards Row 1 ─── */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gradient-to-br from-[#1B7A3D] to-[#22A24D] rounded-2xl p-4 text-white shadow-lg shadow-[#1B7A3D]/20">
                    <Users className="w-5 h-5 opacity-60 mb-1" />
                    <p className="text-2xl font-black">{fmt(usersList.length)}</p>
                    <p className="text-[9px] opacity-70">إجمالي المستخدمين</p>
                    <p className="text-[8px] opacity-50 mt-0.5">نشط: {fmt(usersList.filter(u => u.isActive !== false).length)} • معطل: {fmt(usersList.filter(u => u.isActive === false).length)}</p>
                  </div>
                  <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl p-4 text-white shadow-lg shadow-orange-500/20">
                    <CreditCard className="w-5 h-5 opacity-60 mb-1" />
                    <p className="text-2xl font-black">{fmt(cardsList.length)}</p>
                    <p className="text-[9px] opacity-70">إجمالي الكروت</p>
                    <p className="text-[8px] opacity-50 mt-0.5">مباعة: {fmt(soldCards.length)} • متاحة: {fmt(cardsList.length - soldCards.length)}</p>
                  </div>
                  <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl p-4 text-white shadow-lg shadow-purple-500/20">
                    <Wallet className="w-5 h-5 opacity-60 mb-1" />
                    <p className="text-2xl font-black">{fmt(totalRevenue)}</p>
                    <p className="text-[9px] opacity-70">إجمالي الإيرادات (ر.ي)</p>
                  </div>
                  <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-4 text-white shadow-lg shadow-blue-500/20">
                    <Wifi className="w-5 h-5 opacity-60 mb-1" />
                    <p className="text-2xl font-black">{fmt(networksList.length)}</p>
                    <p className="text-[9px] opacity-70">الشبكات</p>
                  </div>
                </div>

                {/* ─── Pending Requests ─── */}
                {(pendingDeposits.length > 0 || pendingNetworkSubmissions.length > 0) && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-500" />
                      طلبات معلقة
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                      {pendingDeposits.length > 0 && (
                        <motion.button
                          whileTap={{ scale: 0.97 }}
                          onClick={() => setActiveTab("orders")}
                          className="bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl p-4 text-white shadow-lg text-right"
                        >
                          <Receipt className="w-5 h-5 opacity-60 mb-1" />
                          <p className="text-2xl font-black">{pendingDeposits.length}</p>
                          <p className="text-[9px] opacity-70">طلبات إيداع معلقة</p>
                          <p className="text-[8px] opacity-50 mt-0.5">اضغط للعرض</p>
                        </motion.button>
                      )}
                      {pendingNetworkSubmissions.length > 0 && (
                        <motion.button
                          whileTap={{ scale: 0.97 }}
                          onClick={() => setActiveTab("networkRequests")}
                          className="bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl p-4 text-white shadow-lg text-right"
                        >
                          <FileCheck className="w-5 h-5 opacity-60 mb-1" />
                          <p className="text-2xl font-black">{pendingNetworkSubmissions.length}</p>
                          <p className="text-[9px] opacity-70">طلبات شبكات معلقة</p>
                          <p className="text-[8px] opacity-50 mt-0.5">اضغط للعرض</p>
                        </motion.button>
                      )}
                    </div>
                  </div>
                )}

                {/* ─── Additional Stats ─── */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-white rounded-2xl p-3 border border-gray-100 shadow-sm text-center">
                    <Building2 className="w-4 h-4 text-blue-500 mx-auto mb-1" />
                    <p className="text-lg font-black text-gray-900">{fmt(banksList.length)}</p>
                    <p className="text-[8px] text-gray-400">حسابات بنكية</p>
                  </div>
                  <div className="bg-white rounded-2xl p-3 border border-gray-100 shadow-sm text-center">
                    <Gift className="w-4 h-4 text-purple-500 mx-auto mb-1" />
                    <p className="text-lg font-black text-gray-900">{fmt(redeemCodesList.filter(c => !c.isUsed).length)}</p>
                    <p className="text-[8px] text-gray-400">أكواد نشطة</p>
                  </div>
                  <div className="bg-white rounded-2xl p-3 border border-gray-100 shadow-sm text-center">
                    <Satellite className="w-4 h-4 text-sky-500 mx-auto mb-1" />
                    <p className="text-lg font-black text-gray-900">{fmt(starOrdersList.filter(o => o.status === "pending").length)}</p>
                    <p className="text-[8px] text-gray-400">طلبات Starlink</p>
                  </div>
                </div>

                {/* ─── Networks by Province ─── */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                  <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                    <Globe className="w-4 h-4 text-[#1B7A3D]" />
                    الشبكات حسب المحافظة
                  </h3>
                  <div className="space-y-2">
                    {PROVINCES.filter(p => networksList.some(n => n.provinceId === p.id)).map(province => {
                      const provNets = networksList.filter(n => n.provinceId === province.id);
                      const provCards = cardsList.filter(c => provNets.some(n => n.id === c.network));
                      const provSold = provCards.filter(c => c.isUsed);
                      return (
                        <div key={province.id} className="flex items-center justify-between p-2 rounded-xl bg-gray-50">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-[#E8F5E9] flex items-center justify-center text-xs">🏛️</div>
                            <div>
                              <p className="text-xs font-bold text-gray-900">{province.name}</p>
                              <p className="text-[9px] text-gray-400">{provNets.length} شبكة • {provCards.length - provSold.length} كرت متاح</p>
                            </div>
                          </div>
                          <span className="text-xs font-black text-[#1B7A3D]">{fmt(provSold.reduce((s, c) => s + (c.price || 0), 0))} ر.ي</span>
                        </div>
                      );
                    })}
                    {networksList.filter(n => !n.provinceId).length > 0 && (
                      <div className="flex items-center justify-between p-2 rounded-xl bg-gray-50">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center text-xs">🌐</div>
                          <div>
                            <p className="text-xs font-bold text-gray-900">بدون محافظة</p>
                            <p className="text-[9px] text-gray-400">{networksList.filter(n => !n.provinceId).length} شبكة</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* ─── Revenue by Network (horizontal bar chart) ─── */}
                <div className="bg-white rounded-2xl border border-gray-100 p-4">
                  <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2 mb-3">
                    <BarChart3 className="w-4 h-4 text-[#1B7A3D]" />
                    الإيرادات حسب الشبكة
                  </h3>
                  <div className="space-y-3">
                    {(() => {
                      const netRevenue: Record<string, number> = {};
                      soldCards.forEach(c => { netRevenue[c.network] = (netRevenue[c.network] || 0) + (c.price || 0); });
                      const maxNetRev = Math.max(...Object.values(netRevenue), 1);
                      return networksList.map(net => {
                        const rev = netRevenue[net.id] || 0;
                        const pct = Math.round((rev / maxNetRev) * 100);
                        return (
                          <div key={net.id}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-bold text-gray-700">{net.emoji} {net.name}</span>
                              <span className="text-xs font-black text-gray-900">{fmt(rev)} ر.ي</span>
                            </div>
                            <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${pct}%` }}
                                transition={{ duration: 0.8, ease: "easeOut" }}
                                className="h-full rounded-full"
                                style={{ backgroundColor: net.color || "#1B7A3D" }}
                              />
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>

                {/* ─── Card Sales by Tier (progress bars) ─── */}
                <div className="bg-white rounded-2xl border border-gray-100 p-4">
                  <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2 mb-3">
                    <CreditCard className="w-4 h-4 text-[#1B7A3D]" />
                    مبيعات الكروت حسب الفئة
                  </h3>
                  <div className="space-y-2.5">
                    {(() => {
                      const tierSales: Record<string, { sold: number; total: number; revenue: number }> = {};
                      cardsList.forEach(c => {
                        if (!tierSales[c.tier]) tierSales[c.tier] = { sold: 0, total: 0, revenue: 0 };
                        tierSales[c.tier].total++;
                        if (c.isUsed) { tierSales[c.tier].sold++; tierSales[c.tier].revenue += (c.price || 0); }
                      });
                      return tiersList.map(t => {
                        const data = tierSales[t.tier] || { sold: 0, total: 0, revenue: 0 };
                        const pct = data.total > 0 ? Math.round((data.sold / data.total) * 100) : 0;
                        return (
                          <div key={t.tier}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-bold text-gray-700">{t.icon} فئة {t.tier} ({t.data})</span>
                              <span className="text-[10px] text-gray-400">{data.sold}/{data.total} مباع ({pct}%)</span>
                            </div>
                            <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${pct}%` }}
                                transition={{ duration: 0.8, ease: "easeOut" }}
                                className="h-full bg-gradient-to-l from-[#1B7A3D] to-[#22A24D] rounded-full"
                              />
                            </div>
                            <p className="text-[9px] text-gray-400 mt-0.5">إيرادات: {fmt(data.revenue)} ر.ي</p>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>

                {/* ─── Recent 7 Days Revenue Trend ─── */}
                <div className="bg-white rounded-2xl border border-gray-100 p-4">
                  <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2 mb-3">
                    <TrendingUp className="w-4 h-4 text-[#1B7A3D]" />
                    إيرادات آخر 7 أيام
                  </h3>
                  <div className="flex items-end gap-2 h-32">
                    {(() => {
                      const days: { label: string; revenue: number }[] = [];
                      for (let i = 6; i >= 0; i--) {
                        const d = new Date();
                        d.setDate(d.getDate() - i);
                        const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
                        const dayEnd = dayStart + 86400000;
                        const rev = soldCards.filter(c => c.usedAt && c.usedAt >= dayStart && c.usedAt < dayEnd).reduce((s, c) => s + (c.price || 0), 0);
                        days.push({ label: d.toLocaleDateString("ar-YE", { weekday: "short" }), revenue: rev });
                      }
                      const maxDayRev = Math.max(...days.map(d => d.revenue), 1);
                      return days.map((day, i) => {
                        const pct = Math.max(Math.round((day.revenue / maxDayRev) * 100), 4);
                        return (
                          <div key={i} className="flex-1 flex flex-col items-center gap-1">
                            <span className="text-[8px] font-bold text-gray-700">{fmt(day.revenue)}</span>
                            <motion.div
                              initial={{ height: 0 }}
                              animate={{ height: `${pct}%` }}
                              transition={{ duration: 0.6, delay: i * 0.05 }}
                              className="w-full bg-gradient-to-t from-[#1B7A3D] to-[#22A24D] rounded-t-lg min-h-[4px]"
                            />
                            <span className="text-[8px] text-gray-400">{day.label}</span>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>

                {/* ─── Deposit Status Breakdown ─── */}
                <div className="bg-white rounded-2xl border border-gray-100 p-4">
                  <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2 mb-3">
                    <Banknote className="w-4 h-4 text-[#1B7A3D]" />
                    حالة الإيداعات
                  </h3>
                  {(() => {
                    const approved = depositsList.filter(d => d.status === "approved");
                    const pending = depositsList.filter(d => d.status === "pending");
                    const rejected = depositsList.filter(d => d.status === "rejected");
                    const approvedAmt = approved.reduce((s, d) => s + (d.amount || 0), 0);
                    const pendingAmt = pending.reduce((s, d) => s + (d.amount || 0), 0);
                    const rejectedAmt = rejected.reduce((s, d) => s + (d.amount || 0), 0);
                    const total = approvedAmt + pendingAmt + rejectedAmt || 1;
                    return (
                      <div className="space-y-3">
                        <div className="flex h-4 rounded-full overflow-hidden bg-gray-100">
                          <motion.div initial={{ width: 0 }} animate={{ width: `${(approvedAmt / total) * 100}%` }} transition={{ duration: 0.6 }} className="bg-[#1B7A3D]" />
                          <motion.div initial={{ width: 0 }} animate={{ width: `${(pendingAmt / total) * 100}%` }} transition={{ duration: 0.6 }} className="bg-orange-400" />
                          <motion.div initial={{ width: 0 }} animate={{ width: `${(rejectedAmt / total) * 100}%` }} transition={{ duration: 0.6 }} className="bg-red-400" />
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div className="bg-[#E8F5E9] rounded-xl p-2.5 text-center">
                            <p className="text-sm font-black text-[#1B7A3D]">{fmt(approvedAmt)}</p>
                            <p className="text-[8px] text-gray-500">مقبول ({approved.length})</p>
                          </div>
                          <div className="bg-orange-50 rounded-xl p-2.5 text-center">
                            <p className="text-sm font-black text-orange-600">{fmt(pendingAmt)}</p>
                            <p className="text-[8px] text-gray-500">معلق ({pending.length})</p>
                          </div>
                          <div className="bg-red-50 rounded-xl p-2.5 text-center">
                            <p className="text-sm font-black text-red-600">{fmt(rejectedAmt)}</p>
                            <p className="text-[8px] text-gray-500">مرفوض ({rejected.length})</p>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* ─── Monthly Revenue Comparison ─── */}
                <div className="bg-white rounded-2xl border border-gray-100 p-4">
                  <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2 mb-3">
                    <TrendingUp className="w-4 h-4 text-[#1B7A3D]" />
                    مقارنة الإيرادات الشهرية
                  </h3>
                  {(() => {
                    const now = new Date();
                    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
                    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
                    const thisMonthRev = soldCards.filter(c => c.usedAt && c.usedAt >= thisMonthStart).reduce((s, c) => s + (c.price || 0), 0);
                    const lastMonthRev = soldCards.filter(c => c.usedAt && c.usedAt >= lastMonthStart && c.usedAt < thisMonthStart).reduce((s, c) => s + (c.price || 0), 0);
                    const maxMonth = Math.max(thisMonthRev, lastMonthRev, 1);
                    const change = lastMonthRev > 0 ? Math.round(((thisMonthRev - lastMonthRev) / lastMonthRev) * 100) : 0;
                    return (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-500">هذا الشهر</span>
                          <span className="text-sm font-black text-[#1B7A3D]">{fmt(thisMonthRev)} ر.ي</span>
                        </div>
                        <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                          <motion.div initial={{ width: 0 }} animate={{ width: `${(thisMonthRev / maxMonth) * 100}%` }} transition={{ duration: 0.6 }} className="h-full bg-[#1B7A3D] rounded-full" />
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-500">الشهر الماضي</span>
                          <span className="text-sm font-black text-gray-600">{fmt(lastMonthRev)} ر.ي</span>
                        </div>
                        <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                          <motion.div initial={{ width: 0 }} animate={{ width: `${(lastMonthRev / maxMonth) * 100}%` }} transition={{ duration: 0.6 }} className="h-full bg-gray-400 rounded-full" />
                        </div>
                        {change !== 0 && (
                          <p className={`text-xs font-bold text-center ${change > 0 ? "text-[#1B7A3D]" : "text-red-500"}`}>
                            {change > 0 ? "📈" : "📉"} {change > 0 ? "+" : ""}{change}% مقارنة بالشهر الماضي
                          </p>
                        )}
                      </div>
                    );
                  })()}
                </div>

                {/* ─── Top 5 Users by Balance ─── */}
                <div className="bg-white rounded-2xl border border-gray-100 p-4">
                  <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2 mb-3">
                    <Crown className="w-4 h-4 text-amber-500" />
                    أعلى 5 مستخدمين رصيداً
                  </h3>
                  <div className="space-y-2">
                    {Object.entries(userBalances)
                      .sort(([, a], [, b]) => b - a)
                      .slice(0, 5)
                      .map(([uid, balance], i) => {
                        const user = allUsers[uid];
                        return (
                          <div key={uid} className="flex items-center gap-2 p-2 rounded-xl bg-gray-50">
                            <span className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center text-[10px] font-black text-amber-600">{i + 1}</span>
                            <div className="w-7 h-7 rounded-full bg-[#1B7A3D] flex items-center justify-center text-white text-[10px] font-bold">{(user?.displayName || "م")[0]}</div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-gray-900 truncate">{user?.displayName || "مستخدم"}</p>
                            </div>
                            <span className="text-xs font-black text-[#1B7A3D]">{fmt(balance)} ر.ي</span>
                          </div>
                        );
                      })}
                  </div>
                </div>

                {/* ─── Additional KPIs ─── */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-white rounded-2xl border border-gray-100 p-3 text-center">
                    <Satellite className="w-4 h-4 text-blue-500 mx-auto mb-1" />
                    <p className="text-sm font-black text-gray-900">{fmt(starOrdersList.length)}</p>
                    <p className="text-[8px] text-gray-400">طلبات Starlink</p>
                    <p className="text-[8px] text-blue-500">{fmt(starOrdersList.reduce((s, o) => s + (o.priceUSD || 0), 0))}$</p>
                  </div>
                  <div className="bg-white rounded-2xl border border-gray-100 p-3 text-center">
                    <Crown className="w-4 h-4 text-amber-500 mx-auto mb-1" />
                    <p className="text-sm font-black text-gray-900">{fmt(subsList.filter(s => s.isActive).length)}</p>
                    <p className="text-[8px] text-gray-400">اشتراكات نشطة</p>
                  </div>
                  <div className="bg-white rounded-2xl border border-gray-100 p-3 text-center">
                    <Banknote className="w-4 h-4 text-green-500 mx-auto mb-1" />
                    <p className="text-sm font-black text-gray-900">{fmt(commEntriesList.reduce((s, e) => s + (e.commissionAmount || 0), 0))}</p>
                    <p className="text-[8px] text-gray-400">إجمالي العمولات</p>
                    <p className="text-[8px] text-red-400">غير مدفوع: {fmt(commEntriesList.filter(e => !e.isPaid).reduce((s, e) => s + (e.commissionAmount || 0), 0))}</p>
                  </div>
                </div>

                {/* ─── Average Balance ─── */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-white rounded-2xl border border-gray-100 p-3 text-center">
                    <p className="text-sm font-black text-gray-900">
                      {fmt(Object.values(userBalances).length > 0 ? Math.round(Object.values(userBalances).reduce((a, b) => a + b, 0) / Object.values(userBalances).length) : 0)}
                    </p>
                    <p className="text-[8px] text-gray-400">متوسط الرصيد لكل مستخدم</p>
                  </div>
                  <div className="bg-white rounded-2xl border border-gray-100 p-3 text-center">
                    <p className="text-sm font-black text-gray-900">
                      {fmt(Object.values(userBalances).reduce((a, b) => a + b, 0))}
                    </p>
                    <p className="text-[8px] text-gray-400">إجمالي الأرصدة المعلقة</p>
                  </div>
                </div>

                {/* ─── Activity Timeline (Recent 10 transactions) ─── */}
                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                  <div className="p-4 border-b border-gray-50">
                    <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2"><Clock className="w-4 h-4 text-gray-400" />سجل النشاطات الأخيرة</h3>
                  </div>
                  <div className="max-h-72 overflow-y-auto">
                    {(() => {
                      const allActivities: { type: string; description: string; amount: number; date: number; userName: string; icon: string; color: string }[] = [];
                      // Deposits
                      depositsList.slice(0, 5).forEach(d => {
                        allActivities.push({ type: "deposit", description: `إيداع ${fmt(d.amount)} ر.ي`, amount: d.amount, date: d.createdAt, userName: d.userName || "مستخدم", icon: "💰", color: d.status === "approved" ? "text-[#1B7A3D]" : d.status === "pending" ? "text-orange-500" : "text-red-500" });
                      });
                      // Card purchases
                      soldCards.sort((a, b) => (b.usedAt || 0) - (a.usedAt || 0)).slice(0, 5).forEach(c => {
                        const user = allUsers[c.usedBy || ""];
                        allActivities.push({ type: "purchase", description: `شراء كرت فئة ${c.tier}`, amount: c.price, date: c.usedAt || 0, userName: user?.displayName || "مستخدم", icon: "🛒", color: "text-blue-500" });
                      });
                      // Starlink orders
                      starOrdersList.slice(0, 3).forEach(o => {
                        allActivities.push({ type: "starlink", description: `طلب Starlink - ${o.productName}`, amount: o.priceUSD, date: o.createdAt, userName: o.userName || "مستخدم", icon: "🛰️", color: "text-purple-500" });
                      });
                      // Sort by date
                      allActivities.sort((a, b) => b.date - a.date);
                      return allActivities.slice(0, 10).map((act, i) => (
                        <div key={i} className="px-4 py-2.5 border-b border-gray-50 flex items-center gap-2">
                          <span className="text-base">{act.icon}</span>
                          <div className="flex-1 min-w-0">
                            <p className={`text-xs font-bold ${act.color} truncate`}>{act.description}</p>
                            <p className="text-[9px] text-gray-400">{act.userName} • {formatDate(act.date)}</p>
                          </div>
                        </div>
                      ));
                    })()}
                    {(() => {
                      const totalActs = depositsList.length + soldCards.length + starOrdersList.length;
                      return totalActs === 0 ? <div className="p-4 text-center text-xs text-gray-400">لا توجد نشاطات</div> : null;
                    })()}
                  </div>
                </div>
              </motion.div>
            )}

            {/* ═══ TAB 2: أرصدة ═══ */}
            {activeTab === "balances" && (
              <motion.div key="balances" variants={sectionVariants} initial="initial" animate="animate" exit="exit" transition={iOSSpring.gentle} className="space-y-4">
                {/* ─── Send/Withdraw Balance ─── */}
                <div className="bg-white rounded-2xl border border-gray-100 p-4">
                  <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2 mb-3">
                    <Wallet className="w-4 h-4 text-[#1B7A3D]" />
                    إدارة الأرصدة
                  </h3>
                  {/* Action Toggle */}
                  <div className="flex gap-2 mb-4">
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      onClick={() => setBalanceAction("credit")}
                      className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${balanceAction === "credit" ? "bg-[#1B7A3D] text-white shadow-md" : "bg-gray-50 text-gray-500"}`}
                    >
                      <Send className="w-3.5 h-3.5 inline ml-1" />
                      إرسال رصيد
                    </motion.button>
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      onClick={() => setBalanceAction("debit")}
                      className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${balanceAction === "debit" ? "bg-red-500 text-white shadow-md" : "bg-gray-50 text-gray-500"}`}
                    >
                      <Download className="w-3.5 h-3.5 inline ml-1" />
                      سحب رصيد
                    </motion.button>
                  </div>

                  {/* Select User */}
                  <div className="space-y-3">
                    <div>
                      <label className="text-[10px] font-bold text-gray-500 mb-1 block">اختر المستخدم</label>
                      <select
                        value={balanceUserId}
                        onChange={e => setBalanceUserId(e.target.value)}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-bold"
                      >
                        <option value="">-- اختر مستخدم --</option>
                        {usersList
                          .filter(u => balanceSearch ? (u.displayName || "").includes(balanceSearch) || (u.email || "").includes(balanceSearch) : true)
                          .map(u => (
                            <option key={u.id} value={u.id}>
                              {u.displayName || "بدون اسم"} ({u.email}) - رصيد: {fmt(userBalances[u.id] || 0)} ر.ي
                            </option>
                          ))}
                      </select>
                    </div>

                    {balanceUserId && (
                      <div className="bg-gray-50 rounded-xl p-3 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#1B7A3D] flex items-center justify-center text-white font-bold">
                          {(allUsers[balanceUserId]?.displayName || "م")[0]}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-gray-900">{allUsers[balanceUserId]?.displayName || "مستخدم"}</p>
                          <p className="text-[10px] text-gray-400">الرصيد الحالي: <span className="font-black text-[#1B7A3D]">{fmt(userBalances[balanceUserId] || 0)} ر.ي</span></p>
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="text-[10px] font-bold text-gray-500 mb-1 block">المبلغ (ر.ي)</label>
                      <Input
                        type="number"
                        value={balanceAmount}
                        onChange={e => setBalanceAmount(e.target.value)}
                        placeholder="أدخل المبلغ"
                        className="bg-gray-50 border-gray-200 rounded-xl text-sm"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-gray-500 mb-1 block">{balanceAction === "credit" ? "وصف العملية" : "سبب السحب"}</label>
                      <Input
                        value={balanceDescription}
                        onChange={e => setBalanceDescription(e.target.value)}
                        placeholder={balanceAction === "credit" ? "مثال: مكافأة، تعويض..." : "مثال: خطأ في الإيداع، استرداد..."}
                        className="bg-gray-50 border-gray-200 rounded-xl text-sm"
                      />
                    </div>

                    <Button
                      onClick={balanceAction === "credit" ? handleSendBalance : handleWithdrawBalance}
                      disabled={isProcessingBalance}
                      className={`w-full font-bold rounded-xl h-11 ${balanceAction === "credit" ? "bg-gradient-to-l from-[#1B7A3D] to-[#22A24D] text-white btn-green-shadow" : "bg-gradient-to-l from-red-500 to-red-600 text-white"}`}
                    >
                      {isProcessingBalance ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto" />
                      ) : balanceAction === "credit" ? (
                        <><Send className="w-4 h-4 ml-1.5" />إرسال رصيد</>
                      ) : (
                        <><Download className="w-4 h-4 ml-1.5" />سحب رصيد</>
                      )}
                    </Button>
                  </div>
                </div>

                {/* ─── All User Balances Table ─── */}
                <div className="bg-white rounded-2xl border border-gray-100 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                      <Users className="w-4 h-4 text-[#1B7A3D]" />
                      أرصدة المستخدمين
                    </h3>
                    <span className="text-[10px] text-gray-400">{usersList.length} مستخدم</span>
                  </div>
                  <div className="flex items-center gap-2 mb-3">
                    <Search className="w-4 h-4 text-gray-400" />
                    <Input
                      value={balanceSearch}
                      onChange={e => setBalanceSearch(e.target.value)}
                      placeholder="بحث بالاسم أو البريد..."
                      className="bg-gray-50 border-gray-200 rounded-xl text-sm"
                    />
                  </div>
                  <div className="max-h-80 overflow-y-auto space-y-2">
                    {usersList
                      .filter(u => balanceSearch ? (u.displayName || "").includes(balanceSearch) || (u.email || "").includes(balanceSearch) : true)
                      .sort((a, b) => (userBalances[b.id] || 0) - (userBalances[a.id] || 0))
                      .map(u => {
                        const balance = userBalances[u.id] || 0;
                        return (
                          <div key={u.id} className="flex items-center gap-2 p-2.5 rounded-xl bg-gray-50">
                            <div className="w-8 h-8 rounded-full bg-[#1B7A3D] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                              {(u.displayName || "م")[0]}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-gray-900 truncate">{u.displayName || "بدون اسم"}</p>
                              <p className="text-[9px] text-gray-400 truncate" dir="ltr">{u.email}</p>
                            </div>
                            <div className="text-left flex-shrink-0">
                              <p className="text-sm font-black text-[#1B7A3D]">{fmt(balance)}</p>
                              <p className="text-[8px] text-gray-400">ر.ي</p>
                            </div>
                          </div>
                        );
                      })}
                    {usersList.length === 0 && (
                      <div className="p-4 text-center text-xs text-gray-400">لا يوجد مستخدمين</div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {/* ═══ TAB 2: المستخدمين ═══ */}
            {activeTab === "users" && (
              <motion.div key="users" variants={sectionVariants} initial="initial" animate="animate" exit="exit" transition={iOSSpring.gentle} className="space-y-4">
                <div className="bg-white rounded-2xl border border-gray-100 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Search className="w-4 h-4 text-gray-400" />
                    <Input value={userSearch} onChange={e => setUserSearch(e.target.value)} placeholder="بحث بالاسم أو البريد أو الهاتف..." className="bg-gray-50 border-gray-200 rounded-xl text-sm" />
                  </div>
                  <div className="max-h-[60vh] overflow-y-auto space-y-2">
                    {filteredUsers.map(u => (
                      <div key={u.id} className="bg-gray-50 rounded-xl p-3">
                        {editingUser === u.id ? (
                          <div className="space-y-2">
                            <Input value={editDisplayName} onChange={e => setEditDisplayName(e.target.value)} placeholder="الاسم" className="bg-white border-gray-200 rounded-xl text-sm" />
                            <Input value={editPhone} onChange={e => setEditPhone(e.target.value)} placeholder="الهاتف" className="bg-white border-gray-200 rounded-xl text-sm" />
                            <div className="flex gap-2">
                              <Button size="sm" onClick={async () => {
                                try { await update(ref(db, `users/${u.id}`), { displayName: editDisplayName.trim(), phone: editPhone.trim() }); toast.success("تم التحديث"); setEditingUser(null); }
                                catch { toast.error("حدث خطأ"); }
                              }} className="bg-[#1B7A3D] text-white rounded-xl text-xs"><Save className="w-3 h-3 ml-1" />حفظ</Button>
                              <Button size="sm" variant="ghost" onClick={() => setEditingUser(null)} className="rounded-xl text-xs">إلغاء</Button>
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-[#1B7A3D] flex items-center justify-center text-white text-xs font-bold">{(u.displayName || "م")[0]}</div>
                                <div>
                                  <p className="text-xs font-bold text-gray-900">{u.displayName || "بدون اسم"}</p>
                                  <p className="text-[9px] text-gray-400" dir="ltr">{u.email}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                <Badge className={`text-[8px] ${u.role === "admin" ? "bg-[#E8F5E9] text-[#1B7A3D]" : u.role === "network_manager" ? "bg-orange-100 text-orange-600" : "bg-gray-100 text-gray-500"}`}>
                                  {u.role === "admin" ? "أدمن" : u.role === "network_manager" ? "مشرف" : "مستخدم"}
                                </Badge>
                              </div>
                            </div>
                            <div className="flex items-center justify-between mt-2">
                              <div className="flex items-center gap-2">
                                <span className="text-[9px] text-gray-400">رصيد: {fmt(userBalances[u.id] || 0)} ر.ي</span>
                                {u.managedNetwork && <span className="text-[9px] text-orange-500">شبكة: {fbNetworks[u.managedNetwork]?.name || u.managedNetwork}</span>}
                              </div>
                              <div className="flex items-center gap-1">
                                <Button size="sm" variant="ghost" onClick={() => { setEditingUser(u.id); setEditDisplayName(u.displayName || ""); setEditPhone(u.phone || ""); }} className="h-6 w-6 p-0 text-gray-400 hover:text-[#1B7A3D]"><Pencil className="w-3 h-3" /></Button>
                                <select
                                  value={u.role || "user"}
                                  onChange={e => changeUserRole(u.id, e.target.value as "user" | "admin" | "network_manager", u.managedNetwork)}
                                  className="bg-white border border-gray-200 rounded-lg px-1 py-0.5 text-[9px] font-bold"
                                >
                                  <option value="user">مستخدم</option>
                                  <option value="admin">أدمن</option>
                                  <option value="network_manager">مشرف شبكة</option>
                                </select>
                                {u.role === "network_manager" && (
                                  <select
                                    value={u.managedNetwork || ""}
                                    onChange={e => changeUserRole(u.id, "network_manager", e.target.value)}
                                    className="bg-white border border-gray-200 rounded-lg px-1 py-0.5 text-[9px] font-bold"
                                  >
                                    <option value="">اختر شبكة</option>
                                    {networksList.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
                                  </select>
                                )}
                                <Button size="sm" variant="ghost" onClick={() => toggleUserActive(u.id, u.isActive !== false)} className={`h-6 w-6 p-0 ${u.isActive !== false ? "text-[#1B7A3D]" : "text-red-500"}`}>
                                  {u.isActive !== false ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                    {filteredUsers.length === 0 && <p className="text-center text-xs text-gray-400 py-4">لا توجد نتائج</p>}
                  </div>
                </div>
              </motion.div>
            )}

            {/* ═══ TAB 3: الشبكات ═══ */}
            {activeTab === "networks" && (
              <motion.div key="networks" variants={sectionVariants} initial="initial" animate="animate" exit="exit" transition={iOSSpring.gentle} className="space-y-4">
                {/* Add network form */}
                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                  <div className="p-4 border-b border-gray-50">
                    <h3 className="text-sm font-bold text-[#1B7A3D] flex items-center gap-2"><Plus className="w-4 h-4" />إضافة شبكة جديدة</h3>
                  </div>
                  <div className="p-4 space-y-3">
                    <Input value={newNetName} onChange={e => setNewNetName(e.target.value)} placeholder="اسم الشبكة" className="bg-gray-50 border-gray-200 rounded-xl" />
                    <div className="grid grid-cols-2 gap-3">
                      <select value={newNetProvinceId} onChange={e => { setNewNetProvinceId(e.target.value); setNewNetDistrict(""); }} className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-bold">
                        <option value="">المحافظة</option>
                        {PROVINCES.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                      <select value={newNetDistrict} onChange={e => setNewNetDistrict(e.target.value)} className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-bold">
                        <option value="">المديرية</option>
                        {newNetProvinceId && getDistricts(newNetProvinceId).map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                    <Input value={newNetLocation} onChange={e => setNewNetLocation(e.target.value)} placeholder="الموقع الدقيق" className="bg-gray-50 border-gray-200 rounded-xl" />
                    <Input value={newNetIP} onChange={e => setNewNetIP(e.target.value)} placeholder="IP الاتصال" className="bg-gray-50 border-gray-200 rounded-xl" dir="ltr" />
                    <div>
                      <label className="text-[10px] font-bold text-gray-500 mb-1 block">أيقونة الشبكة</label>
                      <div className="flex items-center gap-3">
                        {newNetImage && <img src={newNetImage} alt="" className="w-12 h-12 rounded-xl object-cover" />}
                        <label className="cursor-pointer">
                          <span className="bg-[#E8F5E9] text-[#1B7A3D] text-xs font-bold px-3 py-2 rounded-xl inline-flex items-center gap-1"><Upload className="w-3 h-3" />رفع أيقونة</span>
                          <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload(setNewNetImage, 128)} />
                        </label>
                      </div>
                    </div>
                    <Button onClick={addNetwork} className="w-full bg-[#1B7A3D] hover:bg-[#165E30] text-white font-bold rounded-xl"><Plus className="w-4 h-4 ml-1" />إضافة الشبكة</Button>
                  </div>
                </div>

                {/* Networks list */}
                <div className="space-y-3">
                  {networksList.map(net => (
                    <div key={net.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                      {editingNetId === net.id ? (
                        <div className="p-4 space-y-3">
                          <Input value={editNetName} onChange={e => setEditNetName(e.target.value)} placeholder="اسم الشبكة" className="bg-gray-50 border-gray-200 rounded-xl" />
                          <div className="grid grid-cols-2 gap-3">
                            <select value={editNetProvinceId} onChange={e => { setEditNetProvinceId(e.target.value); setEditNetDistrict(""); }} className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-bold">
                              <option value="">المحافظة</option>
                              {PROVINCES.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                            <select value={editNetDistrict} onChange={e => setEditNetDistrict(e.target.value)} className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-bold">
                              <option value="">المديرية</option>
                              {editNetProvinceId && getDistricts(editNetProvinceId).map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                          </div>
                          <Input value={editNetLocation} onChange={e => setEditNetLocation(e.target.value)} placeholder="الموقع الدقيق" className="bg-gray-50 border-gray-200 rounded-xl" />
                          <Input value={editNetIP} onChange={e => setEditNetIP(e.target.value)} placeholder="IP الاتصال" className="bg-gray-50 border-gray-200 rounded-xl" dir="ltr" />
                          <div className="flex items-center gap-3">
                            {editNetImage && <img src={editNetImage} alt="" className="w-12 h-12 rounded-xl object-cover" />}
                            <label className="cursor-pointer"><span className="bg-[#E8F5E9] text-[#1B7A3D] text-xs font-bold px-3 py-2 rounded-xl inline-flex items-center gap-1"><Upload className="w-3 h-3" />تغيير الأيقونة</span><input type="file" accept="image/*" className="hidden" onChange={handleImageUpload(setEditNetImage, 128)} /></label>
                          </div>
                          <select value={editNetManager} onChange={e => setEditNetManager(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-bold">
                            <option value="">بدون مشرف</option>
                            {usersList.filter(u => u.role !== "admin").map(u => <option key={u.id} value={u.id}>{u.displayName || u.email}</option>)}
                          </select>
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => saveEditNet(net.id)} className="bg-[#1B7A3D] text-white rounded-xl text-xs"><Save className="w-3 h-3 ml-1" />حفظ</Button>
                            <Button size="sm" variant="ghost" onClick={() => setEditingNetId(null)} className="rounded-xl text-xs">إلغاء</Button>
                          </div>
                        </div>
                      ) : (
                        <div className="p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              {net.imageBase64 ? (
                                <img src={net.imageBase64} alt="" className="w-10 h-10 rounded-xl object-cover" />
                              ) : (
                                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg" style={{ backgroundColor: (net as Record<string, unknown>).bgColor as string || "#E8F5E9" }}>{(net as Record<string, unknown>).emoji as string || "📶"}</div>
                              )}
                              <div>
                                <p className="text-sm font-bold text-gray-900">{net.name}</p>
                                <p className="text-[9px] text-gray-400">{net.provinceName || ""} {net.district ? `• ${net.district}` : ""}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button size="sm" variant="ghost" onClick={() => startEditNet(net as NetworkItem & { id: string })} className="h-7 w-7 p-0 text-gray-400 hover:text-[#1B7A3D]"><Pencil className="w-3 h-3" /></Button>
                              <Button size="sm" variant="ghost" onClick={() => deleteNetwork(net.id)} className={`h-7 w-7 p-0 ${deleteConfirm === `net-${net.id}` ? "text-red-500" : "text-gray-300 hover:text-red-500"}`}><Trash2 className="w-3 h-3" /></Button>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {net.ownerId && <Badge className="bg-orange-100 text-orange-600 text-[8px]">المشرف: {net.ownerName || "—"}</Badge>}
                            {net.connectionIP && <Badge className="bg-blue-50 text-blue-600 text-[8px]" dir="ltr">IP: {net.connectionIP}</Badge>}
                            {net.exactLocation && <Badge className="bg-gray-100 text-gray-600 text-[8px]"><MapPin className="w-2 h-2 ml-0.5" />{net.exactLocation}</Badge>}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* ═══ TAB: طلبات الشبكات ═══ */}
            {activeTab === "networkRequests" && (
              <motion.div key="networkRequests" variants={sectionVariants} initial="initial" animate="animate" exit="exit" transition={iOSSpring.gentle} className="space-y-4">
                {/* Stats */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-orange-50 rounded-xl p-3 text-center">
                    <p className="text-lg font-black text-orange-600">{fmt(pendingNetworkSubmissions.length)}</p>
                    <p className="text-[9px] text-orange-500 font-bold">معلق</p>
                  </div>
                  <div className="bg-[#E8F5E9] rounded-xl p-3 text-center">
                    <p className="text-lg font-black text-[#1B7A3D]">{fmt(approvedNetworkSubmissions.length)}</p>
                    <p className="text-[9px] text-[#1B7A3D]/70 font-bold">مقبول</p>
                  </div>
                  <div className="bg-red-50 rounded-xl p-3 text-center">
                    <p className="text-lg font-black text-red-600">{fmt(rejectedNetworkSubmissions.length)}</p>
                    <p className="text-[9px] text-red-500 font-bold">مرفوض</p>
                  </div>
                </div>

                {pendingNetworkSubmissions.length > 0 && (
                  <div className="bg-orange-50 rounded-2xl p-4 flex items-center gap-3 border border-orange-100">
                    <div className="w-10 h-10 rounded-xl bg-orange-500 flex items-center justify-center"><FileCheck className="w-5 h-5 text-white" /></div>
                    <div>
                      <p className="text-sm font-black text-orange-700">{fmt(pendingNetworkSubmissions.length)} طلب شبكة معلق</p>
                      <p className="text-[9px] text-orange-500">بانتظار المراجعة والموافقة</p>
                    </div>
                  </div>
                )}

                {/* Submissions List */}
                <div className="space-y-3">
                  {networkSubmissionsList.map(sub => (
                    <div key={sub.id} className="bg-white rounded-2xl border border-gray-100 p-4 hover:shadow-md transition-shadow">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2.5">
                          {sub.imageBase64 ? (
                            <img src={sub.imageBase64} alt={sub.networkName} className="w-10 h-10 rounded-xl object-cover" />
                          ) : (
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                              sub.status === "pending" ? "bg-orange-50" : sub.status === "approved" ? "bg-[#E8F5E9]" : "bg-red-50"
                            }`}>
                              <Wifi className={`w-5 h-5 ${
                                sub.status === "pending" ? "text-orange-500" : sub.status === "approved" ? "text-[#1B7A3D]" : "text-red-500"
                              }`} />
                            </div>
                          )}
                          <div>
                            <p className="text-sm font-black text-gray-900" dir="ltr">{sub.networkName}</p>
                            <p className="text-[9px] text-gray-400">{sub.provinceName} • {sub.district}</p>
                          </div>
                        </div>
                        <Badge className={`text-[8px] font-bold ${
                          sub.status === "pending" ? "bg-orange-100 text-orange-600" :
                          sub.status === "approved" ? "bg-[#E8F5E9] text-[#1B7A3D]" :
                          "bg-red-100 text-red-600"
                        }`}>
                          {sub.status === "pending" ? "معلق" : sub.status === "approved" ? "مقبول" : "مرفوض"}
                        </Badge>
                      </div>

                      {/* Details */}
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        <div className="flex items-center gap-1.5 text-[10px] text-gray-500">
                          <Users className="w-3 h-3 text-gray-400" />
                          <span>{sub.userName}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] text-gray-500">
                          <Phone className="w-3 h-3 text-gray-400" />
                          <span dir="ltr">{sub.userPhone || "—"}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] text-gray-500">
                          <Signal className="w-3 h-3 text-gray-400" />
                          <span>{sub.networkType || "—"}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] text-gray-500">
                          <MapPin className="w-3 h-3 text-gray-400" />
                          <span>{sub.exactLocation || "—"}</span>
                        </div>
                        {sub.coverage && (
                          <div className="flex items-center gap-1.5 text-[10px] text-gray-500">
                            <Wifi className="w-3 h-3 text-gray-400" />
                            <span>{sub.coverage}</span>
                          </div>
                        )}
                        {sub.speed && (
                          <div className="flex items-center gap-1.5 text-[10px] text-gray-500">
                            <Gauge className="w-3 h-3 text-gray-400" />
                            <span>{sub.speed}</span>
                          </div>
                        )}
                      </div>

                      {sub.description && (
                        <p className="text-[10px] text-gray-400 mb-3 bg-gray-50 rounded-lg p-2">{sub.description}</p>
                      )}

                      <div className="flex items-center justify-between text-[9px] text-gray-400 mb-2">
                        <span>{formatDate(sub.createdAt)}</span>
                        {sub.reviewedAt && <span>تمت المراجعة: {formatDate(sub.reviewedAt)}</span>}
                      </div>

                      {sub.status === "rejected" && sub.rejectionReason && (
                        <div className="bg-red-50 rounded-xl p-2.5 mb-2 flex items-start gap-1.5 border border-red-100">
                          <XCircle className="w-3.5 h-3.5 text-red-400 mt-0.5 flex-shrink-0" />
                          <p className="text-[10px] text-red-600">{sub.rejectionReason}</p>
                        </div>
                      )}

                      {sub.status === "approved" && sub.assignedNetworkId && (
                        <div className="bg-[#E8F5E9] rounded-xl p-2.5 mb-2 flex items-start gap-1.5 border border-green-100">
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#1B7A3D] mt-0.5 flex-shrink-0" />
                          <p className="text-[10px] text-[#1B7A3D]">تم إنشاء الشبكة: {sub.assignedNetworkId}</p>
                        </div>
                      )}

                      {sub.status === "pending" && (
                        <div className="space-y-2">
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => approveNetworkSubmission(sub.id, sub)} className="bg-[#1B7A3D] text-white rounded-xl text-xs flex-1 hover:bg-[#165E30] transition-colors">
                              <CheckCircle2 className="w-3.5 h-3.5 ml-1" />قبول وإنشاء شبكة
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => { setRejectingSubmissionId(sub.id); setRejectionReason(""); }} className="rounded-xl text-xs flex-1">
                              <XCircle className="w-3.5 h-3.5 ml-1" />رفض
                            </Button>
                          </div>
                          {rejectingSubmissionId === sub.id && (
                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="space-y-2">
                              <Input
                                value={rejectionReason}
                                onChange={e => setRejectionReason(e.target.value)}
                                placeholder="سبب الرفض (اختياري)"
                                className="bg-red-50 border-red-200 rounded-xl text-sm"
                              />
                              <div className="flex gap-2">
                                <Button size="sm" onClick={() => rejectNetworkSubmission(sub.id, sub, rejectionReason)} className="bg-red-500 text-white rounded-xl text-xs flex-1">تأكيد الرفض</Button>
                                <Button size="sm" variant="ghost" onClick={() => setRejectingSubmissionId(null)} className="rounded-xl text-xs">إلغاء</Button>
                              </div>
                            </motion.div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                  {networkSubmissionsList.length === 0 && (
                    <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
                      <FileCheck className="w-12 h-12 mx-auto text-gray-200 mb-2" />
                      <p className="text-gray-400 text-sm">لا توجد طلبات شبكات</p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* ═══ TAB 4: الكروت ═══ */}
            {activeTab === "cards" && (
              <motion.div key="cards" variants={sectionVariants} initial="initial" animate="animate" exit="exit" transition={iOSSpring.gentle} className="space-y-4">
                {/* Mode toggle */}
                <div className="bg-white rounded-2xl border border-gray-100 p-3">
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCardAddMode("single")}
                      className={`flex-1 px-3 py-2 rounded-xl text-xs font-bold transition-all ${cardAddMode === "single" ? "bg-[#1B7A3D] text-white shadow-md" : "bg-gray-50 text-gray-500 hover:bg-gray-100"}`}
                    >
                      <Plus className="w-3 h-3 inline ml-1" />إضافة فردي
                    </button>
                    <button
                      onClick={() => setCardAddMode("bulk-codes")}
                      className={`flex-1 px-3 py-2 rounded-xl text-xs font-bold transition-all ${cardAddMode === "bulk-codes" ? "bg-orange-500 text-white shadow-md" : "bg-gray-50 text-gray-500 hover:bg-gray-100"}`}
                    >
                      <Package className="w-3 h-3 inline ml-1" />إضافة بالجملة (كود)
                    </button>
                  </div>
                </div>

                {/* Add single card */}
                {cardAddMode === "single" && (
                  <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                    <div className="p-4 border-b border-gray-50">
                      <h3 className="text-sm font-bold text-[#1B7A3D] flex items-center gap-2"><Plus className="w-4 h-4" />إضافة كرت</h3>
                    </div>
                    <div className="p-4 space-y-3">
                      <Input value={newCardCode} onChange={e => setNewCardCode(e.target.value)} placeholder="رمز الكرت" className="bg-gray-50 border-gray-200 rounded-xl" />
                      <div className="grid grid-cols-2 gap-3">
                        <Input type="number" value={newCardPrice} onChange={e => setNewCardPrice(e.target.value)} placeholder="السعر" className="bg-gray-50 border-gray-200 rounded-xl" />
                        <Input value={newCardData} onChange={e => setNewCardData(e.target.value)} placeholder="البيانات (2 جيجا)" className="bg-gray-50 border-gray-200 rounded-xl" />
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <Input type="number" value={newCardDuration} onChange={e => setNewCardDuration(e.target.value)} placeholder="المدة (أيام)" className="bg-gray-50 border-gray-200 rounded-xl" />
                        <select value={newCardTier} onChange={e => setNewCardTier(e.target.value)} className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-bold">
                          {tiersList.sort((a, b) => a.price - b.price).map(t => <option key={t.tier} value={t.tier}>{t.price} ر.ي</option>)}
                        </select>
                        <select value={newCardNetwork} onChange={e => setNewCardNetwork(e.target.value)} className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-bold">
                          {networksList.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
                        </select>
                      </div>
                      <Button onClick={addSingleCard} className="w-full bg-[#1B7A3D] hover:bg-[#165E30] text-white font-bold rounded-xl"><Plus className="w-4 h-4 ml-1" />إضافة</Button>
                    </div>
                  </div>
                )}

                {/* Bulk by codes */}
                {cardAddMode === "bulk-codes" && (
                  <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                    <div className="p-4 border-b border-gray-50">
                      <h3 className="text-sm font-bold text-orange-500 flex items-center gap-2"><Package className="w-4 h-4" />إضافة بالجملة (كود)</h3>
                      <p className="text-[10px] text-gray-400 mt-1">الصق أكواد الكروت، واحد في كل سطر</p>
                    </div>
                    <div className="p-4 space-y-3">
                      <textarea
                        value={bulkCodesText}
                        onChange={e => setBulkCodesText(e.target.value)}
                        placeholder={"546764487\n564886464\n616749489"}
                        rows={6}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-mono focus:border-[#1B7A3D] focus:ring-[#1B7A3D] outline-none resize-y"
                        dir="ltr"
                      />
                      <div className="grid grid-cols-2 gap-3">
                        <select value={bulkCodesNetwork} onChange={e => setBulkCodesNetwork(e.target.value)} className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-bold">
                          {networksList.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
                        </select>
                        <div className="flex items-center gap-2">
                          <select
                            value={bulkCodesCustom ? "custom" : bulkCodesTier}
                            onChange={e => {
                              if (e.target.value === "custom") {
                                setBulkCodesCustom(true);
                              } else {
                                setBulkCodesCustom(false);
                                setBulkCodesTier(e.target.value);
                              }
                            }}
                            className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-bold"
                          >
                            {tiersList.sort((a, b) => a.price - b.price).map(t => <option key={t.tier} value={t.tier}>{t.price} ر.ي</option>)}
                            <option value="custom">فئة مخصصة...</option>
                          </select>
                        </div>
                      </div>
                      {bulkCodesCustom && (
                        <div className="grid grid-cols-3 gap-3">
                          <Input type="number" value={bulkCodesCustomPrice} onChange={e => setBulkCodesCustomPrice(e.target.value)} placeholder="السعر" className="bg-gray-50 border-gray-200 rounded-xl" />
                          <Input value={bulkCodesCustomData} onChange={e => setBulkCodesCustomData(e.target.value)} placeholder="البيانات" className="bg-gray-50 border-gray-200 rounded-xl" />
                          <Input type="number" value={bulkCodesCustomDuration} onChange={e => setBulkCodesCustomDuration(e.target.value)} placeholder="المدة (أيام)" className="bg-gray-50 border-gray-200 rounded-xl" />
                        </div>
                      )}
                      {isAddingBulkCodes && bulkCodesProgress.total > 0 && (
                        <div className="bg-orange-50 rounded-xl px-3 py-2 text-center">
                          <p className="text-xs font-bold text-orange-600">
                            تم إضافة {bulkCodesProgress.done} من {bulkCodesProgress.total} كرت
                          </p>
                          <div className="mt-1.5 h-1.5 bg-orange-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-orange-500 rounded-full transition-all duration-300"
                              style={{ width: `${(bulkCodesProgress.done / bulkCodesProgress.total) * 100}%` }}
                            />
                          </div>
                        </div>
                      )}
                      <Button onClick={addBulkCodesByPasting} disabled={isAddingBulkCodes} className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl">
                        {isAddingBulkCodes ? (
                          <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />جاري الإضافة...</span>
                        ) : (
                          <><Package className="w-4 h-4 ml-1" />إضافة الأكواد ({bulkCodesText.split("\n").filter(c => c.trim()).length} كرت)</>
                        )}
                      </Button>
                    </div>
                  </div>
                )}

                {/* Filters */}
                <div className="bg-white rounded-2xl border border-gray-100 p-4">
                  <div className="grid grid-cols-3 gap-2">
                    <select value={cardFilterNetwork} onChange={e => setCardFilterNetwork(e.target.value)} className="bg-gray-50 border border-gray-200 rounded-xl px-2 py-2 text-xs font-bold">
                      <option value="all">كل الشبكات</option>
                      {networksList.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
                    </select>
                    <select value={cardFilterTier} onChange={e => setCardFilterTier(e.target.value)} className="bg-gray-50 border border-gray-200 rounded-xl px-2 py-2 text-xs font-bold">
                      <option value="all">كل الفئات</option>
                      {tiersList.map(t => <option key={t.tier} value={t.tier}>{t.price} ر.ي</option>)}
                    </select>
                    <select value={cardFilterStatus} onChange={e => setCardFilterStatus(e.target.value)} className="bg-gray-50 border border-gray-200 rounded-xl px-2 py-2 text-xs font-bold">
                      <option value="all">الحالة</option>
                      <option value="available">متاح</option>
                      <option value="sold">مباع</option>
                    </select>
                  </div>
                </div>

                {/* Cards list */}
                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                  <div className="p-4 border-b border-gray-50 flex items-center justify-between">
                    <h3 className="text-sm font-bold text-gray-900">الكروت ({fmt(filteredCards.length)})</h3>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {filteredCards.slice(0, 50).map(c => (
                      <div key={c.id} className="px-4 py-2.5 border-b border-gray-50 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${c.isUsed ? "bg-red-400" : "bg-[#1B7A3D]"}`} />
                          <span className="text-xs font-mono text-gray-700" dir="ltr">{c.code.substring(0, 12)}</span>
                          <Badge className="text-[8px] bg-gray-100 text-gray-500">{c.tier} ر.ي</Badge>
                          <Badge className="text-[8px] bg-blue-50 text-blue-600">{fbNetworks[c.network]?.name || c.network}</Badge>
                        </div>
                        <Button size="sm" variant="ghost" onClick={() => deleteCard(c.id)} className={`h-6 w-6 p-0 ${deleteConfirm === c.id ? "text-red-500" : "text-gray-300"}`}><Trash2 className="w-3 h-3" /></Button>
                      </div>
                    ))}
                    {filteredCards.length > 50 && <div className="p-3 text-center text-[10px] text-gray-400">وأكثر {fmt(filteredCards.length - 50)} كرت...</div>}
                  </div>
                </div>
              </motion.div>
            )}

            {/* ═══ TAB 5: الطلبات ═══ */}
            {activeTab === "orders" && (
              <motion.div key="orders" variants={sectionVariants} initial="initial" animate="animate" exit="exit" transition={iOSSpring.gentle} className="space-y-4">
                <div className="bg-orange-50 rounded-2xl p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-orange-500 flex items-center justify-center"><Receipt className="w-5 h-5 text-white" /></div>
                  <div>
                    <p className="text-sm font-black text-orange-700">{fmt(pendingDeposits.length)} طلب معلق</p>
                    <p className="text-[9px] text-orange-500">بانتظار المراجعة والموافقة</p>
                  </div>
                </div>

                <div className="space-y-3">
                  {depositsList.map(d => (
                    <div key={d.id} className={`bg-white rounded-2xl border p-4 hover:shadow-md transition-all cursor-default ${
                      d.status === "pending" ? "border-orange-200 bg-gradient-to-br from-white to-orange-50/30" :
                      d.status === "approved" ? "border-green-100 bg-gradient-to-br from-white to-green-50/30" :
                      "border-red-100 bg-gradient-to-br from-white to-red-50/30"
                    }`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold shadow-sm ${d.status === "pending" ? "bg-orange-500" : d.status === "approved" ? "bg-[#1B7A3D]" : "bg-red-500"}`}>
                            {fmt(d.amount)}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-gray-900">{d.userName}</p>
                            <p className="text-[9px] text-gray-400">{d.bankName} • {formatDate(d.createdAt)}</p>
                          </div>
                        </div>
                        <Badge className={`text-[8px] font-bold ${d.status === "pending" ? "bg-orange-100 text-orange-600" : d.status === "approved" ? "bg-[#E8F5E9] text-[#1B7A3D]" : "bg-red-100 text-red-600"}`}>
                          {d.status === "pending" ? "⏳ معلق" : d.status === "approved" ? "✓ مقبول" : "✗ مرفوض"}
                        </Badge>
                      </div>
                      {d.referenceNumber && <p className="text-[10px] text-gray-400 mb-2">مرجع: <span className="font-mono" dir="ltr">{d.referenceNumber}</span></p>}
                      {d.status === "pending" && (
                        <div className="flex gap-2 mt-2">
                          <Button size="sm" onClick={() => approveDeposit(d.id, d)} className="bg-[#1B7A3D] text-white rounded-xl text-xs flex-1 hover:bg-[#165E30] transition-colors"><Check className="w-3 h-3 ml-1" />قبول</Button>
                          <Button size="sm" variant="destructive" onClick={() => rejectDeposit(d.id, d)} className="rounded-xl text-xs flex-1"><X className="w-3 h-3 ml-1" />رفض</Button>
                        </div>
                      )}
                    </div>
                  ))}
                  {depositsList.length === 0 && <p className="text-center text-xs text-gray-400 py-8">لا توجد طلبات</p>}
                </div>
              </motion.div>
            )}

            {/* ═══ TAB 6: الفئات ═══ */}
            {activeTab === "tiers" && (
              <motion.div key="tiers" variants={sectionVariants} initial="initial" animate="animate" exit="exit" transition={iOSSpring.gentle} className="space-y-4">
                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                  <div className="p-4 border-b border-gray-50">
                    <h3 className="text-sm font-bold text-[#1B7A3D] flex items-center gap-2"><Plus className="w-4 h-4" />إضافة فئة</h3>
                  </div>
                  <div className="p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <Input type="number" value={newTierPrice} onChange={e => setNewTierPrice(e.target.value)} placeholder="السعر (ر.ي)" className="bg-gray-50 border-gray-200 rounded-xl" />
                      <Input value={newTierData} onChange={e => setNewTierData(e.target.value)} placeholder="البيانات (2 جيجا)" className="bg-gray-50 border-gray-200 rounded-xl" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Input type="number" value={newTierDuration} onChange={e => setNewTierDuration(e.target.value)} placeholder="المدة (أيام)" className="bg-gray-50 border-gray-200 rounded-xl" />
                      <Input value={newTierIcon} onChange={e => setNewTierIcon(e.target.value)} placeholder="أيقونة (🟢)" className="bg-gray-50 border-gray-200 rounded-xl" />
                    </div>
                    <Button onClick={addTier} className="w-full bg-[#1B7A3D] hover:bg-[#165E30] text-white font-bold rounded-xl"><Plus className="w-4 h-4 ml-1" />إضافة</Button>
                  </div>
                </div>

                <div className="space-y-2">
                  {tiersList.sort((a, b) => a.price - b.price).map(t => (
                    <div key={t.id || t.tier} className="bg-white rounded-2xl border border-gray-100 p-4">
                      {editingTier === t.id ? (
                        <div className="space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <Input type="number" value={editTierPrice} onChange={e => setEditTierPrice(e.target.value)} placeholder="السعر" className="bg-gray-50 border-gray-200 rounded-xl text-sm" />
                            <Input value={editTierData} onChange={e => setEditTierData(e.target.value)} placeholder="البيانات" className="bg-gray-50 border-gray-200 rounded-xl text-sm" />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <Input type="number" value={editTierDuration} onChange={e => setEditTierDuration(e.target.value)} placeholder="المدة" className="bg-gray-50 border-gray-200 rounded-xl text-sm" />
                            <Input value={editTierIcon} onChange={e => setEditTierIcon(e.target.value)} placeholder="أيقونة" className="bg-gray-50 border-gray-200 rounded-xl text-sm" />
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => saveEditTier(t.tier)} className="bg-[#1B7A3D] text-white rounded-xl text-xs"><Save className="w-3 h-3 ml-1" />حفظ</Button>
                            <Button size="sm" variant="ghost" onClick={() => setEditingTier(null)} className="rounded-xl text-xs">إلغاء</Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{t.icon}</span>
                            <div>
                              <p className="text-sm font-bold text-gray-900">{fmt(t.price)} ر.ي</p>
                              <p className="text-[9px] text-gray-400">{t.data} / {t.duration} أيام</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button size="sm" variant="ghost" onClick={() => startEditTier(t as TierItem & { id: string })} className="h-7 w-7 p-0 text-gray-400 hover:text-[#1B7A3D]"><Pencil className="w-3 h-3" /></Button>
                            <Button size="sm" variant="ghost" onClick={() => deleteTier(t.tier)} className={`h-7 w-7 p-0 ${deleteConfirm === `tier-${t.tier}` ? "text-red-500" : "text-gray-300"}`}><Trash2 className="w-3 h-3" /></Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* ═══ TAB 7: Starlink ═══ */}
            {activeTab === "starlink" && (
              <motion.div key="starlink" variants={sectionVariants} initial="initial" animate="animate" exit="exit" transition={iOSSpring.gentle} className="space-y-4">
                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                  <div className="p-4 border-b border-gray-50">
                    <h3 className="text-sm font-bold text-[#1B7A3D] flex items-center gap-2"><Plus className="w-4 h-4" />إضافة منتج Starlink</h3>
                  </div>
                  <div className="p-4 space-y-3">
                    <Input value={newStarName} onChange={e => setNewStarName(e.target.value)} placeholder="اسم المنتج" className="bg-gray-50 border-gray-200 rounded-xl" />
                    <Input value={newStarDesc} onChange={e => setNewStarDesc(e.target.value)} placeholder="الوصف" className="bg-gray-50 border-gray-200 rounded-xl" />
                    <div className="grid grid-cols-2 gap-3">
                      <Input type="number" value={newStarPrice} onChange={e => setNewStarPrice(e.target.value)} placeholder="السعر (USD)" className="bg-gray-50 border-gray-200 rounded-xl" dir="ltr" />
                      <Input type="number" value={newStarQty} onChange={e => setNewStarQty(e.target.value)} placeholder="الكمية" className="bg-gray-50 border-gray-200 rounded-xl" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Input value={newStarDownload} onChange={e => setNewStarDownload(e.target.value)} placeholder="سرعة التحميل" className="bg-gray-50 border-gray-200 rounded-xl" />
                      <Input value={newStarUpload} onChange={e => setNewStarUpload(e.target.value)} placeholder="سرعة الرفع" className="bg-gray-50 border-gray-200 rounded-xl" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Input value={newStarLatency} onChange={e => setNewStarLatency(e.target.value)} placeholder="زمن الاستجابة" className="bg-gray-50 border-gray-200 rounded-xl" />
                      <Input value={newStarCoverage} onChange={e => setNewStarCoverage(e.target.value)} placeholder="التغطية" className="bg-gray-50 border-gray-200 rounded-xl" />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-gray-500 mb-1 block">صورة المنتج</label>
                      <div className="flex items-center gap-3">
                        {newStarImage && <img src={newStarImage} alt="" className="w-12 h-12 rounded-xl object-cover" />}
                        <label className="cursor-pointer"><span className="bg-[#E8F5E9] text-[#1B7A3D] text-xs font-bold px-3 py-2 rounded-xl inline-flex items-center gap-1"><Upload className="w-3 h-3" />رفع صورة</span><input type="file" accept="image/*" className="hidden" onChange={handleImageUpload(setNewStarImage, 128)} /></label>
                      </div>
                    </div>
                    <Button onClick={addStarlinkProduct} className="w-full bg-[#1B7A3D] hover:bg-[#165E30] text-white font-bold rounded-xl"><Plus className="w-4 h-4 ml-1" />إضافة المنتج</Button>
                  </div>
                </div>

                {/* Products list */}
                <div className="space-y-2">
                  {starProductsList.map(p => (
                    <div key={p.id} className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {p.imageBase64 ? <img src={p.imageBase64} alt="" className="w-10 h-10 rounded-xl object-cover" /> : <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center"><Satellite className="w-5 h-5 text-gray-400" /></div>}
                        <div>
                          <p className="text-sm font-bold text-gray-900">{p.name}</p>
                          <p className="text-[9px] text-gray-400">${p.priceUSD} • كمية: {p.quantity}</p>
                        </div>
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => deleteStarlinkProduct(p.id)} className={`h-7 w-7 p-0 ${deleteConfirm === `star-${p.id}` ? "text-red-500" : "text-gray-300"}`}><Trash2 className="w-3 h-3" /></Button>
                    </div>
                  ))}
                </div>

                {/* Starlink orders */}
                {starOrdersList.length > 0 && (
                  <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                    <div className="p-4 border-b border-gray-50">
                      <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2"><ShoppingBag className="w-4 h-4" />طلبات Starlink</h3>
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      {starOrdersList.map(o => (
                        <div key={o.id} className="px-4 py-3 border-b border-gray-50 flex items-center justify-between">
                          <div>
                            <p className="text-xs font-bold text-gray-900">{o.productName} — ${o.priceUSD}</p>
                            <p className="text-[9px] text-gray-400">{o.userName} • {formatDate(o.createdAt)}</p>
                          </div>
                          <select value={o.status} onChange={e => updateStarlinkOrderStatus(o.id, e.target.value)} className="bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 text-[9px] font-bold">
                            <option value="pending">معلق</option>
                            <option value="confirmed">مؤكد</option>
                            <option value="shipped">مشحون</option>
                            <option value="delivered">تم التوصيل</option>
                            <option value="cancelled">ملغي</option>
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* ═══ TAB 8: البنوك ═══ */}
            {activeTab === "banks" && (
              <motion.div key="banks" variants={sectionVariants} initial="initial" animate="animate" exit="exit" transition={iOSSpring.gentle} className="space-y-4">
                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                  <div className="p-4 border-b border-gray-50">
                    <h3 className="text-sm font-bold text-[#1B7A3D] flex items-center gap-2"><Plus className="w-4 h-4" />إضافة بنك</h3>
                  </div>
                  <div className="p-4 space-y-3">
                    <Input value={newBankName} onChange={e => setNewBankName(e.target.value)} placeholder="اسم البنك" className="bg-gray-50 border-gray-200 rounded-xl" />
                    <Input value={newBankAccount} onChange={e => setNewBankAccount(e.target.value)} placeholder="اسم الحساب" className="bg-gray-50 border-gray-200 rounded-xl" />
                    <Input value={newBankNumber} onChange={e => setNewBankNumber(e.target.value)} placeholder="رقم الحساب" className="bg-gray-50 border-gray-200 rounded-xl" dir="ltr" />
                    <Button onClick={addBank} className="w-full bg-[#1B7A3D] hover:bg-[#165E30] text-white font-bold rounded-xl"><Plus className="w-4 h-4 ml-1" />إضافة</Button>
                  </div>
                </div>

                <div className="space-y-2">
                  {banksList.map(b => (
                    <div key={b.id} className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-bold text-gray-900">{b.bankName}</p>
                        <p className="text-[9px] text-gray-400">{b.accountName} • <span dir="ltr">{b.accountNumber}</span></p>
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => deleteBank(b.id)} className={`h-7 w-7 p-0 ${deleteConfirm === `bank-${b.id}` ? "text-red-500" : "text-gray-300"}`}><Trash2 className="w-3 h-3" /></Button>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* ═══ TAB 9: شرائح SIM ═══ */}
            {activeTab === "sims" && (
              <motion.div key="sims" variants={sectionVariants} initial="initial" animate="animate" exit="exit" transition={iOSSpring.gentle} className="space-y-4">
                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                  <div className="p-4 border-b border-gray-50">
                    <h3 className="text-sm font-bold text-[#1B7A3D] flex items-center gap-2"><Plus className="w-4 h-4" />إضافة شريحة SIM</h3>
                  </div>
                  <div className="p-4 space-y-3">
                    <Input value={newSimName} onChange={e => setNewSimName(e.target.value)} placeholder="اسم الشريحة" className="bg-gray-50 border-gray-200 rounded-xl" />
                    <Input type="number" value={newSimPrice} onChange={e => setNewSimPrice(e.target.value)} placeholder="السعر (ر.ي)" className="bg-gray-50 border-gray-200 rounded-xl" />
                    <Input value={newSimDesc} onChange={e => setNewSimDesc(e.target.value)} placeholder="الوصف" className="bg-gray-50 border-gray-200 rounded-xl" />
                    <div className="flex items-center gap-3">
                      {newSimImage && <img src={newSimImage} alt="" className="w-12 h-12 rounded-xl object-cover" />}
                      <label className="cursor-pointer"><span className="bg-[#E8F5E9] text-[#1B7A3D] text-xs font-bold px-3 py-2 rounded-xl inline-flex items-center gap-1"><Upload className="w-3 h-3" />رفع صورة</span><input type="file" accept="image/*" className="hidden" onChange={handleImageUpload(setNewSimImage, 128)} /></label>
                    </div>
                    <Button onClick={addSim} className="w-full bg-[#1B7A3D] hover:bg-[#165E30] text-white font-bold rounded-xl"><Plus className="w-4 h-4 ml-1" />إضافة</Button>
                  </div>
                </div>

                <div className="space-y-2">
                  {simsList.map(s => (
                    <div key={s.id} className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {s.imageUrl ? <img src={s.imageUrl} alt="" className="w-10 h-10 rounded-xl object-cover" /> : <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center"><SimIcon className="w-5 h-5 text-gray-400" /></div>}
                        <div>
                          <p className="text-sm font-bold text-gray-900">{s.name}</p>
                          <p className="text-[9px] text-gray-400">{fmt(s.price)} ر.ي{ s.description ? ` • ${s.description}` : ""}</p>
                        </div>
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => deleteSim(s.id)} className={`h-7 w-7 p-0 ${deleteConfirm === `sim-${s.id}` ? "text-red-500" : "text-gray-300"}`}><Trash2 className="w-3 h-3" /></Button>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* ═══ TAB 10: الإعلانات ═══ */}
            {activeTab === "ads" && (
              <motion.div key="ads" variants={sectionVariants} initial="initial" animate="animate" exit="exit" transition={iOSSpring.gentle} className="space-y-4">
                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                  <div className="p-4 border-b border-gray-50">
                    <h3 className="text-sm font-bold text-[#1B7A3D] flex items-center gap-2"><Plus className="w-4 h-4" />إضافة إعلان</h3>
                  </div>
                  <div className="p-4 space-y-3">
                    <Input value={newAdTitle} onChange={e => setNewAdTitle(e.target.value)} placeholder="عنوان الإعلان" className="bg-gray-50 border-gray-200 rounded-xl" />
                    <Input value={newAdDesc} onChange={e => setNewAdDesc(e.target.value)} placeholder="وصف الإعلان" className="bg-gray-50 border-gray-200 rounded-xl" />
                    <div>
                      <label className="text-[10px] font-bold text-gray-500 mb-1 block">صورة الإعلان</label>
                      <div className="flex items-center gap-3">
                        {newAdImage && <img src={newAdImage} alt="" className="w-16 h-10 rounded-xl object-cover" />}
                        <label className="cursor-pointer"><span className="bg-[#E8F5E9] text-[#1B7A3D] text-xs font-bold px-3 py-2 rounded-xl inline-flex items-center gap-1"><Upload className="w-3 h-3" />رفع صورة</span><input type="file" accept="image/*" className="hidden" onChange={handleImageUpload(setNewAdImage, 512)} /></label>
                      </div>
                    </div>
                    <Button onClick={addAd} className="w-full bg-[#1B7A3D] hover:bg-[#165E30] text-white font-bold rounded-xl"><Plus className="w-4 h-4 ml-1" />إضافة الإعلان</Button>
                  </div>
                </div>

                <div className="space-y-2">
                  {adsList.map(a => (
                    <div key={a.id} className="bg-white rounded-2xl border border-gray-100 p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {a.imageUrl ? <img src={a.imageUrl} alt="" className="w-16 h-10 rounded-xl object-cover" /> : <div className="w-16 h-10 rounded-xl bg-gray-100 flex items-center justify-center"><Megaphone className="w-5 h-5 text-gray-400" /></div>}
                          <div>
                            <p className="text-sm font-bold text-gray-900">{a.title}</p>
                            {a.description && <p className="text-[9px] text-gray-400">{a.description}</p>}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button size="sm" variant="ghost" onClick={() => toggleAd(a.id, a.isActive)} className={`h-7 w-7 p-0 ${a.isActive ? "text-[#1B7A3D]" : "text-gray-300"}`}>{a.isActive ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}</Button>
                          <Button size="sm" variant="ghost" onClick={() => deleteAd(a.id)} className={`h-7 w-7 p-0 ${deleteConfirm === `ad-${a.id}` ? "text-red-500" : "text-gray-300"}`}><Trash2 className="w-3 h-3" /></Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* ═══ TAB: بانرات الشاشة الرئيسية ═══ */}
            {activeTab === "homeBanners" && (
              <motion.div key="homeBanners" variants={sectionVariants} initial="initial" animate="animate" exit="exit" transition={iOSSpring.gentle} className="space-y-4">
                <div className="bg-gradient-to-bl from-[#1B7A3D]/5 to-[#22A24D]/5 rounded-2xl border border-[#1B7A3D]/15 p-3 mb-2">
                  <div className="flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-[#1B7A3D]" />
                    <p className="text-[10px] text-[#1B7A3D] font-bold">البانرات تظهر في الشاشة الرئيسية تحت بطاقة الرصيد مباشرة — يمكنك ترتيبها بالرقم</p>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                  <div className="p-4 border-b border-gray-50">
                    <h3 className="text-sm font-bold text-[#1B7A3D] flex items-center gap-2"><Plus className="w-4 h-4" />إضافة بانر جديد</h3>
                  </div>
                  <div className="p-4 space-y-3">
                    <Input value={newBannerTitle} onChange={e => setNewBannerTitle(e.target.value)} placeholder="عنوان البانر" className="bg-gray-50 border-gray-200 rounded-xl" />
                    <Input value={newBannerDesc} onChange={e => setNewBannerDesc(e.target.value)} placeholder="وصف البانر (اختياري)" className="bg-gray-50 border-gray-200 rounded-xl" />
                    <div>
                      <label className="text-[10px] font-bold text-gray-500 mb-1 block">صورة البانر (ينصح 16:7)</label>
                      <div className="flex items-center gap-3">
                        {newBannerImage && <img src={newBannerImage} alt="" className="w-24 h-10 rounded-xl object-cover" />}
                        <label className="cursor-pointer"><span className="bg-[#E8F5E9] text-[#1B7A3D] text-xs font-bold px-3 py-2 rounded-xl inline-flex items-center gap-1"><Upload className="w-3 h-3" />رفع صورة</span><input type="file" accept="image/*" className="hidden" onChange={handleImageUpload(setNewBannerImage, 512)} /></label>
                      </div>
                    </div>
                    <Input value={newBannerLink} onChange={e => setNewBannerLink(e.target.value)} placeholder="رابط عند الضغط (اختياري)" className="bg-gray-50 border-gray-200 rounded-xl" dir="ltr" />
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-bold text-gray-500 mb-1 block">الترتيب</label>
                        <Input type="number" value={newBannerOrder} onChange={e => setNewBannerOrder(e.target.value)} placeholder="0" className="bg-gray-50 border-gray-200 rounded-xl" />
                      </div>
                    </div>
                    <Button onClick={addHomeBanner} className="w-full bg-[#1B7A3D] hover:bg-[#165E30] text-white font-bold rounded-xl"><Plus className="w-4 h-4 ml-1" />إضافة البانر</Button>
                  </div>
                </div>

                <div className="space-y-2">
                  {Object.entries(allHomeBanners).sort(([, a], [, b]) => (a.order || 0) - (b.order || 0)).map(([id, banner]) => (
                    <div key={id} className="bg-white rounded-2xl border border-gray-100 p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {banner.imageUrl ? (
                            <img src={banner.imageUrl} alt="" className="w-20 h-10 rounded-xl object-cover" />
                          ) : (
                            <div className="w-20 h-10 rounded-xl bg-gray-100 flex items-center justify-center"><ImageIcon className="w-5 h-5 text-gray-400" /></div>
                          )}
                          <div>
                            <p className="text-sm font-bold text-gray-900">{banner.title}</p>
                            {banner.description && <p className="text-[9px] text-gray-400">{banner.description}</p>}
                            <div className="flex items-center gap-2 mt-0.5">
                              <Badge className="text-[8px] bg-gray-100 text-gray-500">ترتيب: {banner.order || 0}</Badge>
                              {banner.linkUrl && <Badge className="text-[8px] bg-blue-50 text-blue-500"><Link className="w-2 h-2 ml-0.5" />رابط</Badge>}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button size="sm" variant="ghost" onClick={() => toggleHomeBanner(id, banner.isActive)} className={`h-7 w-7 p-0 ${banner.isActive ? "text-[#1B7A3D]" : "text-gray-300"}`}>
                            {banner.isActive ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => deleteHomeBanner(id)} className={`h-7 w-7 p-0 ${deleteConfirm === `hb-${id}` ? "text-red-500" : "text-gray-300"}`}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {Object.keys(allHomeBanners).length === 0 && (
                    <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center">
                      <ImageIcon className="w-10 h-10 mx-auto text-gray-200 mb-2" />
                      <p className="text-gray-400 text-sm">لا توجد بانرات بعد</p>
                      <p className="text-[10px] text-gray-300 mt-1">أضف بانر أعلاه ليظهر في الشاشة الرئيسية</p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* ═══ TAB 11: أكواد الهدايا ═══ */}
            {activeTab === "gifts" && (
              <motion.div key="gifts" variants={sectionVariants} initial="initial" animate="animate" exit="exit" transition={iOSSpring.gentle} className="space-y-4">
                {/* Single redeem codes */}
                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                  <div className="p-4 border-b border-gray-50">
                    <h3 className="text-sm font-bold text-[#1B7A3D] flex items-center gap-2"><Hash className="w-4 h-4" />توليد أكواد شحن</h3>
                  </div>
                  <div className="p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <Input type="number" value={redeemCodeAmount} onChange={e => setRedeemCodeAmount(e.target.value)} placeholder="المبلغ (ر.ي)" className="bg-gray-50 border-gray-200 rounded-xl" />
                      <Input type="number" value={redeemCodeCount} onChange={e => setRedeemCodeCount(e.target.value)} placeholder="العدد (1-100)" className="bg-gray-50 border-gray-200 rounded-xl" />
                    </div>
                    <Button onClick={generateRedeemCodes} disabled={isGenerating} className="w-full bg-[#1B7A3D] hover:bg-[#165E30] text-white font-bold rounded-xl">
                      {isGenerating ? <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />جاري التوليد...</span> : <><Plus className="w-4 h-4 ml-1" />توليد الأكواد</>}
                    </Button>
                    {lastGeneratedCodes.length > 0 && (
                      <div className="space-y-1.5 max-h-32 overflow-y-auto">
                        {lastGeneratedCodes.map((c, i) => (
                          <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-gray-50">
                            <span className="text-xs font-mono font-bold text-gray-700" dir="ltr">{c.code}</span>
                            <div className="flex items-center gap-1">
                              <Badge className="bg-[#E8F5E9] text-[#1B7A3D] text-[8px]">{fmt(c.amount)} ر.ي</Badge>
                              <Button size="sm" variant="ghost" onClick={() => copyCode(c.code)} className="h-5 w-5 p-0 text-gray-400"><Copy className="w-3 h-3" /></Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Shared codes */}
                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                  <div className="p-4 border-b border-gray-50">
                    <h3 className="text-sm font-bold text-purple-600 flex items-center gap-2"><Gift className="w-4 h-4" />كود هدية جماعي</h3>
                  </div>
                  <div className="p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <Input type="number" value={sharedCodeAmount} onChange={e => setSharedCodeAmount(e.target.value)} placeholder="المبلغ (ر.ي)" className="bg-gray-50 border-gray-200 rounded-xl" />
                      <Input type="number" value={sharedCodeMaxUses} onChange={e => setSharedCodeMaxUses(e.target.value)} placeholder="أقصى عدد استخدامات" className="bg-gray-50 border-gray-200 rounded-xl" />
                    </div>
                    <Input value={sharedCodeDesc} onChange={e => setSharedCodeDesc(e.target.value)} placeholder="وصف (اختياري)" className="bg-gray-50 border-gray-200 rounded-xl" />
                    <Button onClick={addSharedCode} className="w-full bg-purple-600 text-white font-bold rounded-xl"><Plus className="w-4 h-4 ml-1" />إنشاء كود</Button>
                  </div>
                </div>

                {/* Codes lists */}
                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                  <div className="p-4 border-b border-gray-50">
                    <h3 className="text-sm font-bold text-gray-900">أكواد الشحن ({fmt(redeemCodesList.length)})</h3>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {redeemCodesList.slice(0, 30).map(rc => (
                      <div key={rc.id} className="px-4 py-2.5 border-b border-gray-50 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${rc.isUsed ? "bg-gray-300" : "bg-[#1B7A3D]"}`} />
                          <span className="text-xs font-mono text-gray-700" dir="ltr">{rc.code}</span>
                          <Badge className="text-[8px] bg-gray-100 text-gray-500">{fmt(rc.amount)} ر.ي</Badge>
                          {rc.isUsed && <Badge className="text-[8px] bg-red-100 text-red-500">مستخدم</Badge>}
                        </div>
                        <Button size="sm" variant="ghost" onClick={() => deleteRedeemCode(rc.id, rc.code)} className={`h-6 w-6 p-0 ${deleteConfirm === `rc-${rc.id}` ? "text-red-500" : "text-gray-300"}`}><Trash2 className="w-3 h-3" /></Button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Shared codes list */}
                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                  <div className="p-4 border-b border-gray-50">
                    <h3 className="text-sm font-bold text-gray-900">أكواد الهدايا الجماعية ({fmt(sharedCodesList.length)})</h3>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {sharedCodesList.map(sc => (
                      <div key={sc.id} className="px-4 py-3 border-b border-gray-50">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono font-bold text-gray-700" dir="ltr">{sc.code}</span>
                            <Badge className="text-[8px] bg-purple-100 text-purple-600">{fmt(sc.amount)} ر.ي</Badge>
                            <Badge className="text-[8px] bg-gray-100 text-gray-500">{sc.currentRedemptions}/{sc.maxRedemptions}</Badge>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button size="sm" variant="ghost" onClick={() => toggleSharedCode(sc.id, sc.isActive)} className={`h-6 w-6 p-0 ${sc.isActive ? "text-[#1B7A3D]" : "text-gray-300"}`}>{sc.isActive ? <ToggleRight className="w-3 h-3" /> : <ToggleLeft className="w-3 h-3" />}</Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {/* ═══ TAB 12: العمولات ═══ */}
            {activeTab === "commissions" && (
              <motion.div key="commissions" variants={sectionVariants} initial="initial" animate="animate" exit="exit" transition={iOSSpring.gentle} className="space-y-4">
                {/* Commission settings */}
                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                  <div className="p-4 border-b border-gray-50">
                    <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2"><Banknote className="w-4 h-4 text-[#1B7A3D]" />إعدادات العمولات</h3>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {commSettingsList.map(cs => (
                      <div key={cs.id} className="px-4 py-3 border-b border-gray-50">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs font-bold text-gray-900">{cs.networkName}</p>
                            <p className="text-[9px] text-gray-400">{cs.managerName} • النسبة: {cs.defaultRate}%</p>
                          </div>
                          <Badge className="text-[8px] bg-[#E8F5E9] text-[#1B7A3D]">{cs.defaultRate}%</Badge>
                        </div>
                      </div>
                    ))}
                    {commSettingsList.length === 0 && <div className="p-4 text-center text-xs text-gray-400">لا توجد إعدادات عمولة</div>}
                  </div>
                </div>

                {/* Commission entries */}
                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                  <div className="p-4 border-b border-gray-50">
                    <h3 className="text-sm font-bold text-gray-900">سجلات العمولات ({fmt(commEntriesList.length)})</h3>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {commEntriesList.slice(0, 30).map(ce => (
                      <div key={ce.id} className="px-4 py-3 border-b border-gray-50 flex items-center justify-between">
                        <div>
                          <p className="text-xs font-bold text-gray-900">{ce.networkName} — {ce.managerName}</p>
                          <p className="text-[9px] text-gray-400">{fmt(ce.commissionAmount)} ر.ي عمولة ({ce.commissionRate}%) • {formatDate(ce.soldAt)}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          {ce.isPaid ? (
                            <Badge className="text-[8px] bg-[#E8F5E9] text-[#1B7A3D]">مدفوع</Badge>
                          ) : (
                            <Button size="sm" variant="ghost" onClick={() => markCommissionPaid(ce.id)} className="text-[9px] text-orange-500 hover:text-[#1B7A3D] h-6 px-2">تحديد كمدفوع</Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Payouts */}
                {payoutList.length > 0 && (
                  <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                    <div className="p-4 border-b border-gray-50">
                      <h3 className="text-sm font-bold text-gray-900">المدفوعات الشهرية</h3>
                    </div>
                    <div className="max-h-48 overflow-y-auto">
                      {payoutList.map(p => (
                        <div key={p.id} className="px-4 py-3 border-b border-gray-50 flex items-center justify-between">
                          <div>
                            <p className="text-xs font-bold text-gray-900">{p.networkName} — {p.month}</p>
                            <p className="text-[9px] text-gray-400">{fmt(p.totalCommission)} ر.ي • {p.totalCards} كرت</p>
                          </div>
                          <Badge className={`text-[8px] ${p.status === "paid" ? "bg-[#E8F5E9] text-[#1B7A3D]" : p.status === "pending" ? "bg-orange-100 text-orange-600" : "bg-gray-100 text-gray-500"}`}>{p.status === "paid" ? "مدفوع" : p.status === "pending" ? "معلق" : p.status}</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* ═══ TAB 13: الاشتراكات ═══ */}
            {activeTab === "subscriptions" && (
              <motion.div key="subscriptions" variants={sectionVariants} initial="initial" animate="animate" exit="exit" transition={iOSSpring.gentle} className="space-y-4">
                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                  <div className="p-4 border-b border-gray-50">
                    <h3 className="text-sm font-bold text-[#1B7A3D] flex items-center gap-2"><Plus className="w-4 h-4" />إضافة خطة اشتراك</h3>
                  </div>
                  <div className="p-4 space-y-3">
                    <Input value={newPlanName} onChange={e => setNewPlanName(e.target.value)} placeholder="اسم الخطة" className="bg-gray-50 border-gray-200 rounded-xl" />
                    <div className="grid grid-cols-2 gap-3">
                      <Input type="number" value={newPlanPrice} onChange={e => setNewPlanPrice(e.target.value)} placeholder="السعر (ر.ي)" className="bg-gray-50 border-gray-200 rounded-xl" />
                      <Input type="number" value={newPlanDuration} onChange={e => setNewPlanDuration(e.target.value)} placeholder="المدة (أيام)" className="bg-gray-50 border-gray-200 rounded-xl" />
                    </div>
                    <Input value={newPlanDesc} onChange={e => setNewPlanDesc(e.target.value)} placeholder="الوصف" className="bg-gray-50 border-gray-200 rounded-xl" />
                    <Button onClick={addPlan} className="w-full bg-[#1B7A3D] hover:bg-[#165E30] text-white font-bold rounded-xl"><Plus className="w-4 h-4 ml-1" />إضافة</Button>
                  </div>
                </div>

                {/* Plans list */}
                <div className="space-y-2">
                  {plansList.map(p => (
                    <div key={p.id} className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-bold text-gray-900">{p.name}</p>
                        <p className="text-[9px] text-gray-400">{fmt(p.price)} ر.ي / {p.durationDays} يوم • {p.description}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button size="sm" variant="ghost" onClick={() => togglePlan(p.id, p.isActive)} className={`h-7 w-7 p-0 ${p.isActive ? "text-[#1B7A3D]" : "text-gray-300"}`}>{p.isActive ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}</Button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* User subscriptions */}
                {subsList.length > 0 && (
                  <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                    <div className="p-4 border-b border-gray-50">
                      <h3 className="text-sm font-bold text-gray-900">اشتراكات المستخدمين ({fmt(subsList.length)})</h3>
                    </div>
                    <div className="max-h-48 overflow-y-auto">
                      {subsList.map(s => (
                        <div key={s.id} className="px-4 py-3 border-b border-gray-50">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-xs font-bold text-gray-900">{s.planName}</p>
                              <p className="text-[9px] text-gray-400">{formatDate(s.activatedAt)} — {formatDate(s.expiresAt)}</p>
                            </div>
                            <Badge className={`text-[8px] ${s.isActive ? "bg-[#E8F5E9] text-[#1B7A3D]" : "bg-red-100 text-red-500"}`}>{s.isActive ? "نشط" : "منتهي"}</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* ═══ TAB 14: الإشعارات ═══ */}
            {activeTab === "notifications" && (
              <motion.div key="notifications" variants={sectionVariants} initial="initial" animate="animate" exit="exit" transition={iOSSpring.gentle} className="space-y-4">
                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                  <div className="p-4 border-b border-gray-50">
                    <h3 className="text-sm font-bold text-[#1B7A3D] flex items-center gap-2"><Send className="w-4 h-4" />إرسال إشعار جماعي</h3>
                  </div>
                  <div className="p-4 space-y-3">
                    <Input value={bulkTitle} onChange={e => setBulkTitle(e.target.value)} placeholder="عنوان الإشعار" className="bg-gray-50 border-gray-200 rounded-xl" />
                    <textarea value={bulkMessage} onChange={e => setBulkMessage(e.target.value)} placeholder="نص الإشعار..." className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm min-h-[80px] resize-none" />
                    <Button onClick={sendBulkNotification} disabled={isSendingBulk} className="w-full bg-[#1B7A3D] hover:bg-[#165E30] text-white font-bold rounded-xl">
                      {isSendingBulk ? <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />جاري الإرسال...</span> : <><Send className="w-4 h-4 ml-1" />إرسال للجميع</>}
                    </Button>
                  </div>
                </div>

                {/* Notification history */}
                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                  <div className="p-4 border-b border-gray-50">
                    <h3 className="text-sm font-bold text-gray-900">سجل الإشعارات</h3>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {bulkNotifList.map(n => (
                      <div key={n.id} className="px-4 py-3 border-b border-gray-50">
                        <p className="text-xs font-bold text-gray-900">{n.title}</p>
                        <p className="text-[9px] text-gray-400 mt-0.5">{n.message}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge className="text-[8px] bg-gray-100 text-gray-500">{n.targetCount} مستلم</Badge>
                          <span className="text-[8px] text-gray-300">{formatDate(n.sentAt)}</span>
                        </div>
                      </div>
                    ))}
                    {bulkNotifList.length === 0 && <div className="p-4 text-center text-xs text-gray-400">لا توجد إشعارات مرسلة</div>}
                  </div>
                </div>
              </motion.div>
            )}

            {/* ═══ TAB 15: محتوى التطبيق ═══ */}
            {activeTab === "content" && (
              <motion.div key="content" variants={sectionVariants} initial="initial" animate="animate" exit="exit" transition={iOSSpring.gentle} className="space-y-4">
                {[
                  { key: "privacyPolicy", label: "سياسة الخصوصية", icon: ShieldCheck },
                  { key: "termsOfUse", label: "شروط الاستخدام", icon: FileText },
                  { key: "aboutApp", label: "حول التطبيق", icon: Info },
                  { key: "socialLinks", label: "روابط التواصل الاجتماعي", icon: Link },
                  { key: "ownerInfo", label: "معلومات المالك", icon: UserCog },
                  { key: "contactInfo", label: "معلومات الاتصال", icon: Phone },
                ].map(item => (
                  <div key={item.key} className="bg-white rounded-2xl border border-gray-100 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <item.icon className="w-4 h-4 text-[#1B7A3D]" />
                      <h3 className="text-sm font-bold text-gray-900">{item.label}</h3>
                    </div>
                    <textarea
                      value={appContent[item.key] || ""}
                      onChange={e => setAppContent(prev => ({ ...prev, [item.key]: e.target.value }))}
                      placeholder={`أدخل ${item.label}...`}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm min-h-[80px] resize-none"
                    />
                    <Button size="sm" onClick={() => saveAppContent(item.key, appContent[item.key] || "")} className="mt-2 bg-[#1B7A3D] text-white rounded-xl text-xs"><Save className="w-3 h-3 ml-1" />حفظ</Button>
                  </div>
                ))}
              </motion.div>
            )}

            {/* ═══ TAB: أماكن البيع ═══ */}
            {activeTab === "saleLocations" && (
              <motion.div key="saleLocations" variants={sectionVariants} initial="initial" animate="animate" exit="exit" transition={iOSSpring.gentle} className="space-y-4">
                {/* Add new sale location */}
                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                  <div className="p-4 border-b border-gray-50">
                    <h3 className="text-sm font-bold text-orange-600 flex items-center gap-2"><Store className="w-4 h-4" />إضافة مكان بيع جديد</h3>
                    <p className="text-[10px] text-gray-400 mt-1">بقالات ومحلات تبيع كروت الشبكات</p>
                  </div>
                  <div className="p-4 space-y-3">
                    <Input value={newLocName} onChange={e => setNewLocName(e.target.value)} placeholder="اسم البقالة / المتجر" className="bg-gray-50 border-gray-200 rounded-xl" />
                    <select value={newLocNetworkId} onChange={e => setNewLocNetworkId(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-bold">
                      <option value="">اختر الشبكة</option>
                      {networksList.map(n => <option key={n.id} value={n.id}>{n.emoji} {n.name}</option>)}
                    </select>
                    <div className="grid grid-cols-2 gap-3">
                      <select value={newLocProvinceId} onChange={e => { setNewLocProvinceId(e.target.value); setNewLocDistrict(""); }} className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-bold">
                        <option value="">اختر المحافظة</option>
                        {PROVINCES.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                      <select value={newLocDistrict} onChange={e => setNewLocDistrict(e.target.value)} disabled={!newLocProvinceId} className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-bold disabled:opacity-50">
                        <option value="">{newLocProvinceId ? "اختر المديرية" : "اختر المحافظة أولاً"}</option>
                        {newLocProvinceId && getDistricts(newLocProvinceId).map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                    <Input value={newLocExactLocation} onChange={e => setNewLocExactLocation(e.target.value)} placeholder="العنوان التفصيلي (اختياري)" className="bg-gray-50 border-gray-200 rounded-xl" />
                    <Input value={newLocPhone} onChange={e => setNewLocPhone(e.target.value)} placeholder="رقم الهاتف (اختياري)" className="bg-gray-50 border-gray-200 rounded-xl" dir="ltr" />
                    <Button onClick={addSaleLocation} className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl"><Store className="w-4 h-4 ml-1" />إضافة مكان البيع</Button>
                  </div>
                </div>

                {/* Locations list grouped by network */}
                {Object.keys(saleLocations).length > 0 ? (
                  networksList.filter(n => Object.values(saleLocations).some(l => l.networkId === n.id)).map(net => {
                    const netLocs = Object.entries(saleLocations).filter(([_, l]) => l.networkId === net.id).sort(([_, a], [__, b]) => (b.createdAt || 0) - (a.createdAt || 0));
                    return (
                      <div key={net.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                        <div className="p-4 border-b border-gray-50 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm overflow-hidden" style={{ backgroundColor: (net as Record<string, unknown>).bgColor as string || net.color + "1A" }}>
                              {(net as Record<string, unknown>).imageBase64 ? (
                                <img src={(net as Record<string, unknown>).imageBase64 as string} alt={net.name} className="w-6 h-6 rounded-md object-cover" />
                              ) : (
                                <span>{net.emoji}</span>
                              )}
                            </div>
                            <h3 className="text-sm font-bold text-gray-900">{net.name}</h3>
                          </div>
                          <Badge className="bg-orange-100 text-orange-700 text-[9px]">{netLocs.length} مكان</Badge>
                        </div>
                        <div className="max-h-64 overflow-y-auto">
                          {netLocs.map(([id, loc]) => (
                            <div key={id} className="px-4 py-3 border-b border-gray-50 flex items-center justify-between">
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <div className={`w-2 h-2 rounded-full shrink-0 ${loc.isActive ? "bg-[#1B7A3D]" : "bg-gray-300"}`} />
                                <div className="min-w-0">
                                  <p className="text-xs font-bold text-gray-900 truncate">{loc.name}</p>
                                  <p className="text-[10px] text-gray-400 truncate">{loc.provinceName}{loc.district ? ` - ${loc.district}` : ""}{loc.exactLocation ? ` - ${loc.exactLocation}` : ""}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <Button size="sm" variant="ghost" onClick={() => toggleSaleLocation(id, loc.isActive)} className={`h-7 w-7 p-0 ${loc.isActive ? "text-[#1B7A3D]" : "text-gray-300"}`}><Check className="w-3 h-3" /></Button>
                                <Button size="sm" variant="ghost" onClick={() => deleteSaleLocation(id)} className={`h-7 w-7 p-0 ${deleteConfirm === `sl-${id}` ? "text-red-500" : "text-gray-300"}`}><Trash2 className="w-3 h-3" /></Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
                    <Store className="w-10 h-10 mx-auto text-gray-200 mb-2" />
                    <p className="text-gray-400 text-sm font-bold">لا توجد أماكن بيع مسجلة</p>
                    <p className="text-gray-300 text-[10px] mt-1">يمكنك أو مدير الشبكة إضافة أماكن البيع</p>
                  </div>
                )}
              </motion.div>
            )}

            {/* ═══ TAB 16: الإعدادات ═══ */}
            {activeTab === "settings" && (
              <motion.div key="settings" variants={sectionVariants} initial="initial" animate="animate" exit="exit" transition={iOSSpring.gentle} className="space-y-4">
                {/* WhatsApp */}
                <div className="bg-white rounded-2xl border border-gray-100 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Phone className="w-4 h-4 text-[#1B7A3D]" />
                    <h3 className="text-sm font-bold text-gray-900">رقم الواتساب</h3>
                  </div>
                  <div className="flex gap-2">
                    <Input value={adminWhatsApp} onChange={e => setAdminWhatsApp(e.target.value)} className="bg-gray-50 border-gray-200 rounded-xl" dir="ltr" />
                    <Button onClick={() => saveSettings({ adminWhatsApp })} className="bg-[#1B7A3D] text-white rounded-xl text-xs"><Save className="w-3 h-3" /></Button>
                  </div>
                </div>

                {/* Max balance */}
                <div className="bg-white rounded-2xl border border-gray-100 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Wallet className="w-4 h-4 text-[#1B7A3D]" />
                    <h3 className="text-sm font-bold text-gray-900">سقف الرصيد الأقصى</h3>
                  </div>
                  <div className="flex gap-2">
                    <Input type="number" value={maxBalance || ""} onChange={e => setMaxBalance(Number(e.target.value))} placeholder="0 = بدون سقف" className="bg-gray-50 border-gray-200 rounded-xl" />
                    <Button onClick={() => saveSettings({ maxBalance })} className="bg-[#1B7A3D] text-white rounded-xl text-xs"><Save className="w-3 h-3" /></Button>
                  </div>
                  <p className="text-[9px] text-gray-400 mt-1">0 يعني بدون سقف</p>
                </div>

                {/* Maintenance mode */}
                <div className="bg-white rounded-2xl border border-gray-100 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-orange-500" />
                      <div>
                        <h3 className="text-sm font-bold text-gray-900">وضع الصيانة</h3>
                        <p className="text-[9px] text-gray-400">تعطيل التطبيق مؤقتاً</p>
                      </div>
                    </div>
                    <button onClick={() => { setMaintenanceMode(!maintenanceMode); saveSettings({ maintenanceMode: !maintenanceMode }); }} className={`w-12 h-7 rounded-full transition-colors ${maintenanceMode ? "bg-[#1B7A3D]" : "bg-gray-200"} relative`}>
                      <span className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-all ${maintenanceMode ? "right-0.5" : "right-[22px]"}`} />
                    </button>
                  </div>
                </div>

                {/* Visible sections */}
                <div className="bg-white rounded-2xl border border-gray-100 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Eye className="w-4 h-4 text-[#1B7A3D]" />
                    <h3 className="text-sm font-bold text-gray-900">الأقسام المرئية</h3>
                  </div>
                  <div className="space-y-2">
                    {[
                      { key: "starlink", label: "Starlink" },
                      { key: "sims", label: "شرائح SIM" },
                      { key: "ads", label: "الإعلانات" },
                      { key: "networkSubmission", label: "تقديم شبكة" },
                    ].map(section => (
                      <div key={section.key} className="flex items-center justify-between p-2 rounded-xl bg-gray-50">
                        <span className="text-xs font-bold text-gray-700">{section.label}</span>
                        <button
                          onClick={() => { const val = !hiddenSections[section.key]; update(ref(db, "settings/hiddenSections"), { [section.key]: val }); }}
                          className={`w-10 h-6 rounded-full transition-colors ${hiddenSections[section.key] ? "bg-gray-200" : "bg-[#1B7A3D]"} relative`}
                        >
                          <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${hiddenSections[section.key] ? "right-[18px]" : "right-0.5"}`} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* App Download URL */}
                <div className="bg-white rounded-2xl border border-gray-100 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Download className="w-4 h-4 text-[#1B7A3D]" />
                    <h3 className="text-sm font-bold text-gray-900">رابط تحميل التطبيق</h3>
                  </div>
                  <div className="flex gap-2">
                    <Input value={appDownloadUrl} onChange={e => setAppDownloadUrl(e.target.value)} placeholder="https://play.google.com/store/apps/..." className="bg-gray-50 border-gray-200 rounded-xl" dir="ltr" />
                    <Button onClick={() => saveSettings({ appDownloadUrl })} className="bg-[#1B7A3D] text-white rounded-xl text-xs"><Save className="w-3 h-3" /></Button>
                  </div>
                  <p className="text-[9px] text-gray-400 mt-1">الرابط الذي سيظهر للمستخدمين لتحميل التطبيق</p>
                </div>

                {/* App Version & Update Notification */}
                <div className="bg-white rounded-2xl border border-gray-100 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Smartphone className="w-4 h-4 text-[#1B7A3D]" />
                    <h3 className="text-sm font-bold text-gray-900">إشعار تحديث التطبيق</h3>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="text-[10px] font-bold text-gray-500 mb-1 block">آخر إصدار</label>
                      <div className="flex gap-2">
                        <Input value={latestAppVersion} onChange={e => setLatestAppVersion(e.target.value)} placeholder="2.2.0" className="bg-gray-50 border-gray-200 rounded-xl" dir="ltr" />
                        <Button onClick={() => saveSettings({ latestAppVersion })} className="bg-[#1B7A3D] text-white rounded-xl text-xs"><Save className="w-3 h-3" /></Button>
                      </div>
                      <p className="text-[9px] text-gray-400 mt-1">عند تغييره سيظهر إشعار للمستخدمين بوجود تحديث جديد</p>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-gray-500 mb-1 block">رسالة التحديث</label>
                      <div className="flex gap-2">
                        <Input value={updateMessage} onChange={e => setUpdateMessage(e.target.value)} placeholder="تحديث جديد متاح! قم بالتحديث الآن" className="bg-gray-50 border-gray-200 rounded-xl" />
                        <Button onClick={() => saveSettings({ updateMessage })} className="bg-[#1B7A3D] text-white rounded-xl text-xs"><Save className="w-3 h-3" /></Button>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
