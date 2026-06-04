"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Wifi, Plus, Save, MapPin, Phone,
  BarChart3, Settings, CreditCard, Package, TrendingUp, Hash, Check,
  Copy, Trash2, DollarSign, Wallet, Clock, Pencil, Crown,
  Banknote, Image as ImageIcon, Upload, Store
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { db, auth } from "@/lib/firebase";
import { ref, onValue, get, update, push, set, remove } from "firebase/database";
import { toast } from "sonner";
import { PROVINCES, getDistricts, iOSSpring, formatDate, CARD_TIERS as DEFAULT_TIERS } from "@/lib/constants";
import { compressImageToBase64 } from "@/lib/utils";
import { useLanguage } from "@/context/LanguageContext";
import type { NetworkItem, TierItem, CardItem, CommissionEntry, NetworkTier, CardSaleLocation } from "@/lib/types";

// ─── Helpers ─────────────────────────────────────────────────
function fmt(n: number): string { return n.toLocaleString("en-US"); }

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "AP";
  for (let i = 0; i < 8; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
  return code;
}

const sectionVariants = {
  initial: { opacity: 0, y: 15 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -15 },
};

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════
interface NetworkManagerPanelProps {
  onClose: () => void;
  managedNetwork: string;
}

export function NetworkManagerPanel({ onClose, managedNetwork }: NetworkManagerPanelProps) {
  const { t, isRTL } = useLanguage();

  // Tab definitions (using translation keys)
  const MANAGER_TABS = [
    { id: "overview", icon: BarChart3, labelKey: "manager.overview" },
    { id: "cards", icon: CreditCard, labelKey: "manager.cards" },
    { id: "tiers", icon: Hash, labelKey: "manager.categories" },
    { id: "settings", icon: Settings, labelKey: "manager.settings" },
    { id: "commissions", icon: Banknote, labelKey: "manager.commissions" },
    { id: "saleLocations", icon: Store, labelKey: "manager.saleLocations" },
  ];

  const [activeTab, setActiveTab] = useState("overview");
  const [networkData, setNetworkData] = useState<NetworkItem | null>(null);
  const [cards, setCards] = useState<Record<string, CardItem>>({});
  const [tiers, setTiers] = useState<Record<string, TierItem>>({});
  const [networkTiers, setNetworkTiers] = useState<Record<string, NetworkTier>>({});
  const [commissionEntries, setCommissionEntries] = useState<Record<string, CommissionEntry>>({});
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Card forms
  const [newCardCode, setNewCardCode] = useState("");
  const [newCardPrice, setNewCardPrice] = useState("");
  const [newCardData, setNewCardData] = useState("");
  const [newCardDuration, setNewCardDuration] = useState("");
  const [newCardTier, setNewCardTier] = useState("200");
  const [isAddingBulk, setIsAddingBulk] = useState(false);

  // Bulk codes by script
  const [bulkCodesText, setBulkCodesText] = useState("");
  const [bulkCodesTier, setBulkCodesTier] = useState("200");
  const [bulkCodesCustom, setBulkCodesCustom] = useState(false);
  const [bulkCodesCustomPrice, setBulkCodesCustomPrice] = useState("");
  const [bulkCodesCustomData, setBulkCodesCustomData] = useState("");
  const [bulkCodesCustomDuration, setBulkCodesCustomDuration] = useState("");
  const [isAddingBulkCodes, setIsAddingBulkCodes] = useState(false);
  const [bulkCodesProgress, setBulkCodesProgress] = useState({ done: 0, total: 0 });

  // Tier forms
  const [newNetTierPrice, setNewNetTierPrice] = useState("");
  const [newNetTierData, setNewNetTierData] = useState("");
  const [newNetTierDuration, setNewNetTierDuration] = useState("");
  const [newNetTierIcon, setNewNetTierIcon] = useState("");
  const [editingNetTier, setEditingNetTier] = useState<string | null>(null);
  const [editNetTierPrice, setEditNetTierPrice] = useState("");
  const [editNetTierData, setEditNetTierData] = useState("");
  const [editNetTierDuration, setEditNetTierDuration] = useState("");
  const [editNetTierIcon, setEditNetTierIcon] = useState("");

  // Settings forms
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editProvinceId, setEditProvinceId] = useState("");
  const [editDistrict, setEditDistrict] = useState("");
  const [editExactLocation, setEditExactLocation] = useState("");
  const [editConnectionIP, setEditConnectionIP] = useState("");
  const [networkImage, setNetworkImage] = useState("");
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Sale locations
  const [saleLocations, setSaleLocations] = useState<Record<string, CardSaleLocation>>({});
  const [newLocName, setNewLocName] = useState("");
  const [newLocProvinceId, setNewLocProvinceId] = useState("");
  const [newLocDistrict, setNewLocDistrict] = useState("");
  const [newLocExactLocation, setNewLocExactLocation] = useState("");
  const [newLocPhone, setNewLocPhone] = useState("");

  // ─── Firebase listeners ────────────────────────────────────
  useEffect(() => {
    const unsub = onValue(ref(db, `networks/${managedNetwork}`), (snap) => {
      const data = snap.val();
      if (data) {
        setNetworkData({ id: managedNetwork, ...data });
        setEditName(data.name || "");
        setEditPhone(data.ownerPhone || "");
        setEditProvinceId(data.provinceId || "");
        setEditDistrict(data.district || "");
        setEditExactLocation(data.exactLocation || "");
        setEditConnectionIP(data.connectionIP || "");
        setNetworkImage(data.imageBase64 || "");
      }
    });
    return () => unsub();
  }, [managedNetwork]);

  useEffect(() => {
    const unsub = onValue(ref(db, "cards"), (snap) => {
      const data = snap.val() || {};
      const filtered: Record<string, CardItem> = {};
      Object.entries(data).forEach(([id, val]: [string, unknown]) => {
        const card = val as CardItem;
        if (card.network === managedNetwork) filtered[id] = card;
      });
      setCards(filtered);
    });
    return () => unsub();
  }, [managedNetwork]);

  useEffect(() => {
    const unsub = onValue(ref(db, "tiers"), (snap) => setTiers(snap.val() || {}));
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onValue(ref(db, `networkTiers/${managedNetwork}`), (snap) => {
      setNetworkTiers(snap.val() || {});
    });
    return () => unsub();
  }, [managedNetwork]);

  useEffect(() => {
    const unsub = onValue(ref(db, "commissionEntries"), (snap) => {
      const data = snap.val() || {};
      const filtered: Record<string, CommissionEntry> = {};
      const currentUserUid = auth.currentUser?.uid;
      Object.entries(data).forEach(([id, val]: [string, unknown]) => {
        const ce = val as CommissionEntry;
        if (ce.managerUid === currentUserUid) filtered[id] = ce;
      });
      setCommissionEntries(filtered);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onValue(ref(db, "cardSaleLocations"), (snap) => {
      const data = snap.val() || {};
      const filtered: Record<string, CardSaleLocation> = {};
      Object.entries(data).forEach(([id, val]: [string, unknown]) => {
        const loc = val as CardSaleLocation;
        if (loc.networkId === managedNetwork) filtered[id] = loc;
      });
      setSaleLocations(filtered);
    });
    return () => unsub();
  }, [managedNetwork]);

  // ─── Derived data ──────────────────────────────────────────
  const cardsList = Object.entries(cards).map(([id, val]) => ({ id, ...val }));
  const availableCards = cardsList.filter(c => !c.isUsed);
  const soldCards = cardsList.filter(c => c.isUsed);
  const totalRevenue = soldCards.reduce((sum, c) => sum + (c.price || 0), 0);

  const tiersList = Object.keys(tiers).length > 0
    ? Object.entries(tiers).map(([id, val]) => ({ id, ...val }))
    : DEFAULT_TIERS.map(t => ({ ...t, id: t.tier, createdAt: 0 }));

  const networkTiersList = Object.entries(networkTiers).map(([id, val]) => ({ id, ...val })).sort((a, b) => a.price - b.price);
  const allTiersList = [...tiersList, ...networkTiersList.filter(nt => !tiersList.some(t => t.tier === nt.tier))];

  const commissionEntriesList = Object.entries(commissionEntries).map(([id, val]) => ({ id, ...val }));
  const totalCommission = commissionEntriesList.reduce((sum, c) => sum + (c.commissionAmount || 0), 0);
  const unpaidCommission = commissionEntriesList.filter(c => !c.isPaid).reduce((sum, c) => sum + (c.commissionAmount || 0), 0);

  const currentDistricts = editProvinceId ? getDistricts(editProvinceId) : [];

  // ─── Actions ───────────────────────────────────────────────
  const addCard = async () => {
    if (!newCardCode || !newCardPrice || !newCardData || !newCardDuration) {
      toast.error(t("common.error")); return;
    }
    try {
      const cardRef = push(ref(db, "cards"));
      await set(cardRef, {
        code: newCardCode, price: Number(newCardPrice), data: newCardData,
        duration: Number(newCardDuration), isUsed: false, usedBy: null, usedAt: null,
        tier: newCardTier, network: managedNetwork, createdAt: Date.now(),
      });
      toast.success(t("common.success"));
      setNewCardCode(""); setNewCardPrice(""); setNewCardData(""); setNewCardDuration("");
    } catch { toast.error(t("common.error")); }
  };

  const addBulkCodesByPasting = async () => {
    const codes = bulkCodesText.split("\n").map(c => c.trim()).filter(c => c.length > 0);
    if (codes.length === 0) { toast.error(t("manager.pasteCodes")); return; }

    let price: number, data: string, duration: number, tier: string;

    if (bulkCodesCustom) {
      if (!bulkCodesCustomPrice || !bulkCodesCustomData || !bulkCodesCustomDuration) {
        toast.error(t("common.error")); return;
      }
      price = Number(bulkCodesCustomPrice);
      data = bulkCodesCustomData;
      duration = Number(bulkCodesCustomDuration);
      tier = `${price}-custom`;
    } else {
      if (!bulkCodesTier) { toast.error(t("common.error")); return; }
      const tierInfo = allTiersList.find(t => t.tier === bulkCodesTier);
      if (!tierInfo) { toast.error(t("common.error")); return; }
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
          isUsed: false, usedBy: null, usedAt: null, tier, network: managedNetwork, createdAt: Date.now(),
        });
        added++;
        setBulkCodesProgress({ done: added, total: codes.length });
      }
      toast.success(t("common.success"));
      setBulkCodesText("");
    } catch { toast.error(t("common.error")); }
    setIsAddingBulkCodes(false);
    setBulkCodesProgress({ done: 0, total: 0 });
  };

  const deleteCard = async (id: string) => {
    if (deleteConfirm === id) {
      try { await remove(ref(db, `cards/${id}`)); toast.success(t("common.success")); setDeleteConfirm(null); }
      catch { toast.error(t("common.error")); }
    } else {
      setDeleteConfirm(id);
      setTimeout(() => setDeleteConfirm(null), 3000);
    }
  };

  // Network tier CRUD
  const addNetworkTier = async () => {
    if (!newNetTierPrice || !newNetTierData || !newNetTierDuration) {
      toast.error(t("common.error")); return;
    }
    const price = Number(newNetTierPrice);
    if (isNaN(price) || price <= 0) { toast.error(t("common.error")); return; }
    const tierKey = String(price);
    if (tiersList.find(t => t.tier === tierKey) || networkTiersList.find(t => t.tier === tierKey)) {
      toast.error(t("common.error")); return;
    }
    try {
      const tierRef = push(ref(db, `networkTiers/${managedNetwork}`));
      await set(tierRef, { tier: tierKey, price, data: newNetTierData.trim(), duration: Number(newNetTierDuration), icon: newNetTierIcon || "🟢", networkId: managedNetwork, createdAt: Date.now() });
      toast.success(t("common.success"));
      setNewNetTierPrice(""); setNewNetTierData(""); setNewNetTierDuration(""); setNewNetTierIcon("");
    } catch { toast.error(t("common.error")); }
  };

  const startEditNetTier = (tier: NetworkTier & { id: string }) => {
    setEditingNetTier(tier.id);
    setEditNetTierPrice(String(tier.price));
    setEditNetTierData(tier.data);
    setEditNetTierDuration(String(tier.duration));
    setEditNetTierIcon(tier.icon);
  };

  const saveEditNetTier = async () => {
    if (!editingNetTier || !editNetTierPrice || !editNetTierData || !editNetTierDuration) {
      toast.error(t("common.error")); return;
    }
    const price = Number(editNetTierPrice);
    if (isNaN(price) || price <= 0) { toast.error(t("common.error")); return; }
    try {
      await update(ref(db, `networkTiers/${managedNetwork}/${editingNetTier}`), {
        tier: String(price), price, data: editNetTierData.trim(), duration: Number(editNetTierDuration), icon: editNetTierIcon || "🟢",
      });
      toast.success(t("common.success"));
      setEditingNetTier(null);
    } catch { toast.error(t("common.error")); }
  };

  const deleteNetworkTier = async (tierId: string) => {
    if (deleteConfirm === `nt-${tierId}`) {
      try { await remove(ref(db, `networkTiers/${managedNetwork}/${tierId}`)); toast.success(t("common.success")); setDeleteConfirm(null); }
      catch { toast.error(t("common.error")); }
    } else {
      setDeleteConfirm(`nt-${tierId}`);
      setTimeout(() => setDeleteConfirm(null), 3000);
    }
  };

  // Save settings
  const saveSettings = async () => {
    setIsSavingSettings(true);
    try {
      const provinceObj = PROVINCES.find(p => p.id === editProvinceId);
      await update(ref(db, `networks/${managedNetwork}`), {
        name: editName.trim() || null,
        ownerPhone: editPhone.trim() || null,
        provinceId: editProvinceId || null,
        provinceName: provinceObj?.name || null,
        district: editDistrict || null,
        exactLocation: editExactLocation.trim() || null,
        connectionIP: editConnectionIP.trim() || null,
        location: editDistrict || provinceObj?.name || null,
        imageBase64: networkImage || null,
      });
      toast.success(t("common.success"));
    } catch { toast.error(t("common.error")); }
    setIsSavingSettings(false);
  };

  // Copy code
  const copyCode = async (code: string) => {
    try { await navigator.clipboard.writeText(code); toast.success(t("common.success")); }
    catch { toast.error(t("common.error")); }
  };

  // Sale locations actions
  const addSaleLocation = async () => {
    if (!newLocName || !newLocProvinceId) {
      toast.error(t("common.error"));
      return;
    }
    try {
      const provinceObj = PROVINCES.find(p => p.id === newLocProvinceId);
      const locRef = push(ref(db, "cardSaleLocations"));
      await set(locRef, {
        networkId: managedNetwork,
        networkName: networkData?.name || "",
        name: newLocName.trim(),
        provinceId: newLocProvinceId,
        provinceName: provinceObj?.name || "",
        district: newLocDistrict || "",
        exactLocation: newLocExactLocation.trim(),
        phone: newLocPhone.trim() || null,
        isActive: true,
        createdAt: Date.now(),
      });
      toast.success(t("common.success"));
      setNewLocName(""); setNewLocProvinceId(""); setNewLocDistrict(""); setNewLocExactLocation(""); setNewLocPhone("");
    } catch { toast.error(t("common.error")); }
  };

  const deleteSaleLocation = async (id: string) => {
    if (deleteConfirm === `sl-${id}`) {
      try { await remove(ref(db, `cardSaleLocations/${id}`)); toast.success(t("common.success")); setDeleteConfirm(null); }
      catch { toast.error(t("common.error")); }
    } else {
      setDeleteConfirm(`sl-${id}`);
      setTimeout(() => setDeleteConfirm(null), 3000);
    }
  };

  const toggleSaleLocation = async (id: string, currentActive: boolean) => {
    try {
      await update(ref(db, `cardSaleLocations/${id}`), { isActive: !currentActive });
      toast.success(t("common.success"));
    } catch { toast.error(t("common.error")); }
  };

  // ─── RENDER ────────────────────────────────────────────────
  return (
    <motion.div
      initial={{ opacity: 0, y: "100%" }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: "100%" }}
      transition={iOSSpring.gentle}
      className="fixed inset-0 z-50 bg-white overflow-hidden flex flex-col"
      dir={isRTL ? "rtl" : "ltr"}
    >
      {/* ─── Top Bar ─── */}
      <div className="flex-shrink-0 bg-white border-b border-gray-100 shadow-sm">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center overflow-hidden" style={{ backgroundColor: networkData?.bgColor || "#E8F5E9" }}>
              {networkData?.imageBase64 ? (
                <img src={networkData.imageBase64} alt="" className="w-full h-full object-cover rounded-lg" />
              ) : (
                <span className="text-sm">{networkData?.emoji || "📶"}</span>
              )}
            </div>
            <div>
              <h1 className="text-sm font-black text-gray-900">{networkData?.name || t("manager.overview")}</h1>
              <p className="text-[9px] text-blue-500 font-bold flex items-center gap-1"><Crown className="w-2.5 h-2.5" />{t("common.networkManager")}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="text-gray-400 hover:text-gray-600 rounded-xl">
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* ─── Tab Bar ─── */}
        <div className="px-4 pb-2 flex gap-2 overflow-x-auto no-scrollbar">
          {MANAGER_TABS.map(tab => (
            <motion.button
              key={tab.id}
              whileTap={{ scale: 0.95 }}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                activeTab === tab.id
                  ? "bg-blue-500 text-white shadow-md"
                  : "bg-gray-50 text-gray-500 hover:bg-gray-100"
              }`}
            >
              <tab.icon className="w-3 h-3" />{t(tab.labelKey)}
            </motion.button>
          ))}
        </div>
      </div>

      {/* ─── Content Area ─── */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-4 pb-8">
          <AnimatePresence mode="wait">

            {/* ═══ TAB 1: Overview ═══ */}
            {activeTab === "overview" && (
              <motion.div key="overview" variants={sectionVariants} initial="initial" animate="animate" exit="exit" transition={iOSSpring.gentle} className="space-y-4">
                {/* Network hero card */}
                <div className="rounded-2xl p-4 relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${networkData?.color || "#3B82F6"}, ${networkData?.color || "#3B82F6"}CC)` }}>
                  <div className="absolute -top-6 -right-6 w-24 h-24 bg-white/10 rounded-full" />
                  <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-white/5 rounded-full" />
                  <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-4">
                      {networkData?.imageBase64 ? (
                        <img src={networkData.imageBase64} alt={networkData?.name} className="w-14 h-14 rounded-xl object-cover" />
                      ) : (
                        <div className="w-14 h-14 rounded-xl bg-white/20 flex items-center justify-center text-3xl">{networkData?.emoji || "📶"}</div>
                      )}
                      <div>
                        <h3 className="text-lg font-black text-white">{networkData?.name}</h3>
                        <div className="flex items-center gap-3 mt-0.5">
                          {networkData?.location && <span className="text-[10px] text-white/70 flex items-center gap-0.5"><MapPin className="w-3 h-3" />{networkData.location}</span>}
                          {networkData?.ownerPhone && <span className="text-[10px] text-white/70 flex items-center gap-0.5"><Phone className="w-3 h-3" />{networkData.ownerPhone}</span>}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-white/15 rounded-xl p-2.5 text-center">
                        <p className="text-xl font-black text-white">{fmt(availableCards.length)}</p>
                        <p className="text-[9px] text-white/60">{t("manager.availableCards")}</p>
                      </div>
                      <div className="bg-white/15 rounded-xl p-2.5 text-center">
                        <p className="text-xl font-black text-white">{fmt(soldCards.length)}</p>
                        <p className="text-[9px] text-white/60">{t("manager.soldCards")}</p>
                      </div>
                      <div className="bg-white/15 rounded-xl p-2.5 text-center">
                        <p className="text-lg font-black text-yellow-300">{fmt(totalRevenue)}</p>
                        <p className="text-[9px] text-white/60">{t("manager.totalCollection")}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Commission info */}
                {totalCommission > 0 && (
                  <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                    <div className="p-4 border-b border-gray-50">
                      <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2"><Wallet className="w-4 h-4 text-green-500" />{t("manager.commissions")}</h3>
                    </div>
                    <div className="p-4 space-y-2">
                      <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50">
                        <span className="text-xs font-bold text-gray-600">{t("manager.totalCollection")}</span>
                        <span className="text-sm font-black text-green-600">{fmt(totalCommission)} ر.ي</span>
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50">
                        <span className="text-xs font-bold text-gray-600">{t("manager.commissions")}</span>
                        <span className="text-sm font-black text-orange-600">{fmt(unpaidCommission)} ر.ي</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Cards by tier */}
                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                  <div className="p-4 border-b border-gray-50">
                    <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2"><Package className="w-4 h-4 text-blue-500" />{t("manager.cards")}</h3>
                  </div>
                  <div className="p-4 space-y-2">
                    {allTiersList.sort((a, b) => a.price - b.price).map(tier => {
                      const tierCards = cardsList.filter(c => c.tier === tier.tier);
                      const available = tierCards.filter(c => !c.isUsed).length;
                      const sold = tierCards.filter(c => c.isUsed).length;
                      return (
                        <div key={tier.tier} className="flex items-center justify-between p-3 rounded-xl bg-gray-50">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{tier.icon}</span>
                            <div>
                              <p className="text-sm font-bold text-gray-900">{fmt(tier.price)} ر.ي</p>
                              <p className="text-[10px] text-gray-400">{tier.data} / {tier.duration}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <Badge className="bg-blue-50 text-blue-600 text-[9px]">{available} {t("networkDetail.available")}</Badge>
                            <Badge className="bg-[#E8F5E9] text-[#1B7A3D] text-[9px]">{sold} {t("networkDetail.sold")}</Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Recent sold */}
                {soldCards.length > 0 && (
                  <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                    <div className="p-4 border-b border-gray-50">
                      <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-[#1B7A3D]" />{t("manager.soldCards")}</h3>
                    </div>
                    <div className="max-h-48 overflow-y-auto">
                      {soldCards.slice(0, 10).map(card => (
                        <div key={card.id} className="px-4 py-2.5 border-b border-gray-50 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono text-gray-400" dir="ltr">{card.code.substring(0, 8)}...</span>
                            <Badge className="bg-gray-100 text-gray-500 text-[9px]">{card.tier} ر.ي</Badge>
                          </div>
                          <span className="text-[9px] text-gray-300">{card.usedAt ? formatDate(card.usedAt) : ""}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* ═══ TAB 2: Cards ═══ */}
            {activeTab === "cards" && (
              <motion.div key="cards" variants={sectionVariants} initial="initial" animate="animate" exit="exit" transition={iOSSpring.gentle} className="space-y-4">
                {/* Add single card */}
                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                  <div className="p-4 border-b border-gray-50">
                    <h3 className="text-sm font-bold text-blue-600 flex items-center gap-2"><Plus className="w-4 h-4" />{t("manager.addManualCard")}</h3>
                  </div>
                  <div className="p-4 space-y-3">
                    <Input value={newCardCode} onChange={e => setNewCardCode(e.target.value)} placeholder={t("manager.cardCode")} className="bg-gray-50 border-gray-200 rounded-xl" />
                    <div className="grid grid-cols-2 gap-3">
                      <Input type="number" value={newCardPrice} onChange={e => setNewCardPrice(e.target.value)} placeholder={t("manager.price")} className="bg-gray-50 border-gray-200 rounded-xl" />
                      <Input value={newCardData} onChange={e => setNewCardData(e.target.value)} placeholder={t("manager.data")} className="bg-gray-50 border-gray-200 rounded-xl" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Input type="number" value={newCardDuration} onChange={e => setNewCardDuration(e.target.value)} placeholder={t("manager.duration")} className="bg-gray-50 border-gray-200 rounded-xl" />
                      <select value={newCardTier} onChange={e => setNewCardTier(e.target.value)} className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-bold">
                        {allTiersList.sort((a, b) => a.price - b.price).map(t => <option key={t.tier} value={t.tier}>{t.icon} {fmt(t.price)} ر.ي</option>)}
                      </select>
                    </div>
                    <Button onClick={addCard} className="w-full bg-blue-500 text-white font-bold rounded-xl"><Plus className="w-4 h-4 ml-1" />{t("manager.addCard")}</Button>
                  </div>
                </div>

                {/* Bulk codes by script */}
                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                  <div className="p-4 border-b border-gray-50">
                    <h3 className="text-sm font-bold text-orange-500 flex items-center gap-2"><Hash className="w-4 h-4" />{t("manager.addByScript")}</h3>
                    <p className="text-[10px] text-gray-400 mt-1">{t("manager.pasteCodes")}</p>
                  </div>
                  <div className="p-4 space-y-3">
                    <textarea
                      value={bulkCodesText}
                      onChange={e => setBulkCodesText(e.target.value)}
                      placeholder={"5046464494\n4649149649\n7136494613"}
                      rows={6}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-mono focus:border-blue-500 focus:ring-blue-500 outline-none resize-y"
                      dir="ltr"
                    />
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
                        {allTiersList.sort((a, b) => a.price - b.price).map(t => <option key={t.tier} value={t.tier}>{t.icon} {fmt(t.price)} ر.ي — {t.data} / {t.duration}</option>)}
                        <option value="custom">{t("manager.customCategory")}...</option>
                      </select>
                    </div>
                    {bulkCodesCustom && (
                      <div className="grid grid-cols-3 gap-3">
                        <Input type="number" value={bulkCodesCustomPrice} onChange={e => setBulkCodesCustomPrice(e.target.value)} placeholder={t("manager.price")} className="bg-gray-50 border-gray-200 rounded-xl" />
                        <Input value={bulkCodesCustomData} onChange={e => setBulkCodesCustomData(e.target.value)} placeholder={t("manager.data")} className="bg-gray-50 border-gray-200 rounded-xl" />
                        <Input type="number" value={bulkCodesCustomDuration} onChange={e => setBulkCodesCustomDuration(e.target.value)} placeholder={t("manager.duration")} className="bg-gray-50 border-gray-200 rounded-xl" />
                      </div>
                    )}
                    <div className="bg-blue-50 rounded-xl p-2.5 flex items-center gap-2">
                      <Wifi className="w-4 h-4 text-blue-500" />
                      <span className="text-xs text-blue-700 font-bold">{t("manager.network")}: {networkData?.name || managedNetwork}</span>
                    </div>
                    {isAddingBulkCodes && bulkCodesProgress.total > 0 && (
                      <div className="bg-orange-50 rounded-xl px-3 py-2 text-center">
                        <p className="text-xs font-bold text-orange-600">
                          {bulkCodesProgress.done} / {bulkCodesProgress.total} {t("manager.card")}
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
                        <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />{t("manager.adding")}</span>
                      ) : (
                        <><Hash className="w-4 h-4 ml-1" />{t("manager.addCard")} ({bulkCodesText.split("\n").filter(c => c.trim()).length} {t("manager.card")})</>
                      )}
                    </Button>
                  </div>
                </div>

                {/* Cards list */}
                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                  <div className="p-4 border-b border-gray-50 flex items-center justify-between">
                    <h3 className="text-sm font-bold text-gray-900">{t("manager.cards")} ({fmt(cardsList.length)})</h3>
                    <div className="flex gap-2">
                      <Badge className="text-[9px] bg-[#E8F5E9] text-[#1B7A3D]">{availableCards.length} {t("networkDetail.available")}</Badge>
                      <Badge className="text-[9px] bg-gray-100 text-gray-500">{soldCards.length} {t("networkDetail.sold")}</Badge>
                    </div>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {cardsList.slice(0, 50).map(c => (
                      <div key={c.id} className="px-4 py-2.5 border-b border-gray-50 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${c.isUsed ? "bg-red-400" : "bg-[#1B7A3D]"}`} />
                          <span className="text-xs font-mono text-gray-700" dir="ltr">{c.code.substring(0, 12)}</span>
                          <Badge className="text-[8px] bg-gray-100 text-gray-500">{c.tier} ر.ي</Badge>
                          {c.isUsed && <Badge className="text-[8px] bg-red-100 text-red-500">{t("networkDetail.sold")}</Badge>}
                        </div>
                        {!c.isUsed && (
                          <Button size="sm" variant="ghost" onClick={() => deleteCard(c.id)} className={`h-6 w-6 p-0 ${deleteConfirm === c.id ? "text-red-500" : "text-gray-300"}`}><Trash2 className="w-3 h-3" /></Button>
                        )}
                      </div>
                    ))}
                    {cardsList.length > 50 && <div className="p-3 text-center text-[10px] text-gray-400">{t("manager.andMore")} {fmt(cardsList.length - 50)} {t("manager.card")}...</div>}
                  </div>
                </div>
              </motion.div>
            )}

            {/* ═══ TAB 3: Categories ═══ */}
            {activeTab === "tiers" && (
              <motion.div key="tiers" variants={sectionVariants} initial="initial" animate="animate" exit="exit" transition={iOSSpring.gentle} className="space-y-4">
                {/* Add custom tier */}
                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                  <div className="p-4 border-b border-gray-50">
                    <h3 className="text-sm font-bold text-blue-600 flex items-center gap-2"><Plus className="w-4 h-4" />{t("manager.addCustomCategory")}</h3>
                  </div>
                  <div className="p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <Input type="number" value={newNetTierPrice} onChange={e => setNewNetTierPrice(e.target.value)} placeholder={t("manager.priceYER")} className="bg-gray-50 border-gray-200 rounded-xl" />
                      <Input value={newNetTierData} onChange={e => setNewNetTierData(e.target.value)} placeholder={t("manager.data")} className="bg-gray-50 border-gray-200 rounded-xl" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Input type="number" value={newNetTierDuration} onChange={e => setNewNetTierDuration(e.target.value)} placeholder={t("manager.duration")} className="bg-gray-50 border-gray-200 rounded-xl" />
                      <Input value={newNetTierIcon} onChange={e => setNewNetTierIcon(e.target.value)} placeholder="🟢" className="bg-gray-50 border-gray-200 rounded-xl" />
                    </div>
                    <Button onClick={addNetworkTier} className="w-full bg-blue-500 text-white font-bold rounded-xl"><Plus className="w-4 h-4 ml-1" />{t("manager.addCategory")}</Button>
                  </div>
                </div>

                {/* Global tiers (read-only) */}
                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                  <div className="p-4 border-b border-gray-50">
                    <h3 className="text-sm font-bold text-gray-500 flex items-center gap-2"><Hash className="w-4 h-4" />{t("manager.generalCategories")}</h3>
                  </div>
                  <div className="p-4 space-y-2">
                    {tiersList.sort((a, b) => a.price - b.price).map(t => (
                      <div key={t.id || t.tier} className="flex items-center justify-between p-3 rounded-xl bg-gray-50">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{t.icon}</span>
                          <div>
                            <p className="text-sm font-bold text-gray-900">{fmt(t.price)} ر.ي</p>
                            <p className="text-[10px] text-gray-400">{t.data} / {t.duration}</p>
                          </div>
                        </div>
                        <Badge className="text-[8px] bg-gray-200 text-gray-500">{t("manager.generalCategory")}</Badge>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Custom tiers */}
                {networkTiersList.length > 0 && (
                  <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                    <div className="p-4 border-b border-gray-50">
                      <h3 className="text-sm font-bold text-blue-600">{t("manager.customCategories")} ({networkTiersList.length})</h3>
                    </div>
                    <div className="p-4 space-y-2">
                      {networkTiersList.map(t => (
                        <div key={t.id} className="p-3 rounded-xl bg-blue-50">
                          {editingNetTier === t.id ? (
                            <div className="space-y-2">
                              <div className="grid grid-cols-2 gap-2">
                                <Input type="number" value={editNetTierPrice} onChange={e => setEditNetTierPrice(e.target.value)} placeholder={t("manager.price")} className="bg-white border-gray-200 rounded-xl text-sm" />
                                <Input value={editNetTierData} onChange={e => setEditNetTierData(e.target.value)} placeholder={t("manager.data")} className="bg-white border-gray-200 rounded-xl text-sm" />
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <Input type="number" value={editNetTierDuration} onChange={e => setEditNetTierDuration(e.target.value)} placeholder={t("manager.duration")} className="bg-white border-gray-200 rounded-xl text-sm" />
                                <Input value={editNetTierIcon} onChange={e => setEditNetTierIcon(e.target.value)} placeholder="🟢" className="bg-white border-gray-200 rounded-xl text-sm" />
                              </div>
                              <div className="flex gap-2">
                                <Button size="sm" onClick={saveEditNetTier} className="bg-blue-500 text-white rounded-xl text-xs"><Save className="w-3 h-3 ml-1" />{t("common.save")}</Button>
                                <Button size="sm" variant="ghost" onClick={() => setEditingNetTier(null)} className="rounded-xl text-xs">{t("common.cancel")}</Button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-lg">{t.icon}</span>
                                <div>
                                  <p className="text-sm font-bold text-gray-900">{fmt(t.price)} ر.ي</p>
                                  <p className="text-[10px] text-gray-400">{t.data} / {t.duration}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                <Button size="sm" variant="ghost" onClick={() => startEditNetTier(t as NetworkTier & { id: string })} className="h-7 w-7 p-0 text-blue-400 hover:text-blue-600"><Pencil className="w-3 h-3" /></Button>
                                <Button size="sm" variant="ghost" onClick={() => deleteNetworkTier(t.id)} className={`h-7 w-7 p-0 ${deleteConfirm === `nt-${t.id}` ? "text-red-500" : "text-gray-300"}`}><Trash2 className="w-3 h-3" /></Button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* ═══ TAB 4: Settings ═══ */}
            {activeTab === "settings" && (
              <motion.div key="settings" variants={sectionVariants} initial="initial" animate="animate" exit="exit" transition={iOSSpring.gentle} className="space-y-4">
                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                  <div className="p-4 border-b border-gray-50">
                    <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2"><Settings className="w-4 h-4 text-gray-500" />{t("manager.settings")}</h3>
                  </div>
                  <div className="p-4 space-y-3">
                    {/* Network icon */}
                    <div>
                      <label className="text-[10px] font-bold text-gray-500 mb-1 block">{t("network.networkIcon")}</label>
                      <div className="flex items-center gap-3">
                        {networkImage ? (
                          <img src={networkImage} alt="" className="w-14 h-14 rounded-xl object-cover" />
                        ) : (
                          <div className="w-14 h-14 rounded-xl bg-gray-100 flex items-center justify-center"><ImageIcon className="w-6 h-6 text-gray-400" /></div>
                        )}
                        <label className="cursor-pointer">
                          <span className="bg-blue-50 text-blue-600 text-xs font-bold px-3 py-2 rounded-xl inline-flex items-center gap-1"><Upload className="w-3 h-3" />{t("network.uploadImage")}</span>
                          <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            try {
                              const base64 = await compressImageToBase64(file, 128, 0.6);
                              setNetworkImage(base64);
                              await update(ref(db, `networks/${managedNetwork}`), { imageBase64: base64 });
                              toast.success(t("common.success"));
                            } catch { toast.error(t("common.error")); }
                          }} />
                        </label>
                      </div>
                    </div>

                    <Input value={editName} onChange={e => setEditName(e.target.value)} placeholder={t("network.networkName")} className="bg-gray-50 border-gray-200 rounded-xl" />
                    <Input value={editPhone} onChange={e => setEditPhone(e.target.value)} placeholder={t("network.phoneNumber")} className="bg-gray-50 border-gray-200 rounded-xl" dir="ltr" />
                    <div className="grid grid-cols-2 gap-3">
                      <select value={editProvinceId} onChange={e => { setEditProvinceId(e.target.value); setEditDistrict(""); }} className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-bold">
                        <option value="">{t("network.province")}</option>
                        {PROVINCES.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                      <select value={editDistrict} onChange={e => setEditDistrict(e.target.value)} className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-bold">
                        <option value="">{t("network.district")}</option>
                        {currentDistricts.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                    <Input value={editExactLocation} onChange={e => setEditExactLocation(e.target.value)} placeholder={t("network.exactLocation")} className="bg-gray-50 border-gray-200 rounded-xl" />
                    <Input value={editConnectionIP} onChange={e => setEditConnectionIP(e.target.value)} placeholder="IP" className="bg-gray-50 border-gray-200 rounded-xl" dir="ltr" />

                    <Button onClick={saveSettings} disabled={isSavingSettings} className="w-full bg-blue-500 text-white font-bold rounded-xl">
                      {isSavingSettings ? <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />{t("common.loading")}</span> : <><Save className="w-4 h-4 ml-1" />{t("common.save")}</>}
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ═══ TAB 5: Commissions ═══ */}
            {activeTab === "commissions" && (
              <motion.div key="commissions" variants={sectionVariants} initial="initial" animate="animate" exit="exit" transition={iOSSpring.gentle} className="space-y-4">
                {/* Summary */}
                <div className="bg-white rounded-2xl border border-gray-100 p-4">
                  <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2 mb-3"><Wallet className="w-4 h-4 text-green-500" />{t("manager.commissions")}</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-green-50 rounded-xl p-3 text-center">
                      <p className="text-lg font-black text-green-600">{fmt(totalCommission)}</p>
                      <p className="text-[9px] text-green-500">{t("manager.totalCollection")} (ر.ي)</p>
                    </div>
                    <div className="bg-orange-50 rounded-xl p-3 text-center">
                      <p className="text-lg font-black text-orange-600">{fmt(unpaidCommission)}</p>
                      <p className="text-[9px] text-orange-500">(ر.ي)</p>
                    </div>
                  </div>
                </div>

                {/* Commission entries */}
                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                  <div className="p-4 border-b border-gray-50">
                    <h3 className="text-sm font-bold text-gray-900">{t("manager.commissions")} ({fmt(commissionEntriesList.length)})</h3>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {commissionEntriesList.map(ce => (
                      <div key={ce.id} className="px-4 py-3 border-b border-gray-50">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs font-bold text-gray-900">{fmt(ce.commissionAmount)} ر.ي</p>
                            <p className="text-[9px] text-gray-400">{ce.cardTier} ر.ي • {ce.commissionRate}% • {formatDate(ce.soldAt)}</p>
                          </div>
                          <Badge className={`text-[8px] ${ce.isPaid ? "bg-[#E8F5E9] text-[#1B7A3D]" : "bg-orange-100 text-orange-600"}`}>
                            {ce.isPaid ? "✓" : "..."}
                          </Badge>
                        </div>
                      </div>
                    ))}
                    {commissionEntriesList.length === 0 && <div className="p-4 text-center text-xs text-gray-400">—</div>}
                  </div>
                </div>
              </motion.div>
            )}

            {/* ═══ TAB: Sale Locations ═══ */}
            {activeTab === "saleLocations" && (
              <motion.div key="saleLocations" variants={sectionVariants} initial="initial" animate="animate" exit="exit" transition={iOSSpring.gentle} className="space-y-4">
                {/* Add new location */}
                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                  <div className="p-4 border-b border-gray-50">
                    <h3 className="text-sm font-bold text-orange-600 flex items-center gap-2"><Store className="w-4 h-4" />{t("manager.saleLocations")}</h3>
                  </div>
                  <div className="p-4 space-y-3">
                    <Input value={newLocName} onChange={e => setNewLocName(e.target.value)} placeholder={t("manager.saleLocations")} className="bg-gray-50 border-gray-200 rounded-xl" />
                    <div className="grid grid-cols-2 gap-3">
                      <select value={newLocProvinceId} onChange={e => { setNewLocProvinceId(e.target.value); setNewLocDistrict(""); }} className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-bold">
                        <option value="">{t("network.selectProvince")}</option>
                        {PROVINCES.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                      <select value={newLocDistrict} onChange={e => setNewLocDistrict(e.target.value)} disabled={!newLocProvinceId} className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-bold disabled:opacity-50">
                        <option value="">{newLocProvinceId ? t("network.selectDistrict") : t("network.selectProvinceFirst")}</option>
                        {newLocProvinceId && getDistricts(newLocProvinceId).map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                    <Input value={newLocExactLocation} onChange={e => setNewLocExactLocation(e.target.value)} placeholder={t("network.exactLocation")} className="bg-gray-50 border-gray-200 rounded-xl" />
                    <Input value={newLocPhone} onChange={e => setNewLocPhone(e.target.value)} placeholder={t("network.phoneNumber")} className="bg-gray-50 border-gray-200 rounded-xl" dir="ltr" />
                    <Button onClick={addSaleLocation} className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl"><Store className="w-4 h-4 ml-1" />{t("manager.saleLocations")}</Button>
                  </div>
                </div>

                {/* Existing locations list */}
                {Object.keys(saleLocations).length > 0 && (
                  <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                    <div className="p-4 border-b border-gray-50 flex items-center justify-between">
                      <h3 className="text-sm font-bold text-gray-900">{t("manager.saleLocations")} ({Object.keys(saleLocations).length})</h3>
                      <Badge className="bg-orange-100 text-orange-700 text-[9px]">{Object.values(saleLocations).filter(l => l.isActive).length}</Badge>
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                      {Object.entries(saleLocations).map(([id, loc]) => (
                        <div key={id} className="px-4 py-3 border-b border-gray-50 flex items-center justify-between">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <div className={`w-2 h-2 rounded-full shrink-0 ${loc.isActive ? "bg-[#1B7A3D]" : "bg-gray-300"}`} />
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-gray-900 truncate">{loc.name}</p>
                              <p className="text-[10px] text-gray-400 truncate">{loc.provinceName}{loc.district ? ` - ${loc.district}` : ""}</p>
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
                )}
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
