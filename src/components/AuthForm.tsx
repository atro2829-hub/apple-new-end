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

// Arabic Firebase error message map
const FIREBASE_ERRORS_AR: Record<string, string> = {
  "auth/email-already-in-use": "هذا البريد مسجل مسبقاً. سجل الدخول بدلاً من ذلك",
  "auth/wrong-password": "كلمة المرور غير صحيحة",
  "auth/user-not-found": "لا يوجد حساب بهذا البريد",
  "auth/invalid-email": "البريد الإلكتروني غير صالح",
  "auth/too-many-requests": "تم حظر الوصول مؤقتاً بسبب محاولات كثيرة. حاول لاحقاً",
  "auth/weak-password": "كلمة المرور ضعيفة. استخدم 6 أحرف على الأقل",
  "auth/invalid-credential": "بيانات الدخول غير صحيحة",
};

function getArabicError(err: unknown): string {
  if (err && typeof err === "object" && "code" in err) {
    const code = (err as { code: string }).code;
    if (FIREBASE_ERRORS_AR[code]) return FIREBASE_ERRORS_AR[code];
  }
  if (err instanceof Error) {
    for (const [code, msg] of Object.entries(FIREBASE_ERRORS_AR)) {
      if (err.message.includes(code)) return msg;
    }
    return err.message;
  }
  return "حدث خطأ غير متوقع";
}

