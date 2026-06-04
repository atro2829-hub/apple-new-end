"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Home,
  Wifi,
  CreditCard,
  MoreHorizontal,
  Settings,
  LogIn,
  LogOut,
  X,
  ShoppingBag,
  Shield,
  Menu,
  Wallet,
  Crown,
  Satellite,
  User,
  Globe,
  Building2,
  MapPin,
  MessageCircle,
  MessageSquareWarning,
} from "lucide-react";
import {
  auth,
  db,
} from "@/lib/firebase";
import {
  signOut,
  onAuthStateChanged,
  type User as FirebaseUser,
} from "firebase/auth";
import { ref, get, onValue, update } from "firebase/database";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { PROVINCES, getDistricts, getDistrictsEn } from "@/lib/constants";

import { AppleNetLogo } from "@/components/AppleNetLogo";
import { AuthForm } from "@/components/AuthForm";
import { HomePage } from "@/components/HomePage";
import { CardsPage } from "@/components/CardsPage";
import { PurchasedPage } from "@/components/PurchasedPage";
import { CreditPage } from "@/components/CreditPage";
import { DepositPage } from "@/components/DepositPage";
import { BanksPage } from "@/components/BanksPage";
import { SimsPage } from "@/components/SimsPage";
import { AdsPage } from "@/components/AdsPage";
import { MorePage } from "@/components/MorePage";
import { AdminPanel } from "@/components/AdminPanel";
import { NetworkManagerPanel } from "@/components/NetworkManagerPanel";
import { NotificationCenter } from "@/components/NotificationCenter";
import { StarlinkPage } from "@/components/StarlinkPage";
import { NetworkSubmissionPage } from "@/components/NetworkSubmissionPage";
import { OnboardingFlow } from "@/components/OnboardingFlow";
import { AppUpdateBanner } from "@/components/AppUpdateBanner";
import { ProfilePage } from "@/components/ProfilePage";
import { ChatPage } from "@/components/ChatPage";
import { ComplaintPage } from "@/components/ComplaintPage";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageToggle } from "@/components/LanguageToggle";
import { PermissionModal } from "@/components/PermissionModal";
import { iOSSpring } from "@/lib/constants";
import { initNotifications } from "@/lib/notifications";
import { useLanguage } from "@/context/LanguageContext";

const APP_VERSION = "2.1.0";

