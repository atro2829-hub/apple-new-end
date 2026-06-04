"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  User, Camera, Phone, Mail, Shield, Calendar, Pencil, Save,
  Trash2, KeyRound, Bell, BellOff, Globe, ToggleLeft, ToggleRight,
  ChevronLeft, AlertTriangle, Settings
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { db, auth } from "@/lib/firebase";
import { ref, onValue, update, set, push } from "firebase/database";
import { sendPasswordResetEmail } from "firebase/auth";
import { toast } from "sonner";
import { compressImageToBase64 } from "@/lib/utils";
import { iOSSpring, formatDate } from "@/lib/constants";
import { useLanguage } from "@/context/LanguageContext";
import type { AppUser } from "@/lib/types";
import type { User as FirebaseUser } from "firebase/auth";

interface ProfilePageProps {
  user: FirebaseUser | null;
  onBack: () => void;
}

interface UserSettings {
  notificationsEnabled: boolean;
  language: string;
  autoRenewSubscription: boolean;
}

export function ProfilePage({ user, onBack }: ProfilePageProps) {
  const { t, isRTL, lang, setLang } = useLanguage();
  const [userInfo, setUserInfo] = useState<AppUser | null>(null);
  const [userSettings, setUserSettings] = useState<UserSettings>({
    notificationsEnabled: true,
    language: "ar",
    autoRenewSubscription: false,
  });
  const [photoURL, setPhotoURL] = useState<string>("");
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load user data
  useEffect(() => {
    if (!user) return;
    const unsub = onValue(ref(db, `users/${user.uid}`), (snap) => {
      const data = snap.val();
      if (data) {
        const info = { uid: user.uid, ...data } as AppUser;
        setUserInfo(info);
        setEditName(info.displayName || "");
        setEditPhone(info.phone || "");
        if (data.photoURL) setPhotoURL(data.photoURL);
      }
    });
    return () => unsub();
  }, [user]);

  // Load user settings
  useEffect(() => {
    if (!user) return;
    const unsub = onValue(ref(db, `userSettings/${user.uid}`), (snap) => {
      const data = snap.val();
      if (data) {
        setUserSettings({
          notificationsEnabled: data.notificationsEnabled !== false,
          language: data.language || "ar",
          autoRenewSubscription: data.autoRenewSubscription || false,
        });
      }
    });
    return () => unsub();
  }, [user]);

  // Save profile changes
  const handleSaveProfile = async () => {
    if (!user) return;
    if (!editName.trim()) { toast.error(t("profile.nameRequired")); return; }
    setIsSaving(true);
    try {
      await update(ref(db, `users/${user.uid}`), {
        displayName: editName.trim(),
        phone: editPhone.trim(),
      });
      toast.success(t("profile.updated"));
      setIsEditing(false);
    } catch {
      toast.error(t("common.error"));
    }
    setIsSaving(false);
  };

  // Upload profile photo
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error(t("profile.photoTooLarge"));
      return;
    }
    setIsUploadingPhoto(true);
    try {
      // Delete old photo URL from database first (since we store base64 in RTDB)
      // The old photo data will be overwritten by the new update
      const base64 = await compressImageToBase64(file, 256, 0.7);
      const sizeInKB = Math.round((base64.length * 3) / 4 / 1024);
      let finalBase64 = base64;
      if (sizeInKB > 200) {
        finalBase64 = await compressImageToBase64(file, 128, 0.4);
      }
      // This overwrites the old photoURL in the database
      await update(ref(db, `users/${user.uid}`), { photoURL: finalBase64 });
      setPhotoURL(finalBase64);
      toast.success(t("profile.photoUpdated"));
    } catch {
      toast.error(t("profile.photoFailed"));
    }
    setIsUploadingPhoto(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Update setting
  const updateSetting = async (key: string, value: boolean | string) => {
    if (!user) return;
    try {
      await update(ref(db, `userSettings/${user.uid}`), { [key]: value });
      toast.success(t("profile.settingUpdated"));
    } catch {
      toast.error(t("common.error"));
    }
  };

  // Change password
  const handleChangePassword = async () => {
    if (!user?.email) return;
    try {
      await sendPasswordResetEmail(auth, user.email);
      toast.success(t("profile.resetSent"));
    } catch {
      toast.error(t("profile.resetError"));
    }
  };

  // Delete account request
  const handleDeleteAccount = async () => {
    if (!user) return;
    try {
      // Send notification to admin
      const adminNotifRef = push(ref(db, "notifications/admin"));
      await set(adminNotifRef, {
        type: "general",
        title: t("profile.deleteAccount"),
        message: `${t("profile.user")} ${userInfo?.displayName || user.email} ${isRTL ? "طلب حذف حسابه" : "requested account deletion"}`,
        isRead: false,
        createdAt: Date.now(),
        userId: user.uid,
      });
      toast.success(t("profile.deleteSent"));
      setShowDeleteConfirm(false);
    } catch {
      toast.error(t("common.error"));
    }
  };

  if (!user || !userInfo) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={iOSSpring.gentle}
        className="px-4 pt-4 text-center"
        dir={isRTL ? "rtl" : "ltr"}
      >
        <div className="bg-white rounded-2xl card-shadow p-8">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <User className="w-8 h-8 text-gray-300" />
          </div>
          <p className="text-gray-500 text-sm font-bold">{t("profile.loginToView")}</p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={iOSSpring.gentle}
      className="px-4 pt-4 pb-6"
      dir={isRTL ? "rtl" : "ltr"}
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <motion.button
          whileTap={{ scale: 0.85 }}
          onClick={onBack}
          className="w-10 h-10 rounded-2xl bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors haptic-press"
        >
          <ChevronLeft className={`w-5 h-5 text-gray-600 ${isRTL ? "rotate-180" : ""}`} />
        </motion.button>
        <h2 className="text-xl font-black text-gray-900">{t("profile.title")}</h2>
      </div>

      {/* ─── Profile Card ─── */}
      <div className="bg-white rounded-2xl card-shadow overflow-hidden mb-4">
        {/* Cover gradient */}
        <div className="h-24 bg-gradient-to-bl from-[#1B7A3D] to-[#22A24D] relative">
          {/* Decorative circles */}
          <div className="absolute top-2 right-8 w-16 h-16 rounded-full bg-white/10" />
          <div className="absolute bottom-0 left-12 w-10 h-10 rounded-full bg-white/5" />
        </div>

        {/* Avatar */}
        <div className="px-4 -mt-12 relative z-10">
          <div className="relative inline-block">
            {photoURL ? (
              <img
                src={photoURL}
                alt={userInfo.displayName || t("profile.user")}
                className="w-20 h-20 rounded-2xl border-4 border-white shadow-lg object-cover"
              />
            ) : (
              <div className="w-20 h-20 rounded-2xl border-4 border-white shadow-lg bg-gradient-to-br from-[#1B7A3D] to-[#22A24D] flex items-center justify-center">
                <span className="text-white font-black text-2xl">{(userInfo.displayName || t("profile.name"))[0].toUpperCase()}</span>
              </div>
            )}
            {/* Upload button */}
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploadingPhoto}
              className={`absolute -bottom-1 ${isRTL ? "-left-1" : "-right-1"} w-8 h-8 rounded-full bg-[#1B7A3D] flex items-center justify-center shadow-md hover:bg-[#165E30] transition-colors haptic-press`}
            >
              {isUploadingPhoto ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Camera className="w-4 h-4 text-white" />
              )}
            </motion.button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoUpload}
            />
          </div>
        </div>

        {/* User Info */}
        <div className="p-4 pt-3">
          {isEditing ? (
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-gray-400 mb-1 block">{t("profile.displayName")}</label>
                <Input
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  placeholder={t("profile.name")}
                  className="bg-gray-50 border-gray-200 rounded-xl text-sm"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-400 mb-1 block">{t("profile.phone")}</label>
                <Input
                  value={editPhone}
                  onChange={e => setEditPhone(e.target.value)}
                  placeholder={t("profile.phone")}
                  className="bg-gray-50 border-gray-200 rounded-xl text-sm"
                  dir="ltr"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleSaveProfile}
                  disabled={isSaving}
                  className="flex-1 bg-gradient-to-l from-[#1B7A3D] to-[#22A24D] text-white font-bold rounded-xl h-10 btn-green-shadow"
                >
                  {isSaving ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto" />
                  ) : (
                    <><Save className={`w-4 h-4 ${isRTL ? "ml-1.5" : "mr-1.5"}`} />{t("common.save")}</>
                  )}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setIsEditing(false);
                    setEditName(userInfo.displayName || "");
                    setEditPhone(userInfo.phone || "");
                  }}
                  className="rounded-xl"
                >
                  {t("common.cancel")}
                </Button>
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h3 className="text-lg font-black text-gray-900">{userInfo.displayName || t("profile.noName")}</h3>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Mail className="w-3 h-3 text-gray-400" />
                    <p className="text-xs text-gray-400" dir="ltr">{userInfo.email || user.email}</p>
                  </div>
                </div>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setIsEditing(true)}
                  className="w-9 h-9 rounded-xl bg-gray-50 flex items-center justify-center hover:bg-gray-100 transition-colors haptic-press"
                >
                  <Pencil className="w-4 h-4 text-gray-500" />
                </motion.button>
              </div>

              {/* Info badges */}
              <div className="flex flex-wrap gap-2 mt-3">
                {userInfo.phone && (
                  <div className="flex items-center gap-1.5 bg-gray-50 rounded-xl px-3 py-1.5">
                    <Phone className="w-3.5 h-3.5 text-gray-400" />
                    <span className="text-xs font-bold text-gray-600" dir="ltr">{userInfo.phone}</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5 bg-[#E8F5E9] rounded-xl px-3 py-1.5">
                  <Shield className="w-3.5 h-3.5 text-[#1B7A3D]" />
                  <span className="text-xs font-bold text-[#1B7A3D]">
                    {userInfo.role === "admin" ? t("common.admin") : userInfo.role === "network_manager" ? t("common.networkManager") : t("profile.user")}
                  </span>
                </div>
                {userInfo.createdAt && (
                  <div className="flex items-center gap-1.5 bg-gray-50 rounded-xl px-3 py-1.5">
                    <Calendar className="w-3.5 h-3.5 text-gray-400" />
                    <span className="text-[10px] font-bold text-gray-500">{formatDate(userInfo.createdAt)}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── Settings Section ─── */}
      <div className="bg-white rounded-2xl card-shadow p-4 mb-4">
        <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
          <Settings className="w-4 h-4 text-gray-400" />
          {t("profile.settings")}
        </h3>

        <div className="space-y-3">
          {/* Notifications */}
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => updateSetting("notificationsEnabled", !userSettings.notificationsEnabled)}
            className="w-full flex items-center justify-between p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors haptic-press"
          >
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${userSettings.notificationsEnabled ? "bg-[#E8F5E9]" : "bg-gray-100"}`}>
                {userSettings.notificationsEnabled ? (
                  <Bell className="w-4 h-4 text-[#1B7A3D]" />
                ) : (
                  <BellOff className="w-4 h-4 text-gray-400" />
                )}
              </div>
              <div>
                <p className="text-xs font-bold text-gray-900">{t("profile.notifications")}</p>
                <p className="text-[10px] text-gray-400">{t("profile.receiveNotifications")}</p>
              </div>
            </div>
            <div className={`w-11 h-6 rounded-full transition-colors ${userSettings.notificationsEnabled ? "bg-[#1B7A3D]" : "bg-gray-200"} relative`}>
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${userSettings.notificationsEnabled ? (isRTL ? "left-0.5" : "right-0.5") : (isRTL ? "left-[22px]" : "right-[22px]")}`} />
            </div>
          </motion.button>

          {/* Language */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
                <Globe className="w-4 h-4 text-blue-500" />
              </div>
              <div>
                <p className="text-xs font-bold text-gray-900">{t("profile.language")}</p>
                <p className="text-[10px] text-gray-400">{t("profile.appLanguage")}</p>
              </div>
            </div>
            <select
              value={lang}
              onChange={e => {
                const newLang = e.target.value as "ar" | "en";
                setLang(newLang);
                updateSetting("language", newLang);
              }}
              className="bg-white border border-gray-200 rounded-lg px-2 py-1 text-xs font-bold"
            >
              <option value="ar">العربية</option>
              <option value="en">English</option>
            </select>
          </div>

          {/* Auto-renew subscription */}
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => updateSetting("autoRenewSubscription", !userSettings.autoRenewSubscription)}
            className="w-full flex items-center justify-between p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors haptic-press"
          >
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${userSettings.autoRenewSubscription ? "bg-amber-50" : "bg-gray-100"}`}>
                {userSettings.autoRenewSubscription ? (
                  <ToggleRight className="w-4 h-4 text-amber-500" />
                ) : (
                  <ToggleLeft className="w-4 h-4 text-gray-400" />
                )}
              </div>
              <div>
                <p className="text-xs font-bold text-gray-900">{t("profile.autoRenew")}</p>
                <p className="text-[10px] text-gray-400">{t("profile.autoRenewDesc")}</p>
              </div>
            </div>
            <div className={`w-11 h-6 rounded-full transition-colors ${userSettings.autoRenewSubscription ? "bg-[#1B7A3D]" : "bg-gray-200"} relative`}>
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${userSettings.autoRenewSubscription ? (isRTL ? "left-0.5" : "right-0.5") : (isRTL ? "left-[22px]" : "right-[22px]")}`} />
            </div>
          </motion.button>
        </div>
      </div>

      {/* ─── Account Actions ─── */}
      <div className="bg-white rounded-2xl card-shadow p-4 mb-4">
        <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-gray-400" />
          {t("profile.myAccount")}
        </h3>

        <div className="space-y-2">
          {/* Change password */}
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={handleChangePassword}
            className="w-full flex items-center gap-3 p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors haptic-press"
          >
            <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
              <KeyRound className="w-4 h-4 text-blue-500" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-bold text-gray-900">{t("profile.changePassword")}</p>
              <p className="text-[10px] text-gray-400">{t("profile.resetLink")}</p>
            </div>
            <ChevronLeft className={`w-4 h-4 text-gray-300 ${isRTL ? "" : "-rotate-90"}`} />
          </motion.button>

          {/* Delete account */}
          <AnimatePresence>
            {!showDeleteConfirm ? (
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowDeleteConfirm(true)}
                className="w-full flex items-center gap-3 p-3 rounded-xl bg-red-50 hover:bg-red-100 transition-colors haptic-press"
              >
                <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center">
                  <Trash2 className="w-4 h-4 text-red-500" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-bold text-red-600">{t("profile.deleteAccount")}</p>
                  <p className="text-[10px] text-red-400">{t("profile.deleteDesc")}</p>
                </div>
                <ChevronLeft className={`w-4 h-4 text-red-300 ${isRTL ? "" : "-rotate-90"}`} />
              </motion.button>
            ) : (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-red-50 rounded-xl p-4 border border-red-200"
              >
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="w-5 h-5 text-red-500" />
                  <p className="text-sm font-bold text-red-700">{t("profile.confirmDelete")}</p>
                </div>
                <p className="text-xs text-red-600 mb-3">{t("profile.confirmDeleteMsg")}</p>
                <div className="flex gap-2">
                  <Button
                    onClick={handleDeleteAccount}
                    size="sm"
                    className="bg-red-500 text-white font-bold rounded-xl h-9"
                  >
                    <Trash2 className={`w-3.5 h-3.5 ${isRTL ? "ml-1" : "mr-1"}`} />{t("profile.confirmRequest")}
                  </Button>
                  <Button
                    onClick={() => setShowDeleteConfirm(false)}
                    variant="ghost"
                    size="sm"
                    className="rounded-xl text-xs"
                  >
                    {t("common.cancel")}
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ─── App Info ─── */}
      <div className="text-center pb-4">
        <p className="text-[10px] text-gray-300">Apple.NET v2.1.0</p>
      </div>
    </motion.div>
  );
}
