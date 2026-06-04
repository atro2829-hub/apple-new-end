"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Eye, EyeOff, Mail, Lock, User, Phone, CheckCircle2, ArrowRight,
  Shield, Wifi, Zap, ChevronLeft, Globe, Building2, MapPin
} from "lucide-react";
import { auth, db } from "@/lib/firebase";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { ref, set, update } from "firebase/database";
import { toast } from "sonner";
import { AppleNetLogo } from "./AppleNetLogo";
import { sanitizeInput, isValidEmail, isValidYemenPhone } from "@/lib/utils";
import { PROVINCES, getDistricts } from "@/lib/constants";
import { useLanguage } from "@/context/LanguageContext";

interface AuthFormProps {
  mode: "login" | "register";
  onSuccess: () => void;
  onSwitchMode: () => void;
  onBack?: () => void;
}

// Firebase error code to i18n translation key mapping
const FIREBASE_ERROR_KEYS: Record<string, string> = {
  "auth/email-already-in-use": "auth2.emailAlreadyUsed",
  "auth/wrong-password": "auth2.wrongPassword",
  "auth/user-not-found": "auth2.userNotFound",
  "auth/invalid-email": "auth2.invalidEmail",
  "auth/too-many-requests": "auth2.tooManyRequests",
  "auth/weak-password": "auth2.weakPassword",
  "auth/invalid-credential": "auth2.invalidCredential",
};

function getLocalizedError(err: unknown, t: (path: string) => string): string {
  if (err && typeof err === "object" && "code" in err) {
    const code = (err as { code: string }).code;
    if (FIREBASE_ERROR_KEYS[code]) return t(FIREBASE_ERROR_KEYS[code]);
  }
  if (err instanceof Error) {
    for (const [code, key] of Object.entries(FIREBASE_ERROR_KEYS)) {
      if (err.message.includes(code)) return t(key);
    }
    return err.message;
  }
  return t("auth2.unexpectedError");
}

// Feature card definitions (icon only — titles/descs come from i18n)
const FEATURE_ICONS = [Wifi, Zap, Shield, Globe];
const FEATURE_TITLE_KEYS = [
  "auth2.feature1Title",
  "auth2.feature2Title",
  "auth2.feature3Title",
  "auth2.feature4Title",
];
const FEATURE_DESC_KEYS = [
  "auth2.feature1Desc",
  "auth2.feature2Desc",
  "auth2.feature3Desc",
  "auth2.feature4Desc",
];

