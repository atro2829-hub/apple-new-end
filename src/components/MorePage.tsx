"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, Shield, RefreshCw, ChevronLeft, LogOut, LogIn, X,
  Info, Instagram, Facebook, Phone, Mail, Globe, MessageCircle,
  Heart, Star, Code, ShieldCheck, Crown, Wifi, Download,
  Clock, ToggleLeft, ToggleRight, CreditCard, Calendar, Sparkles,
  FileText, HeadphonesIcon, Scale, User as UserIcon
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { db } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import { ref, onValue, update, get } from "firebase/database";
import { auth } from "@/lib/firebase";
import { toast } from "sonner";
import { AppleNetLogo } from "./AppleNetLogo";
import { iOSSpring, formatDate, generateWhatsAppLink, ADMIN_WHATSAPP } from "@/lib/constants";
import type { AppUser, SubscriptionPlan, UserSubscription } from "@/lib/types";
import type { User } from "firebase/auth";
import { useLanguage } from "@/context/LanguageContext";

interface MorePageProps {
  user: User | null;
  isAdmin: boolean;
  onAuthClick: () => void;
  onNavigate?: (tab: string) => void;
}

export function MorePage({ user, isAdmin, onAuthClick, onNavigate }: MorePageProps) {
  const { t, isRTL } = useLanguage();

  const [userInfo, setUserInfo] = useState<AppUser | null>(null);
  const [showAbout, setShowAbout] = useState(false);
  const [showSubscriptions, setShowSubscriptions] = useState(false);
  const [mySubscription, setMySubscription] = useState<UserSubscription | null>(null);
  const [plans, setPlans] = useState<Record<string, SubscriptionPlan>>({});
  const [pastSubscriptions, setPastSubscriptions] = useState<UserSubscription[]>([]);

  // Dialogs for Privacy Policy, Terms of Use, Contact Support
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showContact, setShowContact] = useState(false);

  // Dynamic settings from Firebase
  const [privacyPolicy, setPrivacyPolicy] = useState<string>("");
  const [termsOfUse, setTermsOfUse] = useState<string>("");
  const [appVersion, setAppVersion] = useState<string>("2.0");
  const [supportWhatsApp, setSupportWhatsApp] = useState<string>(ADMIN_WHATSAPP);
  const [appDownloadUrl, setAppDownloadUrl] = useState<string>("");
  const [ownerInfo, setOwnerInfo] = useState<{ name: string; phone: string; instagram: string; facebook: string }>({
    name: "عبدالعليم اليافعي",
    phone: "967774146432",
    instagram: "https://www.instagram.com/abod_n11?igsh=MWR6djVoODVnN2hiZg%3D%3D&utm_source=qr",
    facebook: "https://www.facebook.com/share/1AbXsFSbfc/",
  });
  const [socialLinks, setSocialLinks] = useState<{ whatsapp: string; instagram: string; facebook: string }>({
    whatsapp: "https://wa.me/967774146432",
    instagram: "https://www.instagram.com/abod_n11?igsh=MWR6djVoODVnN2hiZg%3D%3D&utm_source=qr",
    facebook: "https://www.facebook.com/share/1AbXsFSbfc/",
  });

  useEffect(() => {
    if (user) {
      const unsub = onValue(ref(db, `users/${user.uid}`), (snap) => {
        const data = snap.val();
        if (data) setUserInfo({ uid: user.uid, ...data } as AppUser);
      });
      return () => unsub();
    }
  }, [user]);

  // Load subscription data
  useEffect(() => {
    if (user) {
      const unsub1 = onValue(ref(db, "subscriptionPlans"), (snap) => {
        setPlans(snap.val() || {});
      });
      const unsub2 = onValue(ref(db, `userSubscriptions/${user.uid}`), (snap) => {
        const data = snap.val();
        if (data) {
          const sub = data as UserSubscription;
          if (sub.isActive && (!sub.expiresAt || sub.expiresAt > Date.now())) {
            setMySubscription(sub);
          } else {
            setMySubscription(null);
            // Store past subscription
            if (sub.planName) {
              setPastSubscriptions([sub]);
            }
          }
        } else {
          setMySubscription(null);
          setPastSubscriptions([]);
        }
      });
      return () => { unsub1(); unsub2(); };
    }
  }, [user]);

  // Load settings from Firebase
  useEffect(() => {
    const unsub = onValue(ref(db, "settings"), (snap) => {
      const data = snap.val();
      if (data) {
        if (data.privacyPolicy) setPrivacyPolicy(data.privacyPolicy);
        if (data.termsOfUse) setTermsOfUse(data.termsOfUse);
        if (data.appVersion) setAppVersion(data.appVersion);
        if (data.supportWhatsApp) setSupportWhatsApp(data.supportWhatsApp);
        if (data.appDownloadUrl) setAppDownloadUrl(data.appDownloadUrl);
        if (data.ownerName || data.ownerPhone || data.ownerInstagram || data.ownerFacebook) {
          setOwnerInfo(prev => ({
            name: data.ownerName || prev.name,
            phone: data.ownerPhone || prev.phone,
            instagram: data.ownerInstagram || prev.instagram,
            facebook: data.ownerFacebook || prev.facebook,
          }));
        }
        if (data.whatsappLink || data.instagramLink || data.facebookLink) {
          setSocialLinks(prev => ({
            whatsapp: data.whatsappLink || prev.whatsapp,
            instagram: data.instagramLink || prev.instagram,
            facebook: data.facebookLink || prev.facebook,
          }));
        }
      }
    });
    return () => unsub();
  }, []);

  const toggleAutoRenew = async () => {
    if (!user || !mySubscription) return;
    try {
      await update(ref(db, `userSubscriptions/${user.uid}`), { autoRenew: !mySubscription.autoRenew });
      toast.success(mySubscription.autoRenew ? t("more2.autoRenewOff") : t("more2.autoRenewOn"));
    } catch {
      toast.error(t("common.error"));
    }
  };

  const activePlans = Object.entries(plans).filter(([, p]) => p.isActive).map(([id, p]) => ({ id, ...p }));

  const menuItems = [
    ...(user ? [{ icon: UserIcon, label: t("more2.profile"), desc: t("more2.profileDesc"), color: "bg-[#E8F5E9] text-[#1B7A3D]", action: () => onNavigate?.("profile") }] : []),
    { icon: Shield, label: t("more2.privacyPolicy"), desc: t("more2.privacyDesc"), color: "bg-blue-50 text-blue-500", action: () => setShowPrivacy(true) },
    { icon: Scale, label: t("more2.termsOfUse"), desc: t("more2.termsDesc"), color: "bg-purple-50 text-purple-500", action: () => setShowTerms(true) },
    { icon: HeadphonesIcon, label: t("more2.contactSupport"), desc: t("more2.supportDesc"), color: "bg-green-50 text-green-500", action: () => setShowContact(true) },
    { icon: RefreshCw, label: t("more2.updates"), desc: `${t("more2.version")} ${appVersion}`, color: "bg-orange-50 text-orange-500" },
    { icon: Info, label: t("more2.aboutApp"), desc: t("more2.aboutDesc"), color: "bg-[#E8F5E9] text-[#1B7A3D]", action: () => setShowAbout(true) },
  ];

  // Default privacy policy text (Arabic)
  const defaultPrivacyPolicy = `سياسة الخصوصية — Apple.NET

نحن في Apple.NET نحترم خصوصيتك ونلتزم بحماية بياناتك الشخصية.

جمع البيانات:
• نجمع بيانات أساسية مثل الاسم والبريد الإلكتروني ورقم الهاتف عند التسجيل.
• نجمع بيانات المعاملات المالية (الإيداع والشراء) لضمان حقوقك.

استخدام البيانات:
• تُستخدم بياناتك لتقديم خدمات التطبيق وتحسينها.
• لا نشارك بياناتك مع أطراف ثالثة إلا بموافقتك أو بموجب القانون.

حماية البيانات:
• نستخدم تقنيات حماية متقدمة لتأمين بياناتك.
• يتم تخزين البيانات على خوادم آمنة ومشفرة.

حقوقك:
• يحق لك تعديل أو حذف بياناتك الشخصية في أي وقت.
• يمكنك التواصل معنا لأي استفسار حول خصوصيتك.

آخر تحديث: 2026`;

  // Default terms of use text (Arabic)
  const defaultTermsOfUse = `شروط الاستخدام — Apple.NET

باستخدامك لتطبيق Apple.NET فإنك توافق على الشروط التالية:

1. الاستخدام:
• يُستخدم التطبيق لشراء كروت الإنترنت وشحن الأرصدة بشكل قانوني.
• يُحظر استخدام التطبيق لأي أغراض غير مشروعة.

2. الحسابات:
• أنت مسؤول عن حفظ بيانات حسابك وعدم مشاركتها.
• يحق لنا تعليق أي حساب يخترق الشروط.

3. المدفوعات:
• جميع المعاملات المالية نهائية بعد التأكيد.
• لا يمكن استرداد قيمة الكروت المستخدمة.

4. الكروت:
• الكروت صالحة للاستخدام مرة واحدة فقط.
• لا نتحمل مسؤولية فقدان رمز الكرت بعد عرضه.

5. المسؤولية:
• نسعى لتقديم خدمة مستمرة وموثوقة لكن لا نضمن عدم انقطاعها.
• لا نتحمل مسؤولية أي أضرار غير مباشرة ناتجة عن استخدام التطبيق.

6. التعديلات:
• يحق لنا تعديل هذه الشروط في أي وقت مع إشعار المستخدمين.

آخر تحديث: 2026`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ type: "spring", stiffness: 120, damping: 14 }}
      className="px-4 pt-4"
      dir={isRTL ? "rtl" : "ltr"}
    >
      {/* Page Title */}
      <h2 className="text-xl font-black text-gray-900 mb-4">{t("more2.title")}</h2>

      {/* User Profile Card */}
      {user && userInfo ? (
        <div className="bg-gradient-to-bl from-[#E8F5E9] to-[#F0FFF4] rounded-2xl mb-5 p-5 border border-[#1B7A3D]/10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#1B7A3D] flex items-center justify-center shadow-sm">
              <span className="text-white font-bold text-lg">{(userInfo.displayName || "م")[0]}</span>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-gray-900 truncate">{userInfo.displayName}</h3>
              <p className="text-xs text-gray-500 truncate" dir="ltr">{userInfo.email}</p>
              {userInfo.phone && <p className="text-[10px] text-gray-400 truncate" dir="ltr">{userInfo.phone}</p>}
            </div>
            {isAdmin && (
              <span className="bg-[#1B7A3D] text-white text-[9px] font-bold px-2 py-0.5 rounded-full">{t("common.admin")}</span>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl card-shadow mb-4 p-5 text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#E8F5E9] flex items-center justify-center mx-auto mb-3">
            <Users className="w-7 h-7 text-[#1B7A3D]" />
          </div>
          <p className="text-gray-600 text-sm mb-3 font-semibold">{t("more2.loginForFeatures")}</p>
          <Button onClick={onAuthClick} className="bg-gradient-to-l from-[#1B7A3D] to-[#22A24D] text-white font-bold rounded-xl h-11">
            <LogIn className="w-4 h-4 ml-2" />{t("auth.login")}
          </Button>
        </div>
      )}

      {/* ====== My Subscriptions Section ====== */}
      {user && (
        <div className="mb-4">
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => setShowSubscriptions(!showSubscriptions)}
            className="w-full bg-white rounded-2xl card-shadow p-4 flex items-center gap-3 border-2 border-amber-200 hover:border-amber-400 transition-all"
          >
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center flex-shrink-0">
              <Crown className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1 text-right">
              <p className="text-sm font-black text-gray-900">{t("more2.mySubscriptions")}</p>
              <p className="text-[10px] text-gray-400">
                {mySubscription ? `✅ ${t("more2.active")}` : t("more2.noSubscription")}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {mySubscription && (
                <Badge className="bg-[#E8F5E9] text-[#1B7A3D] text-[9px]">{t("more2.active")}</Badge>
              )}
              {showSubscriptions ? (
                <ChevronLeft className="w-4 h-4 text-amber-500 rotate-90" />
              ) : (
                <ChevronLeft className="w-4 h-4 text-amber-500 -rotate-90" />
              )}
            </div>
          </motion.button>

          <AnimatePresence>
            {showSubscriptions && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                className="overflow-hidden"
              >
                <div className="space-y-3 mt-3">
                  {/* Active Subscription */}
                  {mySubscription ? (
                    <div className="bg-gradient-to-bl from-amber-400 to-orange-500 rounded-2xl p-4 card-shadow-lg text-white">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Crown className="w-5 h-5" />
                          <span className="font-bold text-sm">{mySubscription.planName}</span>
                        </div>
                        <Badge className="bg-white/20 text-white border-0 text-[10px]">✅ {t("more2.active")}</Badge>
                      </div>

                      {/* Details */}
                      <div className="space-y-2 mt-3">
                        <div className="flex items-center gap-2 text-white/80 text-xs">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>{t("more2.activationDate")}: {mySubscription.activatedAt ? formatDate(mySubscription.activatedAt) : ""}</span>
                        </div>
                        <div className="flex items-center gap-2 text-white/80 text-xs">
                          <Clock className="w-3.5 h-3.5" />
                          <span>{t("more2.expiryDate")}: {mySubscription.expiresAt ? formatDate(mySubscription.expiresAt) : ""}</span>
                        </div>

                        {/* Days remaining */}
                        {mySubscription.expiresAt && (
                          <div className="mt-2">
                            <div className="flex items-center justify-between text-white/60 text-[10px] mb-1">
                              <span>{t("more2.remaining")}</span>
                              <span>{Math.max(Math.ceil((mySubscription.expiresAt - Date.now()) / 86400000), 0)}</span>
                            </div>
                            <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{
                                  width: `${Math.max(Math.min(((mySubscription.expiresAt - Date.now()) / ((mySubscription.expiresAt - (mySubscription.activatedAt || mySubscription.expiresAt - 30 * 86400000))) * 100), 100), 0)}%`
                                }}
                                transition={{ duration: 0.8 }}
                                className="h-full bg-white/60 rounded-full"
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Auto-renewal toggle */}
                      <div className="mt-3 pt-3 border-t border-white/20">
                        <motion.button
                          whileTap={{ scale: 0.97 }}
                          onClick={toggleAutoRenew}
                          className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-white/10 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            {mySubscription.autoRenew ? (
                              <ToggleRight className="w-5 h-5 text-white" />
                            ) : (
                              <ToggleLeft className="w-5 h-5 text-white/50" />
                            )}
                            <span className="text-xs font-bold">
                              {mySubscription.autoRenew ? t("more2.autoRenewOn") : t("more2.autoRenewOff")}
                            </span>
                          </div>
                          <span className="text-[9px] text-white/50">
                            {mySubscription.autoRenew ? "🔄" : "⏸"}
                          </span>
                        </motion.button>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-white rounded-2xl card-shadow p-5 text-center">
                      <div className="w-14 h-14 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-3">
                        <Crown className="w-7 h-7 text-amber-400" />
                      </div>
                      <p className="text-gray-500 text-sm font-bold">{t("more2.noSubscription")}</p>
                    </div>
                  )}

                  {/* Past Subscriptions */}
                  {pastSubscriptions.length > 0 && (
                    <div>
                      {pastSubscriptions.map((sub, i) => (
                        <div key={i} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Crown className="w-4 h-4 text-gray-400" />
                              <span className="text-xs font-bold text-gray-600">{sub.planName}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-gray-400 mt-1">
                            <span>{sub.activatedAt ? formatDate(sub.activatedAt) : ""}</span>
                            <span>—</span>
                            <span>{sub.expiresAt ? formatDate(sub.expiresAt) : ""}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Available Plans */}
                  {activePlans.length > 0 && !mySubscription && (
                    <div>
                      {activePlans.map(plan => (
                        <div key={plan.id} className="bg-white rounded-xl card-shadow p-3 border border-amber-100">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-1.5">
                              <Crown className="w-3.5 h-3.5 text-amber-500" />
                              <span className="text-xs font-bold text-gray-900">{plan.name}</span>
                            </div>
                            <span className="text-sm font-black text-[#1B7A3D]">{plan.price.toLocaleString()} <span className="text-[9px] text-gray-400">ر.ي</span></span>
                          </div>
                          {plan.description && <p className="text-[10px] text-gray-400">{plan.description}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Menu Items */}
      <div className="space-y-3 pb-4">
        {menuItems.map((item, i) => (
          <motion.div
            key={i}
            whileTap={{ scale: 0.97 }}
            className="bg-white rounded-2xl card-shadow p-4 flex items-center gap-3 cursor-pointer hover:shadow-md transition-shadow active:bg-gray-50"
            onClick={item.action}
          >
            <div className={`w-10 h-10 rounded-xl ${item.color} flex items-center justify-center`}>
              <item.icon className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-gray-900">{item.label}</p>
              <p className="text-[10px] text-gray-400">{item.desc}</p>
            </div>
            <ChevronLeft className="w-4 h-4 text-gray-300" />
          </motion.div>
        ))}

        {/* Logout */}
        {user && (
          <motion.div
            whileTap={{ scale: 0.97 }}
            className="bg-red-50 rounded-2xl p-4 flex items-center gap-3 cursor-pointer hover:bg-red-100 transition-colors active:bg-red-200"
            onClick={async () => { await signOut(auth); toast.success(t("auth.logout")); }}
          >
            <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
              <LogOut className="w-5 h-5 text-red-500" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-red-600">{t("auth.logout")}</p>
            </div>
          </motion.div>
        )}
      </div>

      {/* Footer */}
      <div className="mt-8 text-center pb-8">
        <AppleNetLogo size="sm" />
        <p className="text-[10px] text-gray-300 mt-2">Apple.NET v{appVersion} — com.apple.net</p>
      </div>

      {/* ====== PRIVACY POLICY MODAL ====== */}
      <AnimatePresence>
        {showPrivacy && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-[9997]"
            onClick={() => setShowPrivacy(false)}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showPrivacy && (
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={iOSSpring.gentle}
            className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl z-[9998] shadow-2xl"
            style={{ maxHeight: "90vh", display: "flex", flexDirection: "column" }}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-2 flex-shrink-0">
              <div className="w-10 h-1 rounded-full bg-gray-300" />
            </div>

            {/* Header */}
            <div className="px-5 pb-3 flex items-center justify-between border-b border-gray-100 flex-shrink-0">
              <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
                <Shield className="w-5 h-5 text-blue-500" />
                {t("more2.privacyPolicy")}
              </h3>
              <button onClick={() => setShowPrivacy(false)} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            {/* Content */}
            <div className="overflow-y-auto flex-1 px-5 py-4">
              <div className="prose prose-sm max-w-none text-gray-700 leading-relaxed whitespace-pre-line">
                {privacyPolicy || defaultPrivacyPolicy}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ====== TERMS OF USE MODAL ====== */}
      <AnimatePresence>
        {showTerms && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-[9997]"
            onClick={() => setShowTerms(false)}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showTerms && (
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={iOSSpring.gentle}
            className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl z-[9998] shadow-2xl"
            style={{ maxHeight: "90vh", display: "flex", flexDirection: "column" }}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-2 flex-shrink-0">
              <div className="w-10 h-1 rounded-full bg-gray-300" />
            </div>

            {/* Header */}
            <div className="px-5 pb-3 flex items-center justify-between border-b border-gray-100 flex-shrink-0">
              <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
                <Scale className="w-5 h-5 text-purple-500" />
                {t("more2.termsOfUse")}
              </h3>
              <button onClick={() => setShowTerms(false)} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            {/* Content */}
            <div className="overflow-y-auto flex-1 px-5 py-4">
              <div className="prose prose-sm max-w-none text-gray-700 leading-relaxed whitespace-pre-line">
                {termsOfUse || defaultTermsOfUse}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ====== CONTACT SUPPORT MODAL ====== */}
      <AnimatePresence>
        {showContact && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-[9997]"
            onClick={() => setShowContact(false)}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showContact && (
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={iOSSpring.gentle}
            className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl z-[9998] shadow-2xl"
            style={{ maxHeight: "90vh", display: "flex", flexDirection: "column" }}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-2 flex-shrink-0">
              <div className="w-10 h-1 rounded-full bg-gray-300" />
            </div>

            {/* Header */}
            <div className="px-5 pb-3 flex items-center justify-between border-b border-gray-100 flex-shrink-0">
              <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
                <HeadphonesIcon className="w-5 h-5 text-green-500" />
                {t("more2.contactSupport")}
              </h3>
              <button onClick={() => setShowContact(false)} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            {/* Content */}
            <div className="overflow-y-auto flex-1 px-5 py-4">
              <div className="text-center mb-6">
                <div className="w-16 h-16 rounded-full bg-[#E8F5E9] flex items-center justify-center mx-auto mb-3">
                  <MessageCircle className="w-8 h-8 text-[#1B7A3D]" />
                </div>
                <h4 className="text-lg font-black text-gray-900">{t("more2.supportTeam")}</h4>
              </div>

              <div className="space-y-3">
                {/* WhatsApp */}
                <a
                  href={generateWhatsAppLink(supportWhatsApp, "")}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-4 rounded-2xl bg-[#E8F5E9] hover:bg-green-100 transition-colors"
                >
                  <div className="w-12 h-12 rounded-xl bg-[#1B7A3D] flex items-center justify-center flex-shrink-0">
                    <MessageCircle className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-gray-900">{t("more2.whatsapp")}</p>
                  </div>
                  <ChevronLeft className="w-4 h-4 text-gray-300 rotate-180" />
                </a>

                {/* Phone */}
                <a
                  href={`tel:+${supportWhatsApp}`}
                  className="flex items-center gap-3 p-4 rounded-2xl bg-blue-50 hover:bg-blue-100 transition-colors"
                >
                  <div className="w-12 h-12 rounded-xl bg-blue-500 flex items-center justify-center flex-shrink-0">
                    <Phone className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-gray-900">{t("more2.phoneCall")}</p>
                    <p className="text-[10px] text-gray-400" dir="ltr">+{supportWhatsApp}</p>
                  </div>
                  <ChevronLeft className="w-4 h-4 text-gray-300 rotate-180" />
                </a>

                {/* Email */}
                <a
                  href="mailto:support@apple-net.com"
                  className="flex items-center gap-3 p-4 rounded-2xl bg-purple-50 hover:bg-purple-100 transition-colors"
                >
                  <div className="w-12 h-12 rounded-xl bg-purple-500 flex items-center justify-center flex-shrink-0">
                    <Mail className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-gray-900">{t("more2.email")}</p>
                    <p className="text-[10px] text-gray-400" dir="ltr">support@apple-net.com</p>
                  </div>
                  <ChevronLeft className="w-4 h-4 text-gray-300 rotate-180" />
                </a>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ====== ABOUT APP MODAL ====== */}
      <AnimatePresence>
        {showAbout && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-[9997]"
            onClick={() => setShowAbout(false)}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showAbout && (
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={iOSSpring.gentle}
            className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl z-[9998] shadow-2xl"
            style={{ maxHeight: "90vh", display: "flex", flexDirection: "column" }}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-2 flex-shrink-0">
              <div className="w-10 h-1 rounded-full bg-gray-300" />
            </div>

            {/* Header */}
            <div className="px-5 pb-3 flex items-center justify-between border-b border-gray-100 flex-shrink-0">
              <h3 className="text-lg font-black text-gray-900">{t("more2.aboutApp")}</h3>
              <button onClick={() => setShowAbout(false)} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            {/* Content */}
            <div className="overflow-y-auto flex-1 px-5 py-4">
              {/* App Icon & Info */}
              <div className="flex flex-col items-center text-center mb-6">
                <div className="w-20 h-20 rounded-3xl overflow-hidden shadow-lg border-2 border-[#E8F5E9] mb-4">
                  <img src="/images/IMG_20260527_220851.jpg" alt="Apple.NET" className="w-full h-full object-cover" />
                </div>
                <AppleNetLogo size="md" />
                <p className="text-xs text-gray-400 mt-1">{t("more2.versionLabel")} {appVersion}</p>
                <div className="flex items-center gap-1 mt-2">
                  {[1, 2, 3, 4, 5].map(i => (
                    <Star key={i} className="w-4 h-4 text-amber-400 fill-amber-400" />
                  ))}
                </div>
              </div>

              {/* App Description */}
              <div className="bg-[#E8F5E9] rounded-2xl p-4 mb-4">
                <p className="text-sm text-gray-700 leading-relaxed">
                  Apple.NET
                </p>
              </div>

              {/* Owner Info */}
              <div className="bg-white rounded-2xl card-shadow overflow-hidden mb-4">
                <div className="bg-gradient-to-l from-[#1B7A3D] to-[#22A24D] p-4">
                  <p className="text-[10px] text-white/70 font-bold uppercase tracking-wider mb-2">{t("more2.owner")}</p>
                  <div className="flex items-center gap-3">
                    <img src="/images/IMG-20260527-WA0045.jpg" alt={ownerInfo.name} className="w-14 h-14 rounded-2xl object-cover border-2 border-white/30 shadow-md" />
                    <div>
                      <h3 className="text-base font-black text-white">{ownerInfo.name}</h3>
                      <p className="text-xs text-white/80">Apple.NET</p>
                    </div>
                  </div>
                </div>
                <div className="p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#E8F5E9] flex items-center justify-center">
                      <Crown className="w-4 h-4 text-[#1B7A3D]" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-900">{t("more2.owner")}</p>
                      <p className="text-[10px] text-gray-400">Apple.NET</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
                      <Globe className="w-4 h-4 text-blue-500" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-900">Apple.NET HotSpot</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-purple-50 flex items-center justify-center">
                      <Wifi className="w-4 h-4 text-purple-500" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-900">WiFi / HotSpot</p>
                    </div>
                  </div>
                </div>

                {/* Social Links */}
                <div className="px-4 pb-4">
                  <div className="flex gap-2">
                    <a
                      href={socialLinks.whatsapp}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 py-2.5 rounded-xl bg-[#E8F5E9] flex items-center justify-center gap-1.5 hover:bg-green-100 transition-colors haptic-press"
                    >
                      <MessageCircle className="w-4 h-4 text-[#1B7A3D]" />
                      <span className="text-[10px] font-bold text-[#1B7A3D]">{t("more2.whatsapp")}</span>
                    </a>
                    <a
                      href={socialLinks.instagram}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 py-2.5 rounded-xl bg-pink-50 flex items-center justify-center gap-1.5 hover:bg-pink-100 transition-colors haptic-press"
                    >
                      <Instagram className="w-4 h-4 text-pink-500" />
                      <span className="text-[10px] font-bold text-pink-500">Instagram</span>
                    </a>
                    <a
                      href={socialLinks.facebook}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 py-2.5 rounded-xl bg-blue-50 flex items-center justify-center gap-1.5 hover:bg-blue-100 transition-colors haptic-press"
                    >
                      <Facebook className="w-4 h-4 text-blue-500" />
                      <span className="text-[10px] font-bold text-blue-500">Facebook</span>
                    </a>
                  </div>
                </div>
              </div>

              {/* App Technical Info */}
              <div className="bg-white rounded-2xl card-shadow p-4 mb-4">
                <h4 className="text-sm font-black text-gray-900 mb-3 flex items-center gap-2">
                  <Code className="w-4 h-4 text-[#1B7A3D]" />
                  App Info
                </h4>
                <div className="space-y-2.5">
                  {[
                    { label: t("more2.version"), value: appVersion },
                    { label: t("more2.platform"), value: "Web + Android" },
                    { label: t("more2.framework"), value: "Next.js 16" },
                    { label: t("more2.database"), value: "Firebase Realtime DB" },
                    { label: t("more2.design"), value: "iOS-style RTL" },
                    { label: t("more2.language"), value: "العربية / English" },
                    { label: t("more2.developer"), value: ownerInfo.name },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                      <span className="text-xs text-gray-400">{item.label}</span>
                      <span className="text-xs font-bold text-gray-700">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Download APK */}
              <div className="bg-gradient-to-br from-[#E6F9EE] to-[#D0F0DB] rounded-2xl p-4 mb-4 border border-[#1B7A3D]/20">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-11 h-11 rounded-2xl bg-white shadow-sm flex items-center justify-center">
                    <Download className="w-5 h-5 text-[#1B7A3D]" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">{t("more2.downloadAndroid")}</p>
                    <p className="text-[10px] text-gray-400">{t("more2.originalApk")}</p>
                  </div>
                </div>
                {appDownloadUrl ? (
                  <a
                    href={appDownloadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full bg-gradient-to-l from-[#1B7A3D] to-[#22A24D] text-white font-bold rounded-xl h-11 flex items-center justify-center gap-2 text-sm btn-green-shadow haptic-press"
                  >
                    <Download className="w-4 h-4" />
                    {t("more2.downloadApk")}
                  </a>
                ) : null}
              </div>

              {/* Made with love */}
              <div className="text-center py-4">
                <p className="text-[10px] text-gray-300 flex items-center justify-center gap-1">
                  {t("more2.madeIn")} <Heart className="w-3 h-3 text-red-400 fill-red-400" /> {t("more2.inYemen")}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