// Feature cards for the side panel / background
const FEATURES = [
  { icon: Wifi, title: "كروت هوت سبوت", desc: "شراء كروت إنترنت فورية من شبكات متعددة" },
  { icon: Zap, title: "شحن فوري", desc: "شحن رصيدك بسرعة عبر البنوك أو أكواد الشحن" },
  { icon: Shield, title: "آمن وموثوق", desc: "حماية كاملة لبياناتك ومعاملاتك المالية" },
  { icon: Globe, title: "تغطية واسعة", desc: "شبكات متاحة في مختلف المحافظات اليمنية" },
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
      toast.error("البريد الإلكتروني غير صالح");
      return;
    }

    if (mode === "register" && phone && !isValidYemenPhone(phone)) {
      toast.error("رقم الهاتف غير صالح. استخدم صيغة يمنية مثل +9677XXXXXXXX");
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
        toast.success("تم إنشاء الحساب بنجاح!");
      } else {
        await signInWithEmailAndPassword(auth, email, password);
        toast.success("تم تسجيل الدخول بنجاح!");
      }
      onSuccess();
    } catch (err: unknown) {
      toast.error(getArabicError(err));
    }
    setSubmitting(false);
  };

  const handleResetPassword = async () => {
    if (!email) { toast.error("أدخل بريدك الإلكتروني أولاً"); return; }
    try {
      await sendPasswordResetEmail(auth, email);
      setResetSent(true);
      toast.success("تم إرسال رابط إعادة تعيين كلمة المرور لبريدك");
    } catch (err: unknown) {
      toast.error(getArabicError(err));
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
            <h2 className="text-center text-gray-900 font-black text-2xl mb-2">تم الإرسال بنجاح!</h2>
            <p className="text-center text-gray-500 text-sm mb-5 leading-relaxed">
              تم إرسال رابط إعادة تعيين كلمة المرور إلى
            </p>
            <div className="bg-[#E8F5E9] rounded-xl px-4 py-3 mb-5 flex items-center gap-2 border border-[#1B7A3D]/10">
              <Mail className="w-4 h-4 text-[#1B7A3D] shrink-0" />
              <span className="text-sm font-bold text-gray-900 truncate" dir="ltr">{email}</span>
            </div>
            <p className="text-center text-gray-400 text-xs mb-6">
              تحقق من صندوق الوارد والبريد غير المرغوب فيه
            </p>
            <Button
              onClick={() => { setResetMode(false); setResetSent(false); }}
              className="w-full bg-gradient-to-l from-[#1B7A3D] to-[#22A24D] hover:from-[#165E30] hover:to-[#134D28] text-white font-bold rounded-2xl h-12 btn-green-shadow text-base"
            >
              <ArrowRight className="w-4 h-4 ml-1.5" />
              العودة لتسجيل الدخول
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
          <h1 className="text-sm font-black text-gray-900">نسيت كلمة المرور</h1>
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

            <h2 className="text-center text-gray-900 font-black text-2xl mb-2">نسيت كلمة المرور؟</h2>
            <p className="text-center text-gray-500 text-sm mb-8 leading-relaxed">
              أدخل بريدك الإلكتروني وسنرسل لك رابط إعادة التعيين
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1.5 font-bold">البريد الإلكتروني</label>
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
                    جاري الإرسال...
                  </span>
                ) : "إرسال رابط التعيين"}
              </Button>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  // ─── Main Login / Register Full-Page Screen ──────────────
  return (
    <div className="min-h-screen bg-white dark:bg-slate-900 flex flex-col" dir={isRTL ? "rtl" : "ltr"}>
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
        <div className="px-6 pt-4 pb-8 max-w-sm mx-auto">

          {/* Hero Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="text-center mb-8"
          >
            {/* App Icon */}
            <div className="flex justify-center mb-4">
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
              {mode === "login" ? "مرحباً بعودتك! 👋" : "انضم إلينا 🚀"}
            </h1>
            <p className="text-gray-500 text-sm leading-relaxed">
              {mode === "login"
                ? "سجل الدخول لمتابعة استخدام AppleNet والوصول لكل المزايا"
                : "أنشئ حسابك وابدأ بشراء كروت الإنترنت بسهولة وأمان"
              }
            </p>
          </motion.div>

          {/* ===== Form ===== */}
          <motion.form
            onSubmit={handleSubmit}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="space-y-4"
          >
            <AnimatePresence mode="wait">
              {mode === "register" && (
                <motion.div
                  key="register-fields"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 25 }}
                  className="space-y-4 overflow-hidden"
                >
                  {/* Name Field */}
                  <div>
                    <label className="block text-xs text-gray-500 mb-1.5 font-bold">الاسم الكامل</label>
                    <div className="relative">
                      <User className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="bg-gray-50 border-gray-200 text-gray-900 rounded-xl h-12 text-sm pr-10 focus:border-[#1B7A3D] focus:ring-[#1B7A3D]"
                        placeholder="أدخل اسمك الكامل"
                        required
                      />
                    </div>
                  </div>

                  {/* Phone Field */}
                  <div>
                    <label className="block text-xs text-gray-500 mb-1.5 font-bold">رقم الهاتف <span className="text-gray-300">(اختياري)</span></label>
                    <div className="relative">
                      <Phone className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="bg-gray-50 border-gray-200 text-gray-900 rounded-xl h-12 text-sm pr-10 focus:border-[#1B7A3D] focus:ring-[#1B7A3D]"
                        placeholder="+967 7XXXXXXXX"
                        dir="ltr"
                      />
                    </div>
                  </div>


                </motion.div>
              )}
            </AnimatePresence>

            {/* Email Field */}
            <div>
              <label className="block text-xs text-gray-500 mb-1.5 font-bold">البريد الإلكتروني</label>
              <div className="relative">
                <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-gray-50 border-gray-200 text-gray-900 rounded-xl h-12 text-sm pr-10 focus:border-[#1B7A3D] focus:ring-[#1B7A3D]"
                  placeholder="example@email.com"
                  dir="ltr"
                  required
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label className="block text-xs text-gray-500 mb-1.5 font-bold">كلمة المرور</label>
              <div className="relative">
                <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-gray-50 border-gray-200 text-gray-900 rounded-xl h-12 text-sm pr-10 pl-10 focus:border-[#1B7A3D] focus:ring-[#1B7A3D]"
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
              <div className="space-y-4">
                {/* Province Field */}
                <div>
                  <label className="block text-xs text-gray-500 mb-1.5 font-bold">
                    المحافظة <span className="text-gray-300">(اختياري)</span>
                  </label>
                  <div className="relative">
                    <Globe className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <select
                      value={provinceId}
                      onChange={(e) => { setProvinceId(e.target.value); setDistrict(""); }}
                      className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-xl h-12 text-sm pr-10 pl-4 focus:border-[#1B7A3D] focus:ring-[#1B7A3D] appearance-none"
                    >
                      <option value="">اختر المحافظة</option>
                      {PROVINCES.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* District Field */}
                <div>
                  <label className="block text-xs text-gray-500 mb-1.5 font-bold">
                    المديرية <span className="text-gray-300">(اختيارية)</span>
                  </label>
                  <div className="relative">
                    <Building2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <select
                      value={district}
                      onChange={(e) => setDistrict(e.target.value)}
                      disabled={!provinceId}
                      className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-xl h-12 text-sm pr-10 pl-4 focus:border-[#1B7A3D] focus:ring-[#1B7A3D] appearance-none disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <option value="">{provinceId ? "اختر المديرية" : "اختر المحافظة أولاً"}</option>
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
                  نسيت كلمة المرور؟
                </button>
              </div>
            )}

            {/* Submit Button */}
            <motion.div whileTap={{ scale: 0.98 }}>
              <Button
                type="submit"
                disabled={submitting}
                className="w-full bg-gradient-to-l from-[#1B7A3D] to-[#22A24D] hover:from-[#165E30] hover:to-[#134D28] text-white font-bold text-base rounded-2xl h-12 btn-green-shadow disabled:opacity-70"
              >
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    جاري المعالجة...
                  </span>
                ) : mode === "login" ? (
                  "تسجيل الدخول"
                ) : (
                  "إنشاء حساب"
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
                {mode === "login" ? "ليس لديك حساب؟ سجل الآن" : "لديك حساب؟ سجل الدخول"}
              </button>
            </div>
          </motion.form>

          {/* ===== Features Section ===== */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.4 }}
            className="mt-10"
          >
            <div className="grid grid-cols-2 gap-3">
              {FEATURES.map((feature, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35 + i * 0.08 }}
                  className="bg-gray-50 rounded-2xl p-3 text-center"
                >
                  <div className="w-9 h-9 rounded-xl bg-[#E8F5E9] flex items-center justify-center mx-auto mb-2">
                    <feature.icon className="w-4 h-4 text-[#1B7A3D]" />
                  </div>
                  <p className="text-[11px] font-black text-gray-900">{feature.title}</p>
                  <p className="text-[9px] text-gray-400 mt-0.5 leading-relaxed">{feature.desc}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* ===== Bottom Info ===== */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-8 text-center"
          >
            <p className="text-[10px] text-gray-300 leading-relaxed">
              بتسجيلك في AppleNet أنت توافق على{" "}
              <a href="/terms" className="text-[#1B7A3D] hover:underline">شروط الاستخدام</a>
              {" "}و{" "}
              <a href="/privacy" className="text-[#1B7A3D] hover:underline">سياسة الخصوصية</a>
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