export function AuthForm({ mode, onSuccess, onSwitchMode, onBack }: AuthFormProps) {
  const { t, isRTL } = useLanguage();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resetMode, setResetMode] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [provinceId, setProvinceId] = useState("");
  const [district, setDistrict] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isValidEmail(email)) {
      toast.error(t("auth2.invalidEmail"));
      return;
    }

    if (mode === "register" && phone && !/^7[0-9]{8}$/.test(phone)) {
      toast.error(t("auth2.invalidPhone"));
      return;
    }

    setSubmitting(true);
    try {
      if (mode === "register") {
        const sanitizedName = sanitizeInput(name);
        const sanitizedPhone = sanitizeInput(phone);
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        const provinceObj = PROVINCES.find(p => p.id === provinceId);
        await set(ref(db, `users/${cred.user.uid}`), {
          email, displayName: sanitizedName, phone: sanitizedPhone, role: "user", balance: 0, createdAt: Date.now(), isActive: true,
          provinceId: provinceId || null,
          provinceName: provinceObj?.name || null,
          district: district || null,
        });
        await set(ref(db, `credit/${cred.user.uid}`), {
          amount: 0, updatedAt: Date.now(),
        });
        toast.success(t("auth2.accountCreated"));
      } else {
        await signInWithEmailAndPassword(auth, email, password);
        toast.success(t("auth2.loginSuccess"));
      }
      onSuccess();
    } catch (err: unknown) {
      toast.error(getLocalizedError(err, t));
    }
    setSubmitting(false);
  };

  const handleResetPassword = async () => {
    if (!email) { toast.error(t("auth2.enterEmailFirst")); return; }
    try {
      await sendPasswordResetEmail(auth, email);
      setResetSent(true);
      toast.success(t("auth2.resetSentDesc"));
    } catch (err: unknown) {
      toast.error(getLocalizedError(err, t));
    }
  };

  // ─── Password Reset Confirmation Screen ──────────────────
  if (resetMode && resetSent) {
    return (
      <div className="min-h-screen bg-white dark:bg-slate-900 flex flex-col" dir={isRTL ? "rtl" : "ltr"}>
        {/* Header */}
        <div className="flex-shrink-0 px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => { setResetMode(false); setResetSent(false); }}
            className="w-10 h-10 rounded-2xl bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors haptic-press"
          >
            <ArrowRight className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 pb-20">
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="w-20 h-20 rounded-full bg-[#E8F5E9] flex items-center justify-center mb-6"
          >
            <CheckCircle2 className="w-10 h-10 text-[#1B7A3D]" />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="w-full max-w-sm"
          >
            <h2 className="text-center text-gray-900 font-black text-2xl mb-2">{t("auth2.resetSent")}</h2>
            <p className="text-center text-gray-500 text-sm mb-5 leading-relaxed">
              {t("auth2.resetSentDesc")}
            </p>
            <div className="bg-[#E8F5E9] rounded-xl px-4 py-3 mb-5 flex items-center gap-2 border border-[#1B7A3D]/10">
              <Mail className="w-4 h-4 text-[#1B7A3D] shrink-0" />
              <span className="text-sm font-bold text-gray-900 truncate" dir="ltr">{email}</span>
            </div>
            <p className="text-center text-gray-400 text-xs mb-6">
              {t("auth2.checkInbox")}
            </p>
            <Button
              onClick={() => { setResetMode(false); setResetSent(false); }}
              className="w-full bg-gradient-to-l from-[#1B7A3D] to-[#22A24D] hover:from-[#165E30] hover:to-[#134D28] text-white font-bold rounded-2xl h-12 btn-green-shadow text-base"
            >
              <ArrowRight className="w-4 h-4 ml-1.5" />
              {t("auth2.backToLogin")}
            </Button>
          </motion.div>
        </div>
      </div>
    );
  }

  // ─── Password Reset Request Screen ───────────────────────
  if (resetMode) {
    return (
      <div className="min-h-screen bg-white dark:bg-slate-900 flex flex-col" dir={isRTL ? "rtl" : "ltr"}>
        {/* Header */}
        <div className="flex-shrink-0 px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => setResetMode(false)}
            className="w-10 h-10 rounded-2xl bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors haptic-press"
          >
            <ArrowRight className="w-5 h-5 text-gray-600" />
          </button>
          <h1 className="text-sm font-black text-gray-900">{t("auth2.forgotPasswordTitle")}</h1>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 pb-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="w-full max-w-sm"
          >
            {/* Icon */}
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 rounded-2xl bg-[#E8F5E9] flex items-center justify-center">
                <Lock className="w-8 h-8 text-[#1B7A3D]" />
              </div>
            </div>

            <h2 className="text-center text-gray-900 font-black text-2xl mb-2">{t("auth2.forgotPassword")}</h2>
            <p className="text-center text-gray-500 text-sm mb-8 leading-relaxed">
              {t("auth2.resetDesc")}
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1.5 font-bold">{t("auth2.emailAddress")}</label>
                <div className="relative">
                  <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="bg-gray-50 border-gray-200 text-gray-900 rounded-xl h-12 text-sm pr-10 focus:border-[#1B7A3D] focus:ring-[#1B7A3D]"
                    placeholder="example@email.com"
                    dir="ltr"
                  />
                </div>
              </div>

              <Button
                onClick={handleResetPassword}
                disabled={submitting}
                className="w-full bg-gradient-to-l from-[#1B7A3D] to-[#22A24D] hover:from-[#165E30] hover:to-[#134D28] text-white font-bold rounded-2xl h-12 btn-green-shadow text-base"
              >
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    {t("auth2.sending")}
                  </span>
                ) : t("auth2.sendResetLink")}
              </Button>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  // ─── Main Login / Register Full-Page Screen ──────────────
  return (
    <div className="h-screen bg-white dark:bg-slate-900 flex flex-col" dir={isRTL ? "rtl" : "ltr"}>
      {/* ===== Top Header ===== */}
      <div className="flex-shrink-0 px-4 py-3 flex items-center justify-between">
        <button
          onClick={onBack}
          className="w-10 h-10 rounded-2xl bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors haptic-press"
        >
          <ArrowRight className="w-5 h-5 text-gray-600" />
        </button>
        <AppleNetLogo size="sm" />
        <div className="w-10" /> {/* spacer */}
      </div>

      {/* ===== Scrollable Content ===== */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-6 pt-2 pb-8 max-w-sm mx-auto">

          {/* Hero Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="text-center mb-4"
          >
            {/* App Icon */}
            <div className="flex justify-center mb-2">
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 15 }}
                className="w-20 h-20 rounded-3xl overflow-hidden border-2 border-[#E8F5E9] shadow-lg"
              >
                <img src="/images/IMG_20260527_220851.jpg" alt="Apple.NET" className="w-full h-full object-cover" />
              </motion.div>
            </div>

            <h1 className="text-2xl font-black text-gray-900 mb-1">
              {mode === "login" ? t("auth2.welcomeBack") : t("auth2.joinUs")}
            </h1>
            <p className="text-gray-500 text-sm leading-relaxed">
              {mode === "login"
                ? t("auth2.loginDesc")
                : t("auth2.registerDesc")
              }
            </p>
          </motion.div>

          {/* ===== Form ===== */}
          <motion.form
            onSubmit={handleSubmit}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="space-y-3"
          >
            <AnimatePresence mode="wait">
              {mode === "register" && (
                <motion.div
                  key="register-fields"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 25 }}
                  className="space-y-3 overflow-hidden"
                >
                  {/* Name Field */}
                  <div>
                    <label className="block text-xs text-gray-500 mb-1.5 font-bold">{t("auth2.fullName")}</label>
                    <div className="relative">
                      <User className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="bg-gray-50 border-gray-200 text-gray-900 rounded-xl h-11 text-sm pr-10 focus:border-[#1B7A3D] focus:ring-[#1B7A3D]"
                        placeholder={t("auth2.enterName")}
                        required
                      />
                    </div>
                  </div>

                  {/* Phone Field */}
                  <div>
                    <label className="block text-xs text-gray-500 mb-1.5 font-bold">{t("auth2.phoneNumber")}</label>
                    <div className="flex gap-0" dir="ltr">
                      {/* Fixed country code */}
                      <div className="flex items-center gap-1.5 bg-gray-100 border border-gray-200 rounded-xl px-3 h-11 flex-shrink-0 border-r-0 rounded-r-none">
                        <span className="text-base">🇾🇪</span>
                        <span className="text-sm font-bold text-gray-600">+967</span>
                      </div>
                      {/* Phone input - 9 digits only */}
                      <div className="relative flex-1">
                        <Input
                          value={phone}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, "").slice(0, 9);
                            setPhone(val);
                          }}
                          className="bg-gray-50 border-gray-200 text-gray-900 rounded-xl rounded-l-none h-11 text-sm focus:border-[#1B7A3D] focus:ring-[#1B7A3D] border-l-0"
                          placeholder="7XXXXXXXX"
                          dir="ltr"
                          maxLength={9}
                        />
                      </div>
                    </div>
                  </div>


                </motion.div>
              )}
            </AnimatePresence>

            {/* Email Field */}
            <div>
              <label className="block text-xs text-gray-500 mb-1.5 font-bold">{t("auth2.emailAddress")}</label>
              <div className="relative">
                <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-gray-50 border-gray-200 text-gray-900 rounded-xl h-11 text-sm pr-10 focus:border-[#1B7A3D] focus:ring-[#1B7A3D]"
                  placeholder="example@email.com"
                  dir="ltr"
                  required
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label className="block text-xs text-gray-500 mb-1.5 font-bold">{t("auth2.password")}</label>
              <div className="relative">
                <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-gray-50 border-gray-200 text-gray-900 rounded-xl h-11 text-sm pr-10 pl-10 focus:border-[#1B7A3D] focus:ring-[#1B7A3D]"
                  placeholder="••••••••"
                  dir="ltr"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#1B7A3D] transition-colors"
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Province / District Selection (register only) */}
            {mode === "register" && (
              <div className="space-y-3">
                {/* Province Field */}
                <div>
                  <label className="block text-xs text-gray-500 mb-1.5 font-bold">
                    {t("location.province")} <span className="text-gray-300">({t("auth2.optional")})</span>
                  </label>
                  <div className="relative">
                    <Globe className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <select
                      value={provinceId}
                      onChange={(e) => { setProvinceId(e.target.value); setDistrict(""); }}
                      className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-xl h-11 text-sm pr-10 pl-4 focus:border-[#1B7A3D] focus:ring-[#1B7A3D] appearance-none"
                    >
                      <option value="">{t("location.selectProvince")}</option>
                      {PROVINCES.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* District Field */}
                <div>
                  <label className="block text-xs text-gray-500 mb-1.5 font-bold">
                    {t("location.district")} <span className="text-gray-300">({t("auth2.optional")})</span>
                  </label>
                  <div className="relative">
                    <Building2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <select
                      value={district}
                      onChange={(e) => setDistrict(e.target.value)}
                      disabled={!provinceId}
                      className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-xl h-11 text-sm pr-10 pl-4 focus:border-[#1B7A3D] focus:ring-[#1B7A3D] appearance-none disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <option value="">{provinceId ? t("location.selectDistrict") : t("location.selectProvinceFirst")}</option>
                      {provinceId && getDistricts(provinceId).map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Forgot Password (Login only) */}
            {mode === "login" && (
              <div className="text-left">
                <button
                  type="button"
                  onClick={() => setResetMode(true)}
                  className="text-xs text-[#1B7A3D] font-bold hover:underline transition-colors"
                >
                  {t("auth2.forgotPassword")}
                </button>
              </div>
            )}

            {/* Submit Button */}
            <motion.div whileTap={{ scale: 0.98 }}>
              <Button
                type="submit"
                disabled={submitting}
                className="w-full bg-gradient-to-l from-[#1B7A3D] to-[#22A24D] hover:from-[#165E30] hover:to-[#134D28] text-white font-bold text-base rounded-2xl h-11 btn-green-shadow disabled:opacity-70"
              >
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    {t("auth2.processing")}
                  </span>
                ) : mode === "login" ? (
                  t("auth.login")
                ) : (
                  t("auth.register")
                )}
              </Button>
            </motion.div>

            {/* Switch Mode */}
            <div className="text-center pt-1">
              <button
                type="button"
                onClick={onSwitchMode}
                className="text-[#1B7A3D] text-sm font-bold hover:underline transition-colors"
              >
                {mode === "login" ? t("auth2.noAccount") : t("auth2.hasAccount")}
              </button>
            </div>
          </motion.form>

          {/* ===== Features Section ===== */}
          {mode === "login" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.4 }}
            className="mt-10"
          >
            <div className="grid grid-cols-2 gap-3">
              {FEATURE_ICONS.map((Icon, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35 + i * 0.08 }}
                  className="bg-gray-50 rounded-2xl p-3 text-center"
                >
                  <div className="w-9 h-9 rounded-xl bg-[#E8F5E9] flex items-center justify-center mx-auto mb-2">
                    <Icon className="w-4 h-4 text-[#1B7A3D]" />
                  </div>
                  <p className="text-[11px] font-black text-gray-900">{t(FEATURE_TITLE_KEYS[i])}</p>
                  <p className="text-[9px] text-gray-400 mt-0.5 leading-relaxed">{t(FEATURE_DESC_KEYS[i])}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
          )}

          {/* ===== Bottom Info ===== */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-8 text-center"
          >
            <p className="text-[10px] text-gray-300 leading-relaxed">
              {t("auth2.agreeTerms")}{" "}
              <a href="/terms" className="text-[#1B7A3D] hover:underline">{t("auth2.termsOfUse")}</a>
              {" "}{t("auth2.and")}{" "}
              <a href="/privacy" className="text-[#1B7A3D] hover:underline">{t("auth2.privacyPolicy")}</a>
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