export default function AppleNetApp() {
  const { t, isRTL, lang } = useLanguage();

  const NAV_TABS = [
    { id: "home", icon: Home, label: t("nav.home") },
    { id: "cards", icon: Wifi, label: t("nav.cards") },
    { id: "starlink", icon: Satellite, label: "Starlink" },
    { id: "chat", icon: MessageCircle, label: t("nav.chat") },
    { id: "credit", icon: Wallet, label: t("nav.credit") },
  ];

  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userRole, setUserRole] = useState<string>("user");
  const [managedNetwork, setManagedNetwork] = useState<string>("");
  const [activeTab, setActiveTab] = useState("home");
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [showAdmin, setShowAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showMenu, setShowMenu] = useState(false);
  const [splashDone, setSplashDone] = useState(false);
  const [splashExiting, setSplashExiting] = useState(false);
  const [userName, setUserName] = useState<string>("");
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [splashProgress, setSplashProgress] = useState(0);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [locationModalProvinceId, setLocationModalProvinceId] = useState("");
  const [locationModalDistrict, setLocationModalDistrict] = useState("");
  const [locationModalSaving, setLocationModalSaving] = useState(false);
  const [locationModalDismissed, setLocationModalDismissed] = useState(false);
  const [userPhotoURL, setUserPhotoURL] = useState<string>("");

  // Handle URL params for PWA shortcuts
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab");
    if (tab && (NAV_TABS.some(t => t.id === tab) || tab === "profile" || tab === "deposit" || tab === "purchased" || tab === "submit-network")) {
      setActiveTab(tab);
    }
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        try {
          const roleSnap = await get(ref(db, `users/${u.uid}/role`));
          const role = roleSnap.val() || "user";
          setUserRole(role);
          setIsAdmin(role === "admin");
          const nameSnap = await get(ref(db, `users/${u.uid}/displayName`));
          setUserName(nameSnap.val() || u.displayName || u.email?.split("@")[0] || "م");
          // Check if user has provinceId, show location modal if not
          const provinceSnap = await get(ref(db, `users/${u.uid}/provinceId`));
          const hasProvince = provinceSnap.exists() && provinceSnap.val();
          if (!hasProvince && !locationModalDismissed) {
            setShowLocationModal(true);
          }
          if (role === "network_manager") {
            const netSnap = await get(ref(db, `users/${u.uid}/managedNetwork`));
            setManagedNetwork(netSnap.val() || "");
          }
        } catch {
          setIsAdmin(false);
          setUserRole("user");
        }
      } else {
        setIsAdmin(false);
        setUserRole("user");
        setManagedNetwork("");
        setUserName("");
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user) return;
    const roleUnsub = onValue(ref(db, `users/${user.uid}/role`), (snap) => {
      const role = snap.val() || "user";
      setUserRole(role);
      setIsAdmin(role === "admin");
      if (role === "network_manager") {
        get(ref(db, `users/${user.uid}/managedNetwork`)).then((netSnap) => {
          setManagedNetwork(netSnap.val() || "");
        });
      } else {
        setManagedNetwork("");
      }
    });
    const nameUnsub = onValue(ref(db, `users/${user.uid}/displayName`), (snap) => {
      if (snap.val()) setUserName(snap.val());
    });
    return () => { roleUnsub(); nameUnsub(); };
  }, [user]);

  // Listen for user photo URL
  useEffect(() => {
    if (!user) return;
    const photoUnsub = onValue(ref(db, `users/${user.uid}/photoURL`), (snap) => {
      if (snap.val()) setUserPhotoURL(snap.val());
      else setUserPhotoURL("");
    });
    return () => photoUnsub();
  }, [user]);

  // Enhanced splash screen with progress bar animation
  useEffect(() => {
    // Animate progress bar
    const progressInterval = setInterval(() => {
      setSplashProgress((prev) => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          return 100;
        }
        // Non-linear progress: fast at start, slows down, then completes
        const increment = prev < 30 ? 8 : prev < 60 ? 5 : prev < 85 ? 3 : 1;
        return Math.min(prev + increment, 100);
      });
    }, 100);

    // Initialize notifications during splash
    initNotifications();

    // Start splash exit after delay
    const exitTimer = setTimeout(() => {
      setSplashExiting(true);
    }, 2000);

    const doneTimer = setTimeout(() => {
      setSplashDone(true);
      // Check if onboarding should show
      if (typeof window !== "undefined" && !localStorage.getItem("applenet_onboarding_done")) {
        setShowOnboarding(true);
      }
    }, 2500);

    return () => {
      clearInterval(progressInterval);
      clearTimeout(exitTimer);
      clearTimeout(doneTimer);
    };
  }, []);

  const handleOnboardingComplete = useCallback(() => {
    setShowOnboarding(false);
  }, []);

  // Enhanced Splash Screen with progress bar, version, and shimmer
  if (!splashDone) {
    return (
      <motion.div
        initial={{ opacity: 1 }}
        animate={{ opacity: splashExiting ? 0 : 1 }}
        transition={{ duration: 0.5, ease: "easeInOut" }}
        className="fixed inset-0 bg-white dark:bg-slate-900 flex flex-col items-center justify-center"
        dir={isRTL ? "rtl" : "ltr"}
      >
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 15 }}
          className="flex flex-col items-center"
        >
          {/* App Icon with shimmer */}
          <div className="relative w-24 h-24 rounded-3xl overflow-hidden shadow-xl mb-6 border-2 border-[#E8F5E9] splash-shimmer">
            <img src="/images/IMG_20260527_220851.jpg" alt="Apple.NET" className="w-full h-full object-cover" />
          </div>
          <AppleNetLogo size="lg" />

          {/* Loading indicator */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-6 flex items-center gap-2"
          >
            <div className="w-5 h-5 border-2 border-[#1B7A3D]/30 border-t-[#1B7A3D] rounded-full animate-spin" />
            <span className="text-sm text-gray-400 dark:text-slate-500 font-bold">{t("splash.loading")}</span>
          </motion.div>
        </motion.div>

        {/* Progress bar */}
        <div className="absolute bottom-16 left-8 right-8 max-w-xs mx-auto">
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: "0%" }}
              animate={{ width: `${splashProgress}%` }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="h-full bg-gradient-to-l from-[#1B7A3D] to-[#22A24D] rounded-full"
            />
          </div>
        </div>

        {/* Version display */}
        <div className="absolute bottom-8 text-center">
          <span className="text-[10px] text-gray-300 font-mono">v{APP_VERSION}</span>
        </div>
      </motion.div>
    );
  }

  // Onboarding Flow
  if (showOnboarding) {
    return (
      <OnboardingFlow
        onComplete={handleOnboardingComplete}
        onLoginClick={() => { setShowOnboarding(false); setAuthMode("login"); setShowAuth(true); }}
        onRegisterClick={() => { setShowOnboarding(false); setAuthMode("register"); setShowAuth(true); }}
      />
    );
  }

  return (
    <div id="app-shell" className="font-sans bg-gray-50 dark:bg-slate-900" dir={isRTL ? "rtl" : "ltr"}>

      {/* ===== App Update Banner ===== */}
      <AppUpdateBanner />

      {/* ===== STATUS BAR SIMULATION ===== */}
      <div className="bg-white h-1 flex-shrink-0" />

      {/* ===== LOCATION MODAL ===== */}
      <AnimatePresence>
        {showLocationModal && user && !locationModalDismissed && (
          <motion.div
            key="location-modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            dir="rtl"
          >
            <motion.div
              key="location-modal-card"
              initial={{ scale: 0.85, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.85, opacity: 0, y: 30 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="w-full max-w-sm bg-white rounded-3xl overflow-hidden shadow-2xl"
            >
              {/* Green Header */}
              <div className="bg-gradient-to-l from-[#1B7A3D] to-[#22A24D] p-5 text-center relative overflow-hidden">
                <div className="absolute top-0 left-0 w-24 h-24 bg-white/5 rounded-full -translate-x-1/2 -translate-y-1/2" />
                <div className="absolute bottom-0 right-0 w-16 h-16 bg-white/5 rounded-full translate-x-1/3 translate-y-1/3" />
                <div className="relative z-10">
                  <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center mx-auto mb-3">
                    <MapPin className="w-7 h-7 text-white" />
                  </div>
                  <h2 className="text-xl font-black text-white mb-1">{t("location.title")}</h2>
                  <p className="text-white/70 text-xs leading-relaxed">{t("location.subtitle")}</p>
                </div>
              </div>

              {/* Form */}
              <div className="p-5 space-y-4">
                {/* Province */}
                <div>
                  <label className="block text-xs text-gray-500 mb-1.5 font-bold">{t("location.province")}</label>
                  <div className="relative">
                    <Globe className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <select
                      value={locationModalProvinceId}
                      onChange={(e) => { setLocationModalProvinceId(e.target.value); setLocationModalDistrict(""); }}
                      className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-xl h-12 text-sm pr-10 pl-4 focus:border-[#1B7A3D] focus:ring-[#1B7A3D] appearance-none"
                    >
                      <option value="">{t("location.selectProvince")}</option>
                      {PROVINCES.map(p => (
                        <option key={p.id} value={p.id}>{lang === "en" && p.nameEn ? p.nameEn : p.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* District */}
                <div>
                  <label className="block text-xs text-gray-500 mb-1.5 font-bold">{t("location.district")}</label>
                  <div className="relative">
                    <Building2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <select
                      value={locationModalDistrict}
                      onChange={(e) => setLocationModalDistrict(e.target.value)}
                      disabled={!locationModalProvinceId}
                      className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-xl h-12 text-sm pr-10 pl-4 focus:border-[#1B7A3D] focus:ring-[#1B7A3D] appearance-none disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <option value="">{locationModalProvinceId ? t("location.selectDistrict") : t("location.selectProvinceFirst")}</option>
                      {locationModalProvinceId && (() => {
                        const districtNames = lang === "en" ? getDistrictsEn(locationModalProvinceId) : getDistricts(locationModalProvinceId);
                        const districtValues = getDistricts(locationModalProvinceId);
                        return districtValues.map((d, i) => (
                          <option key={d} value={d}>{districtNames[i]}</option>
                        ));
                      })()}
                    </select>
                  </div>
                </div>

                {/* Buttons */}
                <div className="space-y-2 pt-1">
                  <Button
                    onClick={async () => {
                      if (!locationModalProvinceId) {
                        toast.error(t("location.selectProvinceFirst"));
                        return;
                      }
                      setLocationModalSaving(true);
                      try {
                        const provinceObj = PROVINCES.find(p => p.id === locationModalProvinceId);
                        await update(ref(db, `users/${user.uid}`), {
                          provinceId: locationModalProvinceId,
                          provinceName: provinceObj?.name || null,
                          district: locationModalDistrict || null,
                        });
                        toast.success(t("location.savedSuccess"));
                        setShowLocationModal(false);
                        setLocationModalDismissed(true);
                      } catch {
                        toast.error(t("location.saveError"));
                      }
                      setLocationModalSaving(false);
                    }}
                    disabled={locationModalSaving}
                    className="w-full bg-gradient-to-l from-[#1B7A3D] to-[#22A24D] hover:from-[#165E30] hover:to-[#134D28] text-white font-bold rounded-2xl h-12 btn-green-shadow disabled:opacity-70"
                  >
                    {locationModalSaving ? (
                      <span className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        {t("location.saving")}
                      </span>
                    ) : t("location.save")}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setShowLocationModal(false);
                      setLocationModalDismissed(true);
                    }}
                    className="w-full text-gray-400 font-bold rounded-xl h-10 text-sm hover:text-gray-600"
                  >
                    {t("location.skip")}
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===== APP HEADER ===== */}
      <header className="flex-shrink-0 app-header border-b border-gray-100/50 z-40">
        <div className="max-w-lg mx-auto px-4 py-2.5 flex items-center justify-between">
          {/* Menu Button */}
          <motion.button
            whileTap={{ scale: 0.85 }}
            onClick={() => setShowMenu(!showMenu)}
            className="w-10 h-10 rounded-2xl bg-[#E8F5E9] flex items-center justify-center hover:bg-green-100 transition-colors haptic-press"
          >
            <Menu className="w-5 h-5 text-[#1B7A3D]" />
          </motion.button>

          {/* App Logo */}
          <AppleNetLogo size="sm" />

          {/* Right Actions */}
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <LanguageToggle />
            {user && <NotificationCenter uid={user.uid} isAdmin={isAdmin} />}
            {user ? (
              <motion.button
                whileTap={{ scale: 0.85 }}
                onClick={async () => { await signOut(auth); toast.success(t("auth.logout")); }}
                className="w-10 h-10 rounded-2xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors haptic-press"
              >
                <LogOut className="w-4 h-4 text-red-500" />
              </motion.button>
            ) : (
              <motion.button
                whileTap={{ scale: 0.85 }}
                onClick={() => setShowAuth(true)}
                className="w-10 h-10 rounded-2xl bg-[#E8F5E9] dark:bg-green-900/30 flex items-center justify-center hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors haptic-press"
              >
                <LogIn className="w-4 h-4 text-[#1B7A3D]" />
              </motion.button>
            )}
          </div>
        </div>
      </header>

      {/* ===== SIDE MENU (Drawer) ===== */}
      <AnimatePresence>
        {showMenu && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-[100]"
              onClick={() => setShowMenu(false)}
            />
            <motion.div
              initial={{ x: 288, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 288, opacity: 0 }}
              transition={iOSSpring.gentle}
              className="fixed top-0 right-0 bottom-0 w-[288px] bg-white dark:bg-slate-900 z-[101] shadow-2xl border-l border-gray-100 dark:border-slate-700/50"
            >
              <div className="p-5">
                {/* Menu Header */}
                <div className="flex items-center justify-between mb-5">
                  <div className="w-12 h-12 rounded-2xl overflow-hidden border-2 border-[#E8F5E9] dark:border-green-900/30">
                    <img src="/images/IMG_20260527_220851.jpg" alt="Apple.NET" className="w-full h-full object-cover" />
                  </div>
                  <button onClick={() => setShowMenu(false)} className="w-8 h-8 rounded-full bg-gray-100 dark:bg-slate-700 flex items-center justify-center">
                    <X className="w-4 h-4 text-gray-400 dark:text-slate-400" />
                  </button>
                </div>

                {/* User Card */}
                {user && (
                  <div className="bg-gradient-to-bl from-[#E8F5E9] dark:from-green-900/20 to-[#F0FFF4] dark:to-green-900/10 rounded-2xl p-4 mb-4 border border-[#1B7A3D]/10 dark:border-green-900/20">
                    <div className="flex items-center gap-3">
                      {userPhotoURL ? (
                        <img
                          src={userPhotoURL}
                          alt={userName || "User"}
                          className="w-11 h-11 rounded-full object-cover shadow-sm"
                        />
                      ) : (
                        <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#1B7A3D] to-[#22A24D] flex items-center justify-center shadow-sm">
                          <span className="text-white font-black text-base">{(userName || "م")[0].toUpperCase()}</span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{userName || t("profile.user")}</p>
                        <p className="text-[10px] text-gray-400 dark:text-slate-500 truncate" dir="ltr">{user.email}</p>
                      </div>
                    </div>
                    {isAdmin && <span className="inline-block mt-2 bg-[#1B7A3D] text-white text-[9px] font-bold px-2 py-0.5 rounded-full">{t("common.admin")}</span>}
                    {userRole === "network_manager" && <span className="inline-block mt-2 bg-orange-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full">{t("common.networkManager")}</span>}
                  </div>
                )}

                {/* Not logged in prompt */}
                {!user && (
                  <div className="bg-gray-50 dark:bg-slate-800 rounded-2xl p-4 mb-4 text-center">
                    <p className="text-sm text-gray-500 dark:text-slate-400 mb-3">{t("auth.loginPrompt")}</p>
                    <Button
                      onClick={() => { setShowMenu(false); setShowAuth(true); }}
                      className="w-full bg-gradient-to-l from-[#1B7A3D] to-[#22A24D] text-white font-bold rounded-xl h-10 text-sm btn-green-shadow"
                    >
                      <LogIn className="w-4 h-4 ml-1.5" />{t("auth.login")}
                    </Button>
                  </div>
                )}

                {/* Navigation */}
                <nav className="space-y-0.5">
                  {[
                    { icon: Home, label: t("menu.home"), tab: "home", action: () => { setActiveTab("home"); setShowMenu(false); } },
                    { icon: Wifi, label: t("menu.buyCards"), tab: "cards", action: () => { setActiveTab("cards"); setShowMenu(false); } },
                    { icon: Globe, label: t("menu.submitNetwork"), tab: "submit-network", action: () => { setActiveTab("submit-network"); setShowMenu(false); } },
                    { icon: Satellite, label: t("menu.starlink"), tab: "starlink", action: () => { setActiveTab("starlink"); setShowMenu(false); } },
                    { icon: Wallet, label: t("menu.deposit"), tab: "deposit", action: () => { setActiveTab("deposit"); setShowMenu(false); } },
                    { icon: CreditCard, label: t("menu.myBalance"), tab: "credit", action: () => { setActiveTab("credit"); setShowMenu(false); } },
                    { icon: ShoppingBag, label: t("menu.myPurchases"), tab: "purchased", action: () => { setActiveTab("purchased"); setShowMenu(false); } },
                    ...(user ? [{ icon: User, label: t("menu.profile"), tab: "profile", action: () => { setActiveTab("profile"); setShowMenu(false); } }] : []),
                    { icon: MessageSquareWarning, label: t("menu.complaints"), tab: "complaints", action: () => { setActiveTab("complaints"); setShowMenu(false); } },
                    { icon: MoreHorizontal, label: t("menu.more"), tab: "more", action: () => { setActiveTab("more"); setShowMenu(false); } },
                    ...(isAdmin || userRole === "network_manager" ? [{ icon: Settings, label: t("menu.dashboard"), tab: "admin", action: () => { setShowAdmin(true); setShowMenu(false); } }] : []),
                  ].map((item, i) => (
                    <motion.button
                      key={i}
                      whileTap={{ scale: 0.97 }}
                      onClick={item.action}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors haptic-press ${
                        activeTab === item.tab
                          ? "bg-[#E8F5E9] dark:bg-green-900/25 text-[#1B7A3D]"
                          : "text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800"
                      }`}
                    >
                      <item.icon className="w-5 h-5 flex-shrink-0" />
                      <span className="text-sm font-semibold">{item.label}</span>
                    </motion.button>
                  ))}
                </nav>
              </div>

              {/* Menu Footer */}
              <div className="absolute bottom-6 right-5 left-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 opacity-40">
                    <AppleNetLogo size="sm" />
                    <span className="text-[10px] text-gray-400 dark:text-slate-500">v{APP_VERSION}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <ThemeToggle />
                    <LanguageToggle />
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ===== MAIN CONTENT (scrollable) ===== */}
      <div id="app-content" className="pb-24 overflow-hidden">
        <AnimatePresence mode="wait">
          {activeTab === "home" && <motion.div key="page-home" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}><HomePage user={user} isAdmin={isAdmin} onAuthClick={() => setShowAuth(true)} onNavigate={setActiveTab} /></motion.div>}
          {activeTab === "cards" && <motion.div key="page-cards" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}><CardsPage user={user} onAuthClick={() => setShowAuth(true)} /></motion.div>}
          {activeTab === "starlink" && <motion.div key="page-starlink" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}><StarlinkPage user={user} onAuthClick={() => setShowAuth(true)} /></motion.div>}
          {activeTab === "deposit" && <motion.div key="page-deposit" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}><DepositPage user={user} onAuthClick={() => setShowAuth(true)} /></motion.div>}
          {activeTab === "credit" && <motion.div key="page-credit" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}><CreditPage user={user} onAuthClick={() => setShowAuth(true)} onNavigate={setActiveTab} /></motion.div>}
          {activeTab === "purchased" && <motion.div key="page-purchased" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}><PurchasedPage user={user} onAuthClick={() => setShowAuth(true)} /></motion.div>}
          {activeTab === "banks" && <motion.div key="page-banks" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}><BanksPage /></motion.div>}
          {activeTab === "sims" && <motion.div key="page-sims" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}><SimsPage /></motion.div>}
          {activeTab === "ads" && <motion.div key="page-ads" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}><AdsPage /></motion.div>}
          {activeTab === "more" && <motion.div key="page-more" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}><MorePage user={user} isAdmin={isAdmin} onAuthClick={() => setShowAuth(true)} onNavigate={setActiveTab} /></motion.div>}
          {activeTab === "submit-network" && <motion.div key="page-submit-network" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}><NetworkSubmissionPage user={user} onAuthClick={() => setShowAuth(true)} /></motion.div>}
          {activeTab === "profile" && <motion.div key="page-profile" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}><ProfilePage user={user} onBack={() => setActiveTab("more")} /></motion.div>}
          {activeTab === "chat" && <motion.div key="page-chat" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}><ChatPage user={user} isAdmin={isAdmin} /></motion.div>}
          {activeTab === "complaints" && <motion.div key="page-complaints" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}><ComplaintPage user={user} isAdmin={isAdmin} /></motion.div>}
        </AnimatePresence>
      </div>

      {/* ===== ADMIN PANEL (admin only) ===== */}
      <AnimatePresence>
        {showAdmin && isAdmin && <AdminPanel onClose={() => setShowAdmin(false)} />}
      </AnimatePresence>

      {/* ===== NETWORK MANAGER PANEL ===== */}
      <AnimatePresence>
        {showAdmin && userRole === "network_manager" && managedNetwork && <NetworkManagerPanel onClose={() => setShowAdmin(false)} managedNetwork={managedNetwork} />}
      </AnimatePresence>

      {/* ===== AUTH FULL-PAGE VIEW ===== */}
      <AnimatePresence>
        {showAuth && (
          <motion.div
            key="auth-page"
            initial={{ opacity: 0, y: "100%" }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed inset-0 z-50 bg-white overflow-hidden"
          >
            <AuthForm
              mode={authMode}
              onSuccess={() => setShowAuth(false)}
              onSwitchMode={() => setAuthMode(authMode === "login" ? "register" : "login")}
              onBack={() => setShowAuth(false)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===== BOTTOM NAVIGATION (fixed like native app) ===== */}
      <nav className="relative flex-shrink-0 app-bottom-nav border-t border-gray-100/50 z-40 safe-bottom">
        <div className="max-w-lg mx-auto flex items-center justify-around py-1.5 px-1">
          {NAV_TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <motion.button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                whileTap={{ scale: 0.85 }}
                className={`relative flex flex-col items-center gap-0.5 px-3 py-1 rounded-2xl transition-colors haptic-press ${
                  isActive ? "text-[#1B7A3D]" : "text-gray-400"
                }`}
              >
                {/* Active indicator dot */}
                {isActive && (
                  <motion.div
                    layoutId="navDot"
                    className="absolute -top-1 w-5 h-1 rounded-full bg-[#1B7A3D]"
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  />
                )}
                {/* Icon with bounce animation on tap - using tween for 3 keyframes */}
                <motion.div
                  animate={isActive ? { scale: [1, 1.18, 1] } : {}}
                  transition={{ type: "tween", duration: 0.35, ease: "easeInOut" }}
                >
                  <tab.icon className={`w-5 h-5 ${isActive ? "stroke-[2.5]" : ""}`} />
                </motion.div>
                <span className={`text-[9px] font-bold ${isActive ? "text-[#1B7A3D]" : ""}`}>{tab.label}</span>
              </motion.button>
            );
          })}
        </div>
      </nav>

      {/* ===== ADMIN FLOATING BUTTON ===== */}
      {isAdmin && !showAdmin && (
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => setShowAdmin(true)}
          className="fixed bottom-24 left-4 z-30 w-12 h-12 rounded-2xl bg-[#1B7A3D] shadow-lg flex items-center justify-center hover:bg-[#165E30] transition-colors btn-green-shadow haptic-press"
        >
          <Settings className="w-5 h-5 text-white" />
        </motion.button>
      )}
      {userRole === "network_manager" && !showAdmin && (
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => setShowAdmin(true)}
          className="fixed bottom-24 left-4 z-30 w-12 h-12 rounded-2xl bg-orange-500 shadow-lg flex items-center justify-center hover:bg-orange-600 transition-colors haptic-press"
        >
          <Crown className="w-5 h-5 text-white" />
        </motion.button>
      )}

      {/* ===== PERMISSION MODAL ===== */}
      <PermissionModal />
    </div>
  );
}
