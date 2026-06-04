"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShoppingBag, Wifi, CreditCard, Building2, Smartphone, Megaphone, Download,
  Zap, MapPin, Phone, ChevronLeft, Globe, RefreshCw, Wallet, ArrowDown,
  TrendingUp, Star, Navigation, Clock, Satellite, Package, Search
} from "lucide-react";
import { db } from "@/lib/firebase";
import { ref, onValue, get } from "firebase/database";
import { NETWORKS as DEFAULT_NETWORKS, PROVINCES, getDistricts, getDistrictsEn } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { NetworkDetailModal } from "@/components/NetworkDetailModal";
import type { Advertisement, SimCard, NetworkItem, CardItem } from "@/lib/types";
import type { User } from "firebase/auth";
import { useLanguage } from "@/context/LanguageContext";

interface HomePageProps {
  user: User | null;
  isAdmin: boolean;
  onAuthClick: () => void;
  onNavigate: (tab: string) => void;
}

interface HomeBanner {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  linkUrl?: string;
  isActive: boolean;
  order: number;
  createdAt: number;
}

export function HomePage({ user, isAdmin, onAuthClick, onNavigate }: HomePageProps) {
  const { t, isRTL, lang } = useLanguage();

  const [ads, setAds] = useState<Advertisement[]>([]);
  const [homeBanners, setHomeBanners] = useState<HomeBanner[]>([]);
  const [simCards, setSimCards] = useState<SimCard[]>([]);
  const [currentAd, setCurrentAd] = useState(0);
  const [currentBanner, setCurrentBanner] = useState(0);
  const [fbNetworks, setFbNetworks] = useState<NetworkItem[]>(DEFAULT_NETWORKS.map(n => ({
    ...n, ownerId: null, ownerName: null, ownerPhone: null, location: null,
    provinceId: null, provinceName: null, district: null, exactLocation: null,
    connectionIP: null, imageBase64: null, networkType: null, coverage: null, speed: null, createdAt: 0
  })));
  const [allCards, setAllCards] = useState<CardItem[]>([]);
  const [balance, setBalance] = useState(0);
  const [maxBalance, setMaxBalance] = useState(0);
  const [appDownloadUrl, setAppDownloadUrl] = useState("");

  const [selectedProvince, setSelectedProvince] = useState<string | null>(null);
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null);
  const [userProvinceId, setUserProvinceId] = useState<string | null>(null);

  const [refreshing, setRefreshing] = useState(false);
  const [pullY, setPullY] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const touchStartY = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [selectedNetwork, setSelectedNetwork] = useState<NetworkItem | null>(null);
  const [networkSearch, setNetworkSearch] = useState("");

  useEffect(() => {
    const unsubs: (() => void)[] = [];
    const adsUnsub = onValue(ref(db, "advertisements"), (snap) => {
      const data = snap.val();
      if (data) setAds(Object.entries(data).map(([id, val]: [string, unknown]) => ({ id, ...(val as Record<string, unknown>) })).filter((a: Record<string, unknown>) => a.isActive) as Advertisement[]);
    });
    unsubs.push(adsUnsub);
    const bannersUnsub = onValue(ref(db, "homeBanners"), (snap) => {
      const data = snap.val();
      if (data) {
        const banners = Object.entries(data).map(([id, val]: [string, unknown]) => ({ id, ...(val as Record<string, unknown>) })).filter((b: Record<string, unknown>) => b.isActive).sort((a: Record<string, unknown>, b: Record<string, unknown>) => ((a.order as number) || 0) - ((b.order as number) || 0)) as HomeBanner[];
        setHomeBanners(banners);
      } else setHomeBanners([]);
    });
    unsubs.push(bannersUnsub);
    const simsUnsub = onValue(ref(db, "simCards"), (snap) => {
      const data = snap.val();
      if (data) setSimCards(Object.entries(data).map(([id, val]: [string, unknown]) => ({ id, ...(val as Record<string, unknown>) })).filter((s: Record<string, unknown>) => s.isAvailable) as SimCard[]);
    });
    unsubs.push(simsUnsub);
    const netUnsub = onValue(ref(db, "networks"), (snap) => {
      const data = snap.val();
      if (data) setFbNetworks(Object.entries(data).map(([id, val]: [string, unknown]) => ({ id, ...(val as Record<string, unknown>) })) as NetworkItem[]);
    });
    unsubs.push(netUnsub);
    const cardsUnsub = onValue(ref(db, "cards"), (snap) => {
      const data = snap.val();
      setAllCards(data ? Object.entries(data).map(([id, val]: [string, unknown]) => ({ id, ...(val as Record<string, unknown>) })) as CardItem[] : []);
    });
    unsubs.push(cardsUnsub);
    if (user) {
      unsubs.push(onValue(ref(db, `credit/${user.uid}/amount`), (snap) => setBalance(snap.val() || 0)));
      unsubs.push(onValue(ref(db, "settings/maxBalance"), (snap) => setMaxBalance(snap.val() || 0)));
      unsubs.push(onValue(ref(db, "settings/appDownloadUrl"), (snap) => { if (snap.val()) setAppDownloadUrl(snap.val()); }));
      get(ref(db, `users/${user.uid}/provinceId`)).then((snap) => {
        const provId = snap.val();
        if (provId) { setUserProvinceId(provId); setSelectedProvince(provId); }
      });
    }
    return () => unsubs.forEach(u => u());
  }, [user]);

  useEffect(() => {
    if (homeBanners.length <= 1) return;
    const timer = setInterval(() => setCurrentBanner((prev) => (prev + 1) % homeBanners.length), 4000);
    return () => clearInterval(timer);
  }, [homeBanners.length]);

  useEffect(() => {
    if (ads.length <= 1) return;
    const timer = setInterval(() => setCurrentAd((prev) => (prev + 1) % ads.length), 5000);
    return () => clearInterval(timer);
  }, [ads.length]);

  const getAvailableCount = (networkId: string) => allCards.filter(c => c.network === networkId && !c.isUsed).length;

  const vendingNetworks = fbNetworks.filter(net => {
    const available = getAvailableCount(net.id);
    if (available === 0) return false;
    if (selectedProvince && net.provinceId !== selectedProvince) return false;
    if (selectedDistrict && net.district !== selectedDistrict) return false;
    return true;
  }).sort((a, b) => {
    const aNear = a.provinceId === userProvinceId ? 1 : 0;
    const bNear = b.provinceId === userProvinceId ? 1 : 0;
    if (aNear !== bNear) return bNear - aNear;
    return getAvailableCount(b.id) - getAvailableCount(a.id);
  });

  const filteredNetworks = fbNetworks.filter(net => {
    if (selectedProvince && net.provinceId !== selectedProvince) return false;
    if (selectedDistrict && net.district !== selectedDistrict) return false;
    if (networkSearch && !net.name.toLowerCase().includes(networkSearch.toLowerCase())) return false;
    return true;
  });

  const districts = selectedProvince ? getDistricts(selectedProvince) : [];
  const districtsEn = selectedProvince ? getDistrictsEn(selectedProvince) : [];

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const el = scrollRef.current;
    if (el && el.scrollTop <= 0) { touchStartY.current = e.touches[0].clientY; setIsPulling(true); }
  }, []);
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isPulling) return;
    const el = scrollRef.current;
    if (el && el.scrollTop > 0) { setIsPulling(false); setPullY(0); return; }
    const diff = e.touches[0].clientY - touchStartY.current;
    if (diff > 0) setPullY(Math.min(diff * 0.4, 100));
  }, [isPulling]);
  const handleTouchEnd = useCallback(() => {
    if (pullY >= 60 && !refreshing) {
      setRefreshing(true);
      setTimeout(() => { setRefreshing(false); setPullY(0); setIsPulling(false); }, 1200);
    } else { setPullY(0); setIsPulling(false); }
  }, [pullY, refreshing]);

  const activeBanners = homeBanners.length > 0 ? homeBanners : ads.length > 0 ? null : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ type: "spring", stiffness: 120, damping: 14 }}
      className="relative"
    >
      {/* Pull-to-refresh */}
      <motion.div
        className="flex items-center justify-center py-2 overflow-hidden"
        animate={{ height: pullY > 0 || refreshing ? (refreshing ? 44 : pullY * 0.5) : 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
      >
        <motion.div animate={{ rotate: refreshing ? 360 : 0 }} transition={{ repeat: refreshing ? Infinity : 0, duration: 0.8, ease: "linear" }}>
          <RefreshCw className={`w-5 h-5 ${refreshing ? "text-[#1B7A3D]" : "text-gray-300 dark:text-slate-600"}`} />
        </motion.div>
        {pullY > 30 && !refreshing && (
          <span className="text-[10px] text-gray-400 dark:text-slate-500 mx-2">
            <ArrowDown className="w-3 h-3 inline" /> {t("home.pullToRefresh")}
          </span>
        )}
        {refreshing && <span className="text-[10px] text-[#1B7A3D] mx-2 font-bold">{t("home.refreshing")}</span>}
      </motion.div>

      <div
        ref={scrollRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="px-4 pt-3 pb-6 space-y-4"
      >

        {/* ══ 1. HERO BALANCE CARD ══ */}
        <motion.div
          initial={{ scale: 0.97, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 18, delay: 0.05 }}
          className="relative overflow-hidden rounded-3xl"
        >
          <div className="bg-gradient-to-br from-[#0d5c2e] via-[#1B7A3D] to-[#22A24D] rounded-3xl p-5 relative overflow-hidden">
            {/* Decorative blobs */}
            <div className="absolute -top-8 -right-8 w-32 h-32 bg-white/10 rounded-full blur-xl" />
            <div className="absolute -bottom-8 -left-8 w-40 h-40 bg-white/5 rounded-full blur-2xl" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-56 h-56 bg-white/[0.03] rounded-full" />

            <div className="relative z-10">
              {/* App branding row */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl overflow-hidden ring-2 ring-white/30 shadow-lg">
                    <img src="/images/IMG_20260527_220851.jpg" alt="Apple.NET" className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <p className="text-white/50 text-[10px] font-medium tracking-wider uppercase">Apple.NET</p>
                    <h1 className="text-base font-black text-white leading-tight">
                      {user ? t("home.welcomeBack") : t("home.welcome")}
                    </h1>
                  </div>
                </div>
                {!user && (
                  <Button
                    onClick={onAuthClick}
                    size="sm"
                    className="bg-white/20 hover:bg-white/30 text-white border border-white/25 font-bold rounded-xl text-xs h-8 px-3 backdrop-blur-sm"
                  >
                    {t("home.signIn")}
                  </Button>
                )}
              </div>

              {user ? (
                <>
                  {/* Balance display */}
                  <div className="bg-white/10 rounded-2xl px-4 py-3.5 mb-4 backdrop-blur-sm border border-white/10">
                    <p className="text-white/50 text-[10px] font-medium mb-1">{t("home.currentBalance")}</p>
                    <motion.p
                      key={balance}
                      initial={{ scale: 0.85, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: "spring", stiffness: 300, damping: 20 }}
                      className="text-3xl font-black text-white tracking-tight"
                    >
                      {balance.toLocaleString()} <span className="text-base font-medium text-white/60">{t("home.yer")}</span>
                    </motion.p>
                    {maxBalance > 0 && (
                      <div className="mt-2">
                        <div className="flex justify-between text-white/35 text-[9px] mb-1">
                          <span>{t("home.outOf")} {maxBalance.toLocaleString()}</span>
                          <span>{Math.round((balance / maxBalance) * 100)}%</span>
                        </div>
                        <div className="h-1 bg-white/15 rounded-full overflow-hidden">
                          <div className="h-full bg-white/50 rounded-full transition-all duration-700" style={{ width: `${Math.min((balance / maxBalance) * 100, 100)}%` }} />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Quick actions */}
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      onClick={() => onNavigate("cards")}
                      className="bg-white text-[#1B7A3D] font-black rounded-xl h-11 text-sm hover:bg-white/90 shadow-lg haptic-press"
                    >
                      <ShoppingBag className="w-4 h-4 mx-1.5" />
                      {t("home.buyCards")}
                    </Button>
                    <Button
                      onClick={() => onNavigate("deposit")}
                      className="bg-white/15 hover:bg-white/25 text-white border border-white/25 font-bold rounded-xl h-11 text-sm haptic-press"
                    >
                      <Wallet className="w-4 h-4 mx-1.5" />
                      {t("home.deposit")}
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-white/65 text-sm leading-relaxed text-center mb-4 max-w-xs mx-auto">
                    {t("home.platform")}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <Button onClick={onAuthClick} className="bg-white text-[#1B7A3D] font-black rounded-xl h-11 text-sm hover:bg-white/90 shadow-lg haptic-press">
                      {t("home.signIn")}
                    </Button>
                    <Button onClick={() => onNavigate("cards")} className="bg-white/15 hover:bg-white/25 text-white border border-white/25 font-bold rounded-xl h-11 text-sm haptic-press">
                      <Wifi className="w-4 h-4 mx-1" />{t("home.browseCards")}
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        </motion.div>

        {/* ══ 2. QUICK SERVICES ══ */}
        <div>
          <p className="text-[11px] font-bold text-gray-400 dark:text-slate-500 mb-2 px-1 uppercase tracking-wider">
            {t("home.services")}
          </p>
          <div className="grid grid-cols-4 gap-2">
            {[
              { icon: Wifi, label: t("home.cards"), color: "bg-[#E8F5E9] dark:bg-green-900/30 text-[#1B7A3D]", action: () => onNavigate("cards") },
              { icon: CreditCard, label: t("home.deposit"), color: "bg-blue-50 dark:bg-blue-900/30 text-blue-500 dark:text-blue-400", action: () => onNavigate("deposit") },
              { icon: Satellite, label: "Starlink", color: "bg-purple-50 dark:bg-purple-900/30 text-purple-500 dark:text-purple-400", action: () => onNavigate("starlink") },
              { icon: Building2, label: t("home.banks"), color: "bg-orange-50 dark:bg-orange-900/30 text-orange-500 dark:text-orange-400", action: () => onNavigate("banks") },
            ].map((item, i) => (
              <motion.div
                key={i}
                whileTap={{ scale: 0.9 }}
                className="bg-white dark:bg-slate-800 rounded-2xl p-3 text-center card-shadow cursor-pointer haptic-press border border-gray-100/50 dark:border-slate-700/50"
                onClick={item.action}
              >
                <div className={`w-10 h-10 rounded-xl ${item.color} flex items-center justify-center mx-auto mb-1.5`}>
                  <item.icon className="w-5 h-5" />
                </div>
                <p className="text-[10px] font-bold text-gray-700 dark:text-slate-300">{item.label}</p>
              </motion.div>
            ))}
          </div>
        </div>

        {/* ══ 3. BANNER / ADS ══ */}
        {(homeBanners.length > 0 || ads.length > 0) && (
          <div className="relative rounded-2xl overflow-hidden shadow-md">
            <AnimatePresence mode="wait">
              <motion.div
                key={homeBanners.length > 0 ? currentBanner : currentAd}
                initial={{ opacity: 0, x: isRTL ? 40 : -40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: isRTL ? -40 : 40 }}
                transition={{ duration: 0.4 }}
                className="relative aspect-[16/7] bg-slate-100 dark:bg-slate-800"
              >
                <img
                  src={homeBanners.length > 0
                    ? (homeBanners[currentBanner]?.imageUrl || "/images/IMG-20260527-WA0043.jpg")
                    : (ads[currentAd]?.imageUrl || "/images/IMG-20260527-WA0043.jpg")
                  }
                  alt="banner"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                <div className="absolute bottom-0 right-0 left-0 p-3">
                  <Badge className="bg-[#1B7A3D] text-white text-[8px] mb-1 gap-1">
                    <Megaphone className="w-2.5 h-2.5" />{t("home.ad")}
                  </Badge>
                  <h3 className="text-sm font-bold text-white">
                    {homeBanners.length > 0 ? homeBanners[currentBanner]?.title : ads[currentAd]?.title}
                  </h3>
                </div>
              </motion.div>
            </AnimatePresence>
            {/* Dot indicators */}
            {(homeBanners.length > 1 || ads.length > 1) && (
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                {(homeBanners.length > 0 ? homeBanners : ads).map((_, i) => (
                  <button
                    key={i}
                    onClick={() => homeBanners.length > 0 ? setCurrentBanner(i) : setCurrentAd(i)}
                    className={`h-1.5 rounded-full transition-all ${i === (homeBanners.length > 0 ? currentBanner : currentAd) ? "bg-white w-4" : "bg-white/40 w-1.5"}`}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══ 4. STATS ROW ══ */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { value: "99.9%", label: t("home.successRate"), icon: TrendingUp, color: "text-emerald-500" },
            { value: "10K+", label: t("home.activeUsers"), icon: Star, color: "text-amber-500" },
            { value: String(vendingNetworks.length || fbNetworks.length), label: t("home.networks"), icon: Zap, color: "text-blue-500" },
          ].map((stat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.05 }}
              className="bg-white dark:bg-slate-800 rounded-2xl p-3 text-center card-shadow border border-gray-100/50 dark:border-slate-700/50"
            >
              <stat.icon className={`w-4 h-4 mx-auto mb-1 ${stat.color}`} />
              <p className={`text-lg font-black ${stat.color}`}>{stat.value}</p>
              <p className="text-[9px] text-gray-400 dark:text-slate-500 font-semibold">{stat.label}</p>
            </motion.div>
          ))}
        </div>

        {/* ══ 5. VENDING MACHINES ══ */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-[#E8F5E9] dark:bg-green-900/30 flex items-center justify-center">
                <Package className="w-3.5 h-3.5 text-[#1B7A3D]" />
              </div>
              <div>
                <h2 className="text-sm font-black text-gray-900 dark:text-white">
                  {t("home.availableMachines")}
                </h2>
                <p className="text-[10px] text-gray-400 dark:text-slate-500">
                  {t("home.networksWithCards")}
                </p>
              </div>
            </div>
            <Badge className="bg-[#E8F5E9] dark:bg-green-900/30 text-[#1B7A3D] text-[9px] font-bold">
              {vendingNetworks.length} {t("home.machine")}
            </Badge>
          </div>

          {/* Province Filter */}
          <div className="mb-3">
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
              <button
                onClick={() => { setSelectedProvince(null); setSelectedDistrict(null); }}
                className={`px-3 py-1.5 rounded-xl text-[10px] font-bold whitespace-nowrap transition-all flex-shrink-0 ${!selectedProvince ? "bg-[#1B7A3D] text-white btn-green-shadow" : "bg-white dark:bg-slate-800 text-gray-500 dark:text-slate-400 card-shadow border border-gray-100 dark:border-slate-700"}`}
              >
                <Navigation className="w-3 h-3 inline ml-1" />{t("home.all")}
              </button>
              {PROVINCES.map(province => {
                const count = fbNetworks.filter(n => n.provinceId === province.id && getAvailableCount(n.id) > 0).length;
                if (count === 0 && selectedProvince !== province.id) return null;
                return (
                  <button
                    key={province.id}
                    onClick={() => { if (selectedProvince === province.id) { setSelectedProvince(null); setSelectedDistrict(null); } else { setSelectedProvince(province.id); setSelectedDistrict(null); } }}
                    className={`px-3 py-1.5 rounded-xl text-[10px] font-bold whitespace-nowrap transition-all flex-shrink-0 ${selectedProvince === province.id ? "bg-orange-500 text-white shadow-md" : "bg-white dark:bg-slate-800 text-gray-500 dark:text-slate-400 card-shadow border border-gray-100 dark:border-slate-700"}`}
                  >
                    🏛️ {lang === "en" && province.nameEn ? province.nameEn : province.name} ({count})
                  </button>
                );
              })}
            </div>
            <AnimatePresence>
              {selectedProvince && districts.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden mt-2"
                >
                  <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                    <button onClick={() => setSelectedDistrict(null)} className={`px-3 py-1.5 rounded-xl text-[10px] font-bold whitespace-nowrap flex-shrink-0 ${!selectedDistrict ? "bg-[#1B7A3D] text-white" : "bg-white dark:bg-slate-800 text-gray-500 dark:text-slate-400 card-shadow border border-gray-100 dark:border-slate-700"}`}>
                      {t("home.all")}
                    </button>
                    {districts.map((d, i) => {
                      const count = fbNetworks.filter(n => n.provinceId === selectedProvince && n.district === d && getAvailableCount(n.id) > 0).length;
                      if (count === 0 && selectedDistrict !== d) return null;
                      const districtLabel = lang === "en" && districtsEn[i] ? districtsEn[i] : d;
                      return (
                        <button key={d} onClick={() => setSelectedDistrict(selectedDistrict === d ? null : d)} className={`px-3 py-1.5 rounded-xl text-[10px] font-bold whitespace-nowrap flex-shrink-0 ${selectedDistrict === d ? "bg-red-500 text-white" : "bg-white dark:bg-slate-800 text-gray-500 dark:text-slate-400 card-shadow border border-gray-100 dark:border-slate-700"}`}>
                          📍 {districtLabel}
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Vending network cards */}
          <div className="space-y-2">
            {vendingNetworks.length === 0 ? (
              <div className="bg-white dark:bg-slate-800 rounded-2xl card-shadow p-6 text-center border border-gray-100/50 dark:border-slate-700/50">
                <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-slate-700 flex items-center justify-center mx-auto mb-3">
                  <Wifi className="w-6 h-6 text-gray-300 dark:text-slate-500" />
                </div>
                <p className="text-gray-500 dark:text-slate-400 text-sm font-bold">
                  {t("home.noMachines")}
                </p>
                <p className="text-gray-300 dark:text-slate-600 text-[10px] mt-1">
                  {selectedProvince ? t("home.tryOtherProvince") : t("home.newCardsComing")}
                </p>
              </div>
            ) : (
              vendingNetworks.map((net, i) => {
                const availableCount = getAvailableCount(net.id);
                const cheapestCard = allCards.filter(c => c.network === net.id && !c.isUsed).sort((a, b) => (a.price || 0) - (b.price || 0))[0];
                const isNearby = net.provinceId === userProvinceId;
                return (
                  <motion.div
                    key={net.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setSelectedNetwork(net)}
                    className="bg-white dark:bg-slate-800 rounded-2xl card-shadow p-4 cursor-pointer transition-colors border-r-4 dark:border-slate-700 group hover:shadow-md"
                    style={{ borderRightColor: net.color || "#1B7A3D" }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center text-xl overflow-hidden flex-shrink-0" style={{ backgroundColor: net.bgColor || (net.color + "1A") }}>
                          {(net as unknown as Record<string, unknown>).imageBase64 ? (
                            <img src={(net as unknown as Record<string, unknown>).imageBase64 as string} alt={net.name} className="w-10 h-10 rounded-lg object-cover" />
                          ) : <span>{net.emoji}</span>}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h3 className="text-sm font-black truncate" style={{ color: net.color }}>{net.name}</h3>
                            {isNearby && <span className="text-[8px] bg-[#E8F5E9] dark:bg-green-900/30 text-[#1B7A3D] px-1.5 py-0.5 rounded-full font-bold">{t("home.nearby")}</span>}
                          </div>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            {net.provinceName && (() => {
                              const provObj = PROVINCES.find(p => p.id === net.provinceId);
                              const provLabel = lang === "en" && provObj?.nameEn ? provObj.nameEn : net.provinceName;
                              return (
                                <span className="text-[10px] text-gray-400 dark:text-slate-500 flex items-center gap-0.5">
                                  <Globe className="w-3 h-3" />{provLabel}
                                </span>
                              );
                            })()}
                            {net.district && (() => {
                              const provObj = PROVINCES.find(p => p.id === net.provinceId);
                              const distIdx = provObj ? provObj.districts.indexOf(net.district) : -1;
                              const distLabel = lang === "en" && provObj?.districtsEn && distIdx >= 0 && provObj.districtsEn[distIdx] ? provObj.districtsEn[distIdx] : net.district;
                              return (
                                <span className="text-[10px] text-gray-400 dark:text-slate-500 flex items-center gap-0.5">
                                  <MapPin className="w-3 h-3" />{distLabel}
                                </span>
                              );
                            })()}
                            {net.ownerPhone && (
                              <a href={`https://wa.me/${net.ownerPhone}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-[10px] text-blue-500 flex items-center gap-0.5 hover:underline">
                                <Phone className="w-3 h-3" />{t("home.contact")}
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                        <Badge className="bg-[#E8F5E9] dark:bg-green-900/30 text-[#1B7A3D] text-[10px] font-bold">
                          {availableCount} {t("home.cardCount")}
                        </Badge>
                        {cheapestCard && (
                          <span className="text-[9px] text-gray-400 dark:text-slate-500">
                            {t("home.from")} {cheapestCard.price?.toLocaleString()} {t("home.yer")}
                          </span>
                        )}
                        <ChevronLeft className={`w-4 h-4 text-gray-300 dark:text-slate-600 transition-transform group-hover:-translate-x-0.5 ${!isRTL ? "rotate-180" : ""}`} />
                      </div>
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>
        </div>

        {/* ══ 6. ALL NETWORKS ══ */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-black text-gray-900 dark:text-white">
              {t("home.allNetworks")}
            </h2>
            <Badge className="bg-[#E8F5E9] dark:bg-green-900/30 text-[#1B7A3D] text-[9px]">
              {filteredNetworks.length} {t("home.networkCount")}
            </Badge>
          </div>
          {/* User/Network Search */}
          <div className="relative mb-3">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              value={networkSearch}
              onChange={(e) => setNetworkSearch(e.target.value)}
              placeholder={t("home.searchNetwork")}
              className="bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 rounded-xl h-10 text-sm pr-10"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            {filteredNetworks.length === 0 ? (
              <div className="col-span-2 bg-white dark:bg-slate-800 rounded-2xl card-shadow p-6 text-center">
                <p className="text-gray-400 dark:text-slate-500 text-sm">{t("home.noNetworks")}</p>
              </div>
            ) : (
              filteredNetworks.map((net, i) => {
                const availableCount = getAvailableCount(net.id);
                return (
                  <motion.div
                    key={net.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.03 }}
                    whileTap={{ scale: 0.96 }}
                    onClick={() => setSelectedNetwork(net)}
                    className="bg-white dark:bg-slate-800 rounded-2xl card-shadow p-3 cursor-pointer border border-gray-100/50 dark:border-slate-700/50 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center gap-2.5 mb-2">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center text-base overflow-hidden flex-shrink-0" style={{ backgroundColor: net.bgColor || (net.color + "1A") }}>
                        {(net as unknown as Record<string, unknown>).imageBase64 ? (
                          <img src={(net as unknown as Record<string, unknown>).imageBase64 as string} alt={net.name} className="w-7 h-7 rounded-lg object-cover" />
                        ) : <span>{net.emoji}</span>}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-xs font-black truncate" style={{ color: net.color }}>{net.name}</h3>
                        {net.provinceName && (() => {
                          const provObj = PROVINCES.find(p => p.id === net.provinceId);
                          const provLabel = lang === "en" && provObj?.nameEn ? provObj.nameEn : net.provinceName;
                          return (
                            <span className="text-[9px] text-gray-400 dark:text-slate-500 flex items-center gap-0.5">
                              <Globe className="w-2.5 h-2.5" />{provLabel}
                            </span>
                          );
                        })()}
                      </div>
                    </div>
                    <div className={`text-[9px] px-2 py-1 rounded-lg font-bold text-center ${availableCount > 0 ? "bg-[#E8F5E9] dark:bg-green-900/30 text-[#1B7A3D]" : "bg-gray-100 dark:bg-slate-700 text-gray-400 dark:text-slate-500"}`}>
                      {availableCount > 0 ? `${availableCount} ${t("home.availableCards")}` : t("home.unavailable")}
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>
        </div>

        {/* ══ 7. SIM + DOWNLOAD BANNER ══ */}
        <div className="grid grid-cols-2 gap-3">
          {/* SIM Card teaser */}
          <div className="bg-gradient-to-br from-purple-500 to-purple-700 rounded-2xl overflow-hidden shadow-md relative">
            <img src="/images/IMG-20260527-WA0042.jpg" alt="SIM" className="w-full h-28 object-cover opacity-40" />
            <div className="absolute inset-0 p-3 flex flex-col justify-between">
              <Badge className="bg-white/20 text-white border-0 text-[8px] w-fit">{t("home.comingSoon")}</Badge>
              <div>
                <p className="text-white font-black text-xs">{t("home.simCard")}</p>
                <p className="text-white/70 text-[9px]">5,000 {t("home.yer")}</p>
              </div>
            </div>
          </div>

          {/* Download app banner */}
          <div className="bg-gradient-to-br from-[#0d5c2e] to-[#1B7A3D] rounded-2xl p-3 shadow-md flex flex-col justify-between">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-xl overflow-hidden ring-2 ring-white/20">
                <img src="/images/IMG_20260527_220851.jpg" alt="app" className="w-full h-full object-cover" />
              </div>
              <div>
                <p className="text-white font-black text-[10px]">Apple.NET</p>
                <p className="text-white/50 text-[8px]">{t("home.app")}</p>
              </div>
            </div>
            {appDownloadUrl ? (
              <a href={appDownloadUrl} target="_blank" rel="noopener noreferrer" className="bg-white text-[#1B7A3D] font-black text-[10px] rounded-xl py-2 text-center flex items-center justify-center gap-1 haptic-press hover:bg-white/90">
                <Download className="w-3 h-3" />{t("home.downloadApk")}
              </a>
            ) : (
              <div className="bg-white/10 text-white/50 text-[9px] rounded-xl py-2 text-center font-bold">
                {t("home.apkComingSoon")}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Network Detail Modal */}
      <AnimatePresence>
        {selectedNetwork && (
          <NetworkDetailModal network={selectedNetwork} onClose={() => setSelectedNetwork(null)} allCards={allCards} />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
