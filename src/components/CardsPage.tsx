"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Wifi, Check, Copy, Clock, Wallet, MapPin, Phone, ChevronDown, Globe, Building2, X, Search, RefreshCw, ArrowDown, Ticket, Sparkles, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { db } from "@/lib/firebase";
import { ref, onValue, runTransaction, update, push, set, get } from "firebase/database";
import { toast } from "sonner";
import { CARD_TIERS as DEFAULT_TIERS, NETWORKS as DEFAULT_NETWORKS, checkRateLimit, PROVINCES, getDistricts, generateWhatsAppLink } from "@/lib/constants";
import { normalizeCode, sanitizeInput } from "@/lib/utils";
import { NetworkDetailModal } from "@/components/NetworkDetailModal";
import type { CardItem, NetworkItem, TierItem, CommissionSetting } from "@/lib/types";
import type { User } from "firebase/auth";
import { useLanguage } from "@/context/LanguageContext";

interface CardsPageProps {
  user: User | null;
  onAuthClick: () => void;
}

// Tier color map for the card machine visual
const TIER_VISUAL_COLORS: Record<string, { bg: string; border: string; text: string; gradient: string }> = {
  "200": { bg: "bg-emerald-50", border: "border-emerald-300", text: "text-emerald-700", gradient: "from-emerald-400 to-emerald-600" },
  "300": { bg: "bg-sky-50", border: "border-sky-300", text: "text-sky-700", gradient: "from-sky-400 to-sky-600" },
  "500": { bg: "bg-amber-50", border: "border-amber-300", text: "text-amber-700", gradient: "from-amber-400 to-amber-600" },
  "1000": { bg: "bg-red-50", border: "border-red-300", text: "text-red-700", gradient: "from-red-400 to-red-600" },
  "2000": { bg: "bg-purple-50", border: "border-purple-300", text: "text-purple-700", gradient: "from-purple-400 to-purple-600" },
};

function getTierVisual(tier: string) {
  return TIER_VISUAL_COLORS[tier] || { bg: "bg-gray-50", border: "border-gray-300", text: "text-gray-700", gradient: "from-gray-400 to-gray-600" };
}

interface PurchasedCardInfo {
  code: string;
  price: number;
  data: string;
  duration: number;
  networkName: string;
}

// Card status lifecycle labels
const CARD_STATUS_CONFIG: Record<string, { labelKey: string; color: string }> = {
  ready:    { labelKey: "cards2.statusAvailable", color: "bg-emerald-100 text-emerald-700" },
  active:   { labelKey: "cards2.statusUsed",      color: "bg-sky-100 text-sky-700" },
  expired:  { labelKey: "cards2.statusExpired",    color: "bg-gray-100 text-gray-500" },
  archived: { labelKey: "cards2.statusArchived",   color: "bg-gray-100 text-gray-400" },
};

export function CardsPage({ user, onAuthClick }: CardsPageProps) {
  const { t, isRTL } = useLanguage();

  const [cards, setCards] = useState<CardItem[]>([]);
  const [selectedProvince, setSelectedProvince] = useState<string | null>(null);
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [purchasingTier, setPurchasingTier] = useState<string | null>(null); // "networkId-tier"
  const [userBalance, setUserBalance] = useState(0);
  const [copiedCode, setCopiedCode] = useState(false);
  const [purchasedCard, setPurchasedCard] = useState<PurchasedCardInfo | null>(null);
  const purchaseAttemptsRef = useRef<number[]>([]);

  // Pull-to-refresh state
  const [refreshing, setRefreshing] = useState(false);
  const [pullY, setPullY] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const touchStartY = useRef(0);

  // Network filter chip
  const [selectedNetworkFilter, setSelectedNetworkFilter] = useState<string | null>(null);

  // Network detail modal
  const [detailNetwork, setDetailNetwork] = useState<NetworkItem | null>(null);

  // Dynamic networks & tiers from Firebase
  const [fbNetworks, setFbNetworks] = useState<NetworkItem[]>(DEFAULT_NETWORKS.map(n => ({ ...n, ownerId: null, ownerName: null, ownerPhone: null, location: null, provinceId: null, provinceName: null, district: null, exactLocation: null, connectionIP: null, createdAt: 0 })));
  const [fbTiers, setFbTiers] = useState<TierItem[]>(DEFAULT_TIERS.map(t => ({ ...t, id: t.tier, createdAt: 0 })));

  // User's province from Firebase
  const [userProvinceId, setUserProvinceId] = useState<string | null>(null);

  // Derive districts from selected province
  const fbDistricts = useMemo(() => {
    if (selectedProvince) {
      return getDistricts(selectedProvince);
    }
    return [];
  }, [selectedProvince]);

  // ===== Listeners =====

  useEffect(() => {
    const unsub = onValue(ref(db, "cards"), (snap) => {
      const data = snap.val();
      setCards(data ? Object.entries(data).map(([id, val]: [string, unknown]) => ({ id, ...(val as Record<string, unknown>) })) as CardItem[] : []);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (user) {
      const unsub = onValue(ref(db, `credit/${user.uid}/amount`), (snap) => setUserBalance(snap.val() || 0));
      return () => unsub();
    }
  }, [user]);

  // Load user's province from Firebase and auto-select it
  useEffect(() => {
    if (user) {
      get(ref(db, `users/${user.uid}/provinceId`)).then((snap) => {
        const provId = snap.val();
        if (provId) {
          setUserProvinceId(provId);
          setSelectedProvince(provId);
        }
      });
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      const unsub = onValue(ref(db, `security/${user.uid}/purchaseAttempts`), (snap) => {
        const data = snap.val();
        if (data) purchaseAttemptsRef.current = Object.values(data) as number[];
      });
      return () => unsub();
    }
  }, [user]);

  useEffect(() => {
    const unsub = onValue(ref(db, "networks"), (snap) => {
      const data = snap.val();
      if (data) {
        setFbNetworks(Object.entries(data).map(([id, val]: [string, unknown]) => ({ id, ...(val as Record<string, unknown>) })) as NetworkItem[]);
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onValue(ref(db, "tiers"), (snap) => {
      const data = snap.val();
      if (data) {
        setFbTiers(Object.entries(data).map(([id, val]: [string, unknown]) => ({ id, ...(val as Record<string, unknown>) })) as TierItem[]);
      }
    });
    return () => unsub();
  }, []);

  // ===== Computed data =====

  const availableCards = useMemo(() => cards.filter(c => !c.isUsed && (c as Record<string, unknown>).status !== "expired" && (c as Record<string, unknown>).status !== "archived"), [cards]);

  // Filter networks by province AND district AND search AND network filter chip
  const filteredNetworks = useMemo(() => {
    let nets = fbNetworks;
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      nets = nets.filter(n => n.name.toLowerCase().includes(q));
    }
    if (selectedProvince) {
      nets = nets.filter(n => n.provinceId === selectedProvince);
    }
    if (selectedDistrict) {
      nets = nets.filter(n => n.district === selectedDistrict);
    }
    if (selectedNetworkFilter) {
      nets = nets.filter(n => n.id === selectedNetworkFilter);
    }
    return nets;
  }, [fbNetworks, selectedProvince, selectedDistrict, searchQuery, selectedNetworkFilter]);

  // Count available cards for a given network+tier
  const availableCount = (networkId: string, tier: string): number => {
    return availableCards.filter(c => c.network === networkId && c.tier === tier).length;
  };

  // Get tiers that have at least one card in a network (including sold-out tiers that belong to that network)
  const getTiersForNetwork = (networkId: string) => {
    // Find all tiers that have cards in this network
    const tierKeysWithCards = new Set(
      availableCards.filter(c => c.network === networkId).map(c => c.tier)
    );
    // Return matching tier definitions sorted by price
    return fbTiers
      .filter(t => tierKeysWithCards.has(t.tier))
      .sort((a, b) => a.price - b.price);
  };

  // ===== Purchase handler =====

  const handleBuyTier = async (networkId: string, tier: string) => {
    if (!user) { onAuthClick(); return; }

    const rateCheck = checkRateLimit(purchaseAttemptsRef.current, 5, 60000);
    if (!rateCheck.allowed) {
      toast.error(t("cards2.rateLimited"));
      return;
    }

    const tierKey = `${networkId}-${tier}`;
    if (purchasingTier) return;

    setPurchasingTier(tierKey);
    toast.info(t("cards2.processing"));

    try {
      // 1. Get all available cards for this network+tier
      const cardsSnap = await get(ref(db, "cards"));
      const allCards = cardsSnap.val() as Record<string, CardItem> | null;
      if (!allCards) {
        toast.error(t("cards2.noCardsInCategory"));
        setPurchasingTier(null);
        return;
      }

      const available = Object.entries(allCards)
        .filter(([_, c]) => {
          if (c.network !== networkId || c.tier !== tier || c.isUsed) return false;
          // Respect card status lifecycle
          const status = (c as Record<string, unknown>).status;
          if (status === "expired" || status === "archived") return false;
          return true;
        })
        .map(([id, c]) => ({ id, ...c }));

      if (available.length === 0) {
        toast.error(t("cards2.noCardsInCategory"));
        setPurchasingTier(null);
        return;
      }

      // 2. Pick random card
      const randomCard = available[Math.floor(Math.random() * available.length)];
      const cardPrice = randomCard.price;

      // 3. Atomically mark card as used (and set status to "active")
      const cardRef = ref(db, `cards/${randomCard.id}`);
      const cardResult = await runTransaction(cardRef, (current) => {
        if (!current || current.isUsed) return; // abort
        current.isUsed = true;
        current.usedBy = user.uid;
        current.usedAt = Date.now();
        current.status = "active";
        return current;
      });

      if (!cardResult.committed) {
        toast.error(t("cards2.cardAlreadyBought"));
        setPurchasingTier(null);
        return;
      }

      // 4. Deduct balance atomically — run on amount field ONLY to avoid history validation issues
      const amountRef = ref(db, `credit/${user.uid}/amount`);
      const creditResult = await runTransaction(amountRef, (currentAmount) => {
        const bal = (currentAmount || 0) as number;
        if (bal < cardPrice) return; // abort - insufficient balance
        return bal - cardPrice;
      });

      if (!creditResult.committed) {
        // Rollback card
        await update(ref(db, `cards/${randomCard.id}`), { isUsed: false, usedBy: null, usedAt: null, status: "ready" });
        toast.error(t("cards2.insufficientBalance"));
        setPurchasingTier(null);
        return;
      }

      // Update the updatedAt timestamp separately
      await update(ref(db, `credit/${user.uid}`), { updatedAt: Date.now() });

      // 5. Create commission entry
      const networkInfo = fbNetworks.find(n => n.id === networkId);
      if (networkInfo?.ownerId) {
        try {
          const commSnap = await get(ref(db, "commissionSettings"));
          const commData = commSnap.val() as Record<string, CommissionSetting> | null;
          if (commData) {
            const setting = Object.values(commData).find(s => s.networkId === networkId);
            if (setting) {
              let rate = setting.defaultRate;
              // Check tier-specific rate
              if (setting.tierRates && setting.tierRates[tier]) rate = setting.tierRates[tier];
              // Check district-specific rate
              if (setting.districtRates && networkInfo.district && setting.districtRates[networkInfo.district]) rate = setting.districtRates[networkInfo.district];
              // Check province-specific rate
              if (setting.provinceRates && networkInfo.provinceId && setting.provinceRates[networkInfo.provinceId]) rate = setting.provinceRates[networkInfo.provinceId];

              const commissionAmount = Math.round(cardPrice * rate / 100);
              const now = new Date();
              const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

              const commRef = push(ref(db, "commissionEntries"));
              await set(commRef, {
                managerUid: networkInfo.ownerId,
                managerName: networkInfo.ownerName || "",
                networkId: networkId,
                networkName: networkInfo.name,
                cardId: randomCard.id,
                cardTier: tier,
                cardPrice: cardPrice,
                commissionRate: rate,
                commissionAmount: commissionAmount,
                provinceId: networkInfo.provinceId || "",
                provinceName: networkInfo.provinceName || "",
                district: networkInfo.district || "",
                soldAt: Date.now(),
                month: monthKey,
                isPaid: false,
                paidAt: null,
              });
            }
          }
        } catch (commErr) {
          console.error("Commission error (non-blocking):", commErr);
        }
      }

      // 6. Record purchase attempt, add to history, create order, notify
      const networkName = networkInfo?.name || "Network";

      // Security: log attempt
      const attemptRef = push(ref(db, `security/${user.uid}/purchaseAttempts`));
      await set(attemptRef, Date.now());

      // Credit history
      const histRef = push(ref(db, `credit/${user.uid}/history`));
      await set(histRef, {
        type: "purchase",
        amount: cardPrice,
        description: `شراء كرت ${randomCard.data} - ${randomCard.duration} ${t("cards2.days")} - ${networkName}`,
        date: Date.now(),
      });

      // Create order
      const orderRef = push(ref(db, "orders"));
      await set(orderRef, {
        userId: user.uid,
        cardId: randomCard.id,
        cardCode: randomCard.code,
        price: cardPrice,
        network: networkId,
        networkName,
        paymentMethod: "balance",
        status: "completed",
        createdAt: Date.now(),
      });

      // Notification
      const notifRef = push(ref(db, `notifications/${user.uid}`));
      await set(notifRef, {
        type: "general",
        title: "تم شراء الكرت بنجاح ✅",
        message: `تم شراء كرت ${randomCard.data} - ${randomCard.duration} ${t("cards2.days")} من ${networkName} بقيمة ${cardPrice} ر.ي`,
        isRead: false,
        createdAt: Date.now(),
      });

      // 7. Show success with card code
      setPurchasedCard({
        code: randomCard.code,
        price: cardPrice,
        data: randomCard.data,
        duration: randomCard.duration,
        networkName: networkName,
      });
      toast.success("تم الشراء بنجاح! 🎉");

    } catch (error) {
      console.error("Purchase error:", error);
      toast.error(t("cards2.purchaseError"));
    }
    setPurchasingTier(null);
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    toast.success(t("cards2.codeCopied"));
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // Pull-to-refresh handlers
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const el = document.getElementById("app-content");
    if (el && el.scrollTop <= 0) {
      touchStartY.current = e.touches[0].clientY;
      setIsPulling(true);
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isPulling) return;
    const el = document.getElementById("app-content");
    if (el && el.scrollTop > 0) {
      setIsPulling(false);
      setPullY(0);
      return;
    }
    const diff = e.touches[0].clientY - touchStartY.current;
    if (diff > 0) {
      setPullY(Math.min(diff * 0.4, 100));
    }
  }, [isPulling]);

  const handleTouchEnd = useCallback(() => {
    if (pullY >= 60 && !refreshing) {
      setRefreshing(true);
      setTimeout(() => {
        setRefreshing(false);
        setPullY(0);
        setIsPulling(false);
      }, 1200);
    } else {
      setPullY(0);
      setIsPulling(false);
    }
  }, [pullY, refreshing]);

  // Networks that actually have available cards (for the filter chips)
  const networksWithCards = useMemo(() => {
    return fbNetworks.filter(net => availableCards.some(c => c.network === net.id));
  }, [fbNetworks, availableCards]);

  // Filtered networks for display (after province/district/search/network-filter)
  const displayNetworks = useMemo(() => {
    return filteredNetworks.filter(net => availableCards.some(c => c.network === net.id));
  }, [filteredNetworks, availableCards]);

  // Split networks into nearby and all (when user has a province)
  const nearbyNetworks = useMemo(() => {
    if (!userProvinceId) return [];
    return displayNetworks.filter(n => n.provinceId === userProvinceId);
  }, [displayNetworks, userProvinceId]);

  const otherNetworks = useMemo(() => {
    if (!userProvinceId) return displayNetworks;
    return displayNetworks.filter(n => n.provinceId !== userProvinceId);
  }, [displayNetworks, userProvinceId]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ type: "spring", stiffness: 120, damping: 14 }}
      className="relative"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull-to-refresh indicator */}
      <motion.div
        className="flex items-center justify-center py-2 overflow-hidden"
        animate={{ height: pullY > 0 || refreshing ? (refreshing ? 44 : pullY * 0.5) : 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
      >
        <motion.div
          animate={{ rotate: refreshing ? 360 : 0 }}
          transition={{ repeat: refreshing ? Infinity : 0, duration: 0.8, ease: "linear" }}
        >
          <RefreshCw className={`w-5 h-5 ${refreshing ? "text-[#1B7A3D]" : "text-gray-300"}`} />
        </motion.div>
        {pullY > 30 && !refreshing && (
          <span className="text-[10px] text-gray-400 mr-2">
            <ArrowDown className="w-3 h-3 inline" /> {t("cards2.pullToRefresh")}
          </span>
        )}
        {refreshing && <span className="text-[10px] text-[#1B7A3D] mr-2 font-bold">{t("cards2.refreshing")}</span>}
      </motion.div>

      <div className="px-4 pt-4">

      {/* Header */}
      <div className="bg-gradient-to-br from-[#E6F9EE] to-[#F0FFF4] rounded-2xl p-4 mb-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xl font-black text-gray-900 flex items-center gap-2">
            <Wifi className="w-6 h-6 text-[#1B7A3D]" />{t("cards2.title")}
          </h2>
          <Badge className="bg-[#1B7A3D] text-white">{availableCards.length} {t("cards2.available")}</Badge>
        </div>
        {user && (
          <div className="flex items-center gap-2 mt-2 bg-white rounded-xl px-3 py-2">
            <Wallet className="w-4 h-4 text-[#1B7A3D]" />
            <span className="text-sm text-gray-500">{t("cards2.yourBalance")}</span>
            <span className="text-sm font-black text-[#1B7A3D]">{userBalance.toLocaleString()} ر.ي</span>
          </div>
        )}
      </div>

      {/* ===== Search ===== */}
      <div className="mb-3">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(sanitizeInput(e.target.value))}
            placeholder={t("cards2.searchNetwork")}
            className="w-full bg-white rounded-xl pr-10 pl-4 py-2.5 text-sm text-gray-900 font-bold border border-gray-200 focus:border-[#1B7A3D] focus:ring-1 focus:ring-[#1B7A3D]/30 outline-none transition-all"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* ===== Network Filter Chips ===== */}
      {networksWithCards.length > 1 && (
        <div className="mb-3">
          <p className="text-xs font-bold text-gray-400 mb-2 flex items-center gap-1">
            <Wifi className="w-3 h-3" />{t("cards2.network")}
          </p>
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            <button
              onClick={() => setSelectedNetworkFilter(null)}
              className={`px-3 py-1.5 rounded-xl text-[10px] font-bold whitespace-nowrap transition-all ${!selectedNetworkFilter ? "bg-[#1B7A3D] text-white btn-green-shadow" : "bg-white text-gray-500 card-shadow"}`}
            >
              {t("cards2.all")}
            </button>
            {networksWithCards.map(net => {
              const count = availableCards.filter(c => c.network === net.id).length;
              return (
                <button
                  key={net.id}
                  onClick={() => setSelectedNetworkFilter(selectedNetworkFilter === net.id ? null : net.id)}
                  className={`px-3 py-1.5 rounded-xl text-[10px] font-bold whitespace-nowrap transition-all flex items-center gap-1 ${
                    selectedNetworkFilter === net.id ? "text-white shadow-md" : "bg-white text-gray-500 card-shadow"
                  }`}
                  style={selectedNetworkFilter === net.id ? { backgroundColor: net.color } : undefined}
                >
                  <span className="text-xs">{net.emoji}</span>
                  {net.name}
                  <span className="opacity-60">({count})</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ===== Province Filter ===== */}
      <div className="mb-3">
        <p className="text-xs font-bold text-gray-400 mb-2 flex items-center gap-1">
          <Globe className="w-3 h-3" />{t("cards2.province")}
        </p>
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          <button
            onClick={() => { setSelectedProvince(null); setSelectedDistrict(null); }}
            className={`px-3 py-1.5 rounded-xl text-[10px] font-bold whitespace-nowrap transition-all ${!selectedProvince ? "bg-[#1B7A3D] text-white btn-green-shadow" : "bg-white text-gray-500 card-shadow"}`}
          >
            {t("cards2.all")}
          </button>
          {PROVINCES.map(province => {
            const count = fbNetworks.filter(n => n.provinceId === province.id).length;
            if (count === 0 && selectedProvince !== province.id) return null;
            return (
              <button
                key={province.id}
                onClick={() => {
                  if (selectedProvince === province.id) {
                    setSelectedProvince(null);
                    setSelectedDistrict(null);
                  } else {
                    setSelectedProvince(province.id);
                    setSelectedDistrict(null);
                  }
                }}
                className={`px-3 py-1.5 rounded-xl text-[10px] font-bold whitespace-nowrap transition-all ${
                  selectedProvince === province.id ? "bg-orange-500 text-white shadow-md" : "bg-white text-gray-500 card-shadow"
                }`}
              >
                🏛️ {province.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* ===== District Filter (only when province selected) ===== */}
      <AnimatePresence>
        {selectedProvince && fbDistricts.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="mb-3 overflow-hidden"
          >
            <p className="text-xs font-bold text-gray-400 mb-2 flex items-center gap-1">
              <Building2 className="w-3 h-3" />{t("cards2.district")}
            </p>
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
              <button
                onClick={() => setSelectedDistrict(null)}
                className={`px-3 py-1.5 rounded-xl text-[10px] font-bold whitespace-nowrap transition-all ${!selectedDistrict ? "bg-[#1B7A3D] text-white btn-green-shadow" : "bg-white text-gray-500 card-shadow"}`}
              >
                {t("cards2.all")}
              </button>
              {fbDistricts.map(d => {
                const count = fbNetworks.filter(n => n.provinceId === selectedProvince && n.district === d).length;
                if (count === 0 && selectedDistrict !== d) return null;
                return (
                  <button
                    key={d}
                    onClick={() => setSelectedDistrict(selectedDistrict === d ? null : d)}
                    className={`px-3 py-1.5 rounded-xl text-[10px] font-bold whitespace-nowrap transition-all ${
                      selectedDistrict === d ? "bg-red-500 text-white shadow-md" : "bg-white text-gray-500 card-shadow"
                    }`}
                  >
                    📍 {d}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===== Card Machines ===== */}
      {displayNetworks.length === 0 ? (
        <div className="bg-white rounded-2xl card-shadow p-8 text-center mt-4">
          <Wifi className="w-12 h-12 mx-auto text-gray-200 mb-3" />
          <p className="text-gray-400 text-sm">{t("cards2.noCards")}</p>
        </div>
      ) : userProvinceId && nearbyNetworks.length > 0 ? (
        <div className="space-y-4 pb-4">
          {/* Nearby Networks */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-lg bg-[#E8F5E9] flex items-center justify-center">
                <MapPin className="w-3 h-3 text-[#1B7A3D]" />
              </div>
              <h3 className="text-sm font-black text-[#1B7A3D]">{t("cards2.nearYou")}</h3>
              <Badge className="bg-[#E8F5E9] text-[#1B7A3D] text-[9px]">{nearbyNetworks.length} {t("cards2.network")}</Badge>
            </div>
            <div className="space-y-4">
              {nearbyNetworks.map(net => {
                const tiersForNetwork = getTiersForNetwork(net.id);
                const totalAvailable = availableCards.filter(c => c.network === net.id).length;
                return (
                  <motion.div
                    key={net.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ type: "spring", stiffness: 200, damping: 20 }}
                    className="bg-white rounded-2xl card-shadow overflow-hidden border-r-4 border-[#1B7A3D]"
                  >
                    <div className="p-4 relative overflow-hidden" style={{ backgroundColor: net.bgColor || (net.color + "15") }}>
                      <div className="absolute -top-4 -left-4 w-20 h-20 rounded-full opacity-10" style={{ backgroundColor: net.color }} />
                      <div className="absolute -bottom-2 -right-2 w-14 h-14 rounded-full opacity-10" style={{ backgroundColor: net.color }} />
                      <div className="relative flex items-start gap-3">
                        <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shadow-sm shrink-0" style={{ backgroundColor: net.color + "25" }}>
                          {(net as Record<string, unknown>).imageBase64 ? <img src={(net as Record<string, unknown>).imageBase64 as string} className="w-12 h-12 rounded-xl object-cover" alt={net.name} /> : <span>{net.emoji}</span>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-base font-black" style={{ color: net.color }}>{net.name}</h3>
                          <div className="flex flex-wrap items-center gap-1.5 mt-1">
                            {net.provinceName && <span className="inline-flex items-center gap-0.5 text-[10px] font-bold bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-md"><Globe className="w-2.5 h-2.5" />{net.provinceName}</span>}
                            {net.district && <span className="inline-flex items-center gap-0.5 text-[10px] font-bold bg-red-100 text-red-700 px-1.5 py-0.5 rounded-md"><MapPin className="w-2.5 h-2.5" />{net.district}</span>}
                            {net.ownerPhone && <a href={generateWhatsAppLink(net.ownerPhone, `مرحباً، أريد شراء كروت ${net.name}`)} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-0.5 text-[10px] font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded-md hover:bg-green-100 transition-colors"><Phone className="w-2.5 h-2.5" />{t("cards2.whatsapp")}</a>}
                          </div>
                          <div className="flex items-center gap-2 mt-1.5">
                            <Badge className="text-[9px] h-5" style={{ backgroundColor: net.color + "20", color: net.color }}>{totalAvailable} {t("cards2.available")}</Badge>
                            <button onClick={(e) => { e.stopPropagation(); setDetailNetwork(net); }} className="w-6 h-6 rounded-full bg-white/50 flex items-center justify-center hover:bg-white/80 transition-colors"><Info className="w-3 h-3" style={{ color: net.color }} /></button>
                          </div>
                        </div>
                      </div>
                      <div className="relative mt-3 flex items-center gap-2">
                        <div className="h-px flex-1" style={{ backgroundColor: net.color + "30" }} />
                        <span className="text-[9px] font-black tracking-wider" style={{ color: net.color + "80" }}>🏧 {t("cards2.cardMachine")}</span>
                        <div className="h-px flex-1" style={{ backgroundColor: net.color + "30" }} />
                      </div>
                    </div>
                    <div className="p-3 space-y-2">
                      {tiersForNetwork.map(tier => {
                        const count = availableCount(net.id, tier.tier);
                        const visual = getTierVisual(tier.tier);
                        const tierKey = `${net.id}-${tier.tier}`;
                        const isPurchasing = purchasingTier === tierKey;
                        const canAfford = userBalance >= tier.price;
                        return (
                          <div key={tier.tier} className={`flex items-center justify-between rounded-xl p-3 transition-all ${visual.bg} ${count === 0 ? "opacity-50" : ""}`}>
                            <div className="flex items-center gap-2">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br ${visual.gradient} text-white shadow-sm shrink-0`}><span className="text-xs font-black">{tier.price}</span></div>
                              <div>
                                <p className="text-sm font-bold text-gray-900">{tier.data}</p>
                                <div className="flex items-center gap-2 text-[10px] text-gray-400"><span className="flex items-center gap-0.5"><Clock className="w-2.5 h-2.5" />{tier.duration} {t("cards2.days")}</span><span>{tier.icon} {t("cards2.category")} {tier.price} ر.ي</span></div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge className={`text-[9px] h-5 ${count > 0 ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-400"}`}>{count} {t("cards2.available")}</Badge>
                              <span className={`font-black text-sm ${canAfford ? "text-[#1B7A3D]" : "text-red-400"}`}>{tier.price} ر.ي</span>
                              <Button onClick={() => handleBuyTier(net.id, tier.tier)} disabled={count === 0 || isPurchasing || !!purchasingTier || !canAfford} className="bg-gradient-to-l from-[#1B7A3D] to-[#22A24D] text-white font-bold rounded-xl h-9 px-4 text-xs btn-green-shadow disabled:opacity-50 disabled:cursor-not-allowed">{isPurchasing ? "⏳" : !canAfford ? "💸" : t("cards2.buy")}</Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Other Networks Divider */}
          {otherNetworks.length > 0 && (
            <div>
              <div className="flex items-center gap-3 my-2">
                <div className="h-px flex-1 bg-gray-200" />
                <span className="text-xs font-bold text-gray-400 flex items-center gap-1">
                  <Wifi className="w-3 h-3" />{t("cards2.allNetworks")}
                </span>
                <div className="h-px flex-1 bg-gray-200" />
              </div>
              <div className="space-y-4">
                {otherNetworks.map(net => {
                  const tiersForNetwork = getTiersForNetwork(net.id);
                  const totalAvailable = availableCards.filter(c => c.network === net.id).length;
                  return (
                    <motion.div
                      key={net.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ type: "spring", stiffness: 200, damping: 20 }}
                      className="bg-white rounded-2xl card-shadow overflow-hidden"
                    >
                      <div className="p-4 relative overflow-hidden" style={{ backgroundColor: net.bgColor || (net.color + "15") }}>
                        <div className="absolute -top-4 -left-4 w-20 h-20 rounded-full opacity-10" style={{ backgroundColor: net.color }} />
                        <div className="absolute -bottom-2 -right-2 w-14 h-14 rounded-full opacity-10" style={{ backgroundColor: net.color }} />
                        <div className="relative flex items-start gap-3">
                          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shadow-sm shrink-0" style={{ backgroundColor: net.color + "25" }}>
                            {(net as Record<string, unknown>).imageBase64 ? <img src={(net as Record<string, unknown>).imageBase64 as string} className="w-12 h-12 rounded-xl object-cover" alt={net.name} /> : <span>{net.emoji}</span>}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-base font-black" style={{ color: net.color }}>{net.name}</h3>
                            <div className="flex flex-wrap items-center gap-1.5 mt-1">
                              {net.provinceName && <span className="inline-flex items-center gap-0.5 text-[10px] font-bold bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-md"><Globe className="w-2.5 h-2.5" />{net.provinceName}</span>}
                              {net.district && <span className="inline-flex items-center gap-0.5 text-[10px] font-bold bg-red-100 text-red-700 px-1.5 py-0.5 rounded-md"><MapPin className="w-2.5 h-2.5" />{net.district}</span>}
                              {net.ownerPhone && <a href={generateWhatsAppLink(net.ownerPhone, `مرحباً، أريد شراء كروت ${net.name}`)} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-0.5 text-[10px] font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded-md hover:bg-green-100 transition-colors"><Phone className="w-2.5 h-2.5" />{t("cards2.whatsapp")}</a>}
                            </div>
                            <div className="flex items-center gap-2 mt-1.5">
                              <Badge className="text-[9px] h-5" style={{ backgroundColor: net.color + "20", color: net.color }}>{totalAvailable} {t("cards2.available")}</Badge>
                              <button onClick={(e) => { e.stopPropagation(); setDetailNetwork(net); }} className="w-6 h-6 rounded-full bg-white/50 flex items-center justify-center hover:bg-white/80 transition-colors"><Info className="w-3 h-3" style={{ color: net.color }} /></button>
                            </div>
                          </div>
                        </div>
                        <div className="relative mt-3 flex items-center gap-2">
                          <div className="h-px flex-1" style={{ backgroundColor: net.color + "30" }} />
                          <span className="text-[9px] font-black tracking-wider" style={{ color: net.color + "80" }}>🏧 {t("cards2.cardMachine")}</span>
                          <div className="h-px flex-1" style={{ backgroundColor: net.color + "30" }} />
                        </div>
                      </div>
                      <div className="p-3 space-y-2">
                        {tiersForNetwork.map(tier => {
                          const count = availableCount(net.id, tier.tier);
                          const visual = getTierVisual(tier.tier);
                          const tierKey = `${net.id}-${tier.tier}`;
                          const isPurchasing = purchasingTier === tierKey;
                          const canAfford = userBalance >= tier.price;
                          return (
                            <div key={tier.tier} className={`flex items-center justify-between rounded-xl p-3 transition-all ${visual.bg} ${count === 0 ? "opacity-50" : ""}`}>
                              <div className="flex items-center gap-2">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br ${visual.gradient} text-white shadow-sm shrink-0`}><span className="text-xs font-black">{tier.price}</span></div>
                                <div>
                                  <p className="text-sm font-bold text-gray-900">{tier.data}</p>
                                  <div className="flex items-center gap-2 text-[10px] text-gray-400"><span className="flex items-center gap-0.5"><Clock className="w-2.5 h-2.5" />{tier.duration} {t("cards2.days")}</span><span>{tier.icon} {t("cards2.category")} {tier.price} ر.ي</span></div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge className={`text-[9px] h-5 ${count > 0 ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-400"}`}>{count} {t("cards2.available")}</Badge>
                                <span className={`font-black text-sm ${canAfford ? "text-[#1B7A3D]" : "text-red-400"}`}>{tier.price} ر.ي</span>
                                <Button onClick={() => handleBuyTier(net.id, tier.tier)} disabled={count === 0 || isPurchasing || !!purchasingTier || !canAfford} className="bg-gradient-to-l from-[#1B7A3D] to-[#22A24D] text-white font-bold rounded-xl h-9 px-4 text-xs btn-green-shadow disabled:opacity-50 disabled:cursor-not-allowed">{isPurchasing ? "⏳" : !canAfford ? "💸" : t("cards2.buy")}</Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4 pb-4">
          {displayNetworks.map(net => {
            const tiersForNetwork = getTiersForNetwork(net.id);
            const totalAvailable = availableCards.filter(c => c.network === net.id).length;

            return (
              <motion.div
                key={net.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 200, damping: 20 }}
                className="bg-white rounded-2xl card-shadow overflow-hidden"
              >
                {/* Machine Header - colored bar with network info */}
                <div
                  className="p-4 relative overflow-hidden"
                  style={{ backgroundColor: net.bgColor || (net.color + "15") }}
                >
                  {/* Decorative circles */}
                  <div className="absolute -top-4 -left-4 w-20 h-20 rounded-full opacity-10" style={{ backgroundColor: net.color }} />
                  <div className="absolute -bottom-2 -right-2 w-14 h-14 rounded-full opacity-10" style={{ backgroundColor: net.color }} />

                  <div className="relative flex items-start gap-3">
                    {/* Network emoji / image */}
                    <div
                      className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shadow-sm shrink-0"
                      style={{ backgroundColor: net.color + "25" }}
                    >
                      {(net as Record<string, unknown>).imageBase64 ? (
                        <img
                          src={(net as Record<string, unknown>).imageBase64 as string}
                          className="w-12 h-12 rounded-xl object-cover"
                          alt={net.name}
                        />
                      ) : (
                        <span>{net.emoji}</span>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-black" style={{ color: net.color }}>{net.name}</h3>

                      {/* Location info */}
                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        {net.provinceName && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-bold bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-md">
                            <Globe className="w-2.5 h-2.5" />{net.provinceName}
                          </span>
                        )}
                        {net.district && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-bold bg-red-100 text-red-700 px-1.5 py-0.5 rounded-md">
                            <MapPin className="w-2.5 h-2.5" />{net.district}
                          </span>
                        )}
                        {net.exactLocation && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-bold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-md">
                            📍 {net.exactLocation}
                          </span>
                        )}
                        {net.connectionIP && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-bold bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-md" dir="ltr">
                            <Globe className="w-2.5 h-2.5" />{net.connectionIP}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 mt-1.5">
                        <Badge className="text-[9px] h-5" style={{ backgroundColor: net.color + "20", color: net.color }}>
                          {totalAvailable} {t("cards2.available")}
                        </Badge>
                        <button onClick={(e) => { e.stopPropagation(); setDetailNetwork(net); }} className="w-6 h-6 rounded-full bg-white/50 flex items-center justify-center hover:bg-white/80 transition-colors"><Info className="w-3 h-3" style={{ color: net.color }} /></button>
                        {net.ownerPhone && (
                          <a
                            href={generateWhatsAppLink(net.ownerPhone, `مرحباً، أريد شراء كروت ${net.name}`)}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-0.5 text-[10px] font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded-md hover:bg-green-100 transition-colors"
                          >
                            <Phone className="w-2.5 h-2.5" />{t("cards2.whatsapp")}
                          </a>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* ATM label */}
                  <div className="relative mt-3 flex items-center gap-2">
                    <div className="h-px flex-1" style={{ backgroundColor: net.color + "30" }} />
                    <span className="text-[9px] font-black tracking-wider" style={{ color: net.color + "80" }}>
                      🏧 {t("cards2.cardMachine")}
                    </span>
                    <div className="h-px flex-1" style={{ backgroundColor: net.color + "30" }} />
                  </div>
                </div>

                {/* Machine Body - Tiers */}
                <div className="p-3 space-y-2">
                  {tiersForNetwork.map(tier => {
                    const count = availableCount(net.id, tier.tier);
                    const visual = getTierVisual(tier.tier);
                    const tierKey = `${net.id}-${tier.tier}`;
                    const isPurchasing = purchasingTier === tierKey;
                    const canAfford = userBalance >= tier.price;

                    return (
                      <div
                        key={tier.tier}
                        className={`flex items-center justify-between rounded-xl p-3 transition-all ${visual.bg} ${count === 0 ? "opacity-50" : ""}`}
                      >
                        <div className="flex items-center gap-2">
                          {/* Tier price badge */}
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br ${visual.gradient} text-white shadow-sm shrink-0`}>
                            <span className="text-xs font-black">{tier.price}</span>
                          </div>
                          <div>
                            <p className="text-sm font-bold text-gray-900">{tier.data}</p>
                            <div className="flex items-center gap-2 text-[10px] text-gray-400">
                              <span className="flex items-center gap-0.5"><Clock className="w-2.5 h-2.5" />{tier.duration} {t("cards2.days")}</span>
                              <span>{tier.icon} {t("cards2.category")} {tier.price} ر.ي</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            className={`text-[9px] h-5 ${count > 0 ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-400"}`}
                          >
                            {count} {t("cards2.available")}
                          </Badge>
                          <span className={`font-black text-sm ${canAfford ? "text-[#1B7A3D]" : "text-red-400"}`}>{tier.price} ر.ي</span>
                          <Button
                            onClick={() => handleBuyTier(net.id, tier.tier)}
                            disabled={count === 0 || isPurchasing || !!purchasingTier || !canAfford}
                            className="bg-gradient-to-l from-[#1B7A3D] to-[#22A24D] text-white font-bold rounded-xl h-9 px-4 text-xs btn-green-shadow disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isPurchasing ? "⏳" : !canAfford ? "💸" : t("cards2.buy")}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      </div>

      {/* ===== Success Overlay ===== */}
      <AnimatePresence>
        {purchasedCard && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => setPurchasedCard(null)}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0, y: 30 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="w-full max-w-sm bg-gradient-to-br from-[#1B7A3D] to-[#248A3D] rounded-3xl overflow-hidden shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close button */}
              <div className="flex justify-end p-3">
                <button
                  onClick={() => setPurchasedCard(null)}
                  className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors"
                >
                  <X className="w-4 h-4 text-white" />
                </button>
              </div>

              {/* Success content */}
              <div className="px-6 pb-8 text-center">
                {/* Success icon with confetti-like animation */}
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 400, damping: 15, delay: 0.15 }}
                  className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-4"
                >
                  <Check className="w-10 h-10 text-white" strokeWidth={3} />
                </motion.div>

                <motion.h2
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="text-2xl font-black text-white mb-1"
                >
                  تم الشراء بنجاح! 🎉
                </motion.h2>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="text-white/70 text-sm mb-6"
                >
                  كرت {purchasedCard.networkName}
                </motion.p>

                {/* Card code */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.5, type: "spring", stiffness: 200, damping: 15 }}
                  className="bg-white/15 rounded-2xl p-4 mb-4"
                >
                  <p className="text-white/60 text-xs font-bold mb-2">رمز الكرت</p>
                  <p className="text-white font-mono font-black text-2xl tracking-widest" dir="ltr">
                    {purchasedCard.code}
                  </p>
                </motion.div>

                {/* Card details */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 }}
                  className="grid grid-cols-3 gap-2 mb-6"
                >
                  <div className="bg-white/10 rounded-xl p-2">
                    <p className="text-white/50 text-[10px] font-bold">البيانات</p>
                    <p className="text-white text-xs font-black">{purchasedCard.data}</p>
                  </div>
                  <div className="bg-white/10 rounded-xl p-2">
                    <p className="text-white/50 text-[10px] font-bold">المدة</p>
                    <p className="text-white text-xs font-black">{purchasedCard.duration} يوم</p>
                  </div>
                  <div className="bg-white/10 rounded-xl p-2">
                    <p className="text-white/50 text-[10px] font-bold">السعر</p>
                    <p className="text-white text-xs font-black">{purchasedCard.price} ر.ي</p>
                  </div>
                </motion.div>

                {/* Copy button */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.7 }}
                >
                  <Button
                    onClick={() => handleCopyCode(purchasedCard.code)}
                    className="w-full bg-white text-[#1B7A3D] font-bold rounded-xl h-12 text-base hover:bg-white/90 transition-colors flex items-center justify-center gap-2"
                  >
                    {copiedCode ? (
                      <>
                        <Check className="w-5 h-5" />تم النسخ!
                      </>
                    ) : (
                      <>
                        <Copy className="w-5 h-5" />نسخ رمز الكرت
                      </>
                    )}
                  </Button>
                </motion.div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Network Detail Modal */}
      <AnimatePresence>
        {detailNetwork && (
          <NetworkDetailModal
            network={detailNetwork}
            onClose={() => setDetailNetwork(null)}
            allCards={cards}
            allTiers={fbTiers}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
