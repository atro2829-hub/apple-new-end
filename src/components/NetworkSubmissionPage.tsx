"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Wifi, LogIn, Send, MapPin, Building2, FileText, Phone,
  Signal, Gauge, BookOpen, ChevronDown, ChevronUp, Check,
  X, Clock, CheckCircle2, XCircle, AlertCircle, Plus,
  Upload, Image as ImageIcon, Eye
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { db } from "@/lib/firebase";
import { ref, push, set, onValue } from "firebase/database";
import { PROVINCES, getDistricts, formatDate } from "@/lib/constants";
import { compressImageToBase64 } from "@/lib/utils";
import { useLanguage } from "@/context/LanguageContext";
import type { NetworkSubmission } from "@/lib/types";
import type { User } from "firebase/auth";
import { toast } from "sonner";

const NETWORK_TYPES = [
  { id: "wifi", label: "WiFi", icon: "📶" },
  { id: "fiber", label: "Fiber", icon: "🔌" },
  { id: "4g_lte", label: "4G/LTE", icon: "📡" },
  { id: "satellite", label: "Satellite", icon: "🛰️" },
];

interface FormState {
  networkName: string;
  provinceId: string;
  district: string;
  exactLocation: string;
  networkType: string;
  coverage: string;
  speed: string;
  description: string;
  phone: string;
}

const initialForm: FormState = {
  networkName: "",
  provinceId: "",
  district: "",
  exactLocation: "",
  networkType: "",
  coverage: "",
  speed: "",
  description: "",
  phone: "",
};

export function NetworkSubmissionPage({ user, onAuthClick }: { user: User | null; onAuthClick: () => void }) {
  const { t, isRTL } = useLanguage();
  const [form, setForm] = useState<FormState>(initialForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(true);
  const [mySubmissions, setMySubmissions] = useState<NetworkSubmission[]>([]);
  const [showSubmissions, setShowSubmissions] = useState(true);
  const [networkImage, setNetworkImage] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState<NetworkSubmission | null>(null);

  // Derive districts from selected province
  const districts = form.provinceId ? getDistricts(form.provinceId) : [];
  // Track previous provinceId to reset district when province changes
  const [prevProvinceId, setPrevProvinceId] = useState("");
  if (form.provinceId !== prevProvinceId) {
    setPrevProvinceId(form.provinceId);
    setForm(prev => ({ ...prev, district: "" }));
  }

  // Load user's previous submissions
  useEffect(() => {
    if (!user) return;
    const unsub = onValue(ref(db, "networkSubmissions"), (snap) => {
      const data = snap.val();
      if (data) {
        const list = Object.entries(data)
          .map(([id, val]: [string, unknown]) => ({ id, ...(val as Record<string, unknown>) }))
          .filter((s: Record<string, unknown>) => s.userId === user.uid)
          .sort((a: NetworkSubmission, b: NetworkSubmission) => (b.createdAt || 0) - (a.createdAt || 0)) as NetworkSubmission[];
        setMySubmissions(list);
      } else {
        setMySubmissions([]);
      }
    });
    return () => unsub();
  }, [user]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error(t("network.uploadImage"));
      return;
    }
    setIsUploading(true);
    try {
      const base64 = await compressImageToBase64(file, 128, 0.6);
      setNetworkImage(base64);
    } catch {
      toast.error(t("network.uploadImage"));
    }
    setIsUploading(false);
  };

  const handleSubmit = async () => {
    if (!user) return;

    // Validation
    if (!form.networkName.trim()) {
      toast.error(t("network.networkName"));
      return;
    }
    if (!/^[a-zA-Z0-9\s\-]+$/.test(form.networkName.trim())) {
      toast.error(t("network.networkName"));
      return;
    }
    if (!form.provinceId) {
      toast.error(t("network.selectProvince"));
      return;
    }
    if (!form.district) {
      toast.error(t("network.selectDistrict"));
      return;
    }
    if (!form.exactLocation.trim()) {
      toast.error(t("network.exactLocation"));
      return;
    }
    if (!form.networkType) {
      toast.error(t("network.networkType"));
      return;
    }
    if (!form.phone.trim()) {
      toast.error(t("network.phoneNumber"));
      return;
    }

    setIsSubmitting(true);
    try {
      const province = PROVINCES.find(p => p.id === form.provinceId);
      const submissionRef = push(ref(db, "networkSubmissions"));
      await set(submissionRef, {
        userId: user.uid,
        userName: user.displayName || user.email || "مستخدم",
        userEmail: user.email || "",
        userPhone: form.phone,
        networkName: form.networkName.trim(),
        provinceId: form.provinceId,
        provinceName: province?.name || "",
        district: form.district,
        exactLocation: form.exactLocation.trim(),
        networkType: form.networkType,
        coverage: form.coverage.trim(),
        speed: form.speed.trim(),
        description: form.description.trim(),
        imageBase64: networkImage || null,
        status: "pending",
        createdAt: Date.now(),
        reviewedAt: null,
        reviewedBy: null,
        rejectionReason: null,
        assignedNetworkId: null,
      });

      // Send notification to admin
      const notifRef = push(ref(db, "notifications/admin"));
      await set(notifRef, {
        type: "general",
        title: t("network.submitNew"),
        message: `${user.displayName || user.email} - ${form.networkName} - ${province?.name || ""} - ${form.district}`,
        isRead: false,
        createdAt: Date.now(),
        relatedId: submissionRef.key,
      });

      toast.success(t("network.submit"));
      setForm(initialForm);
      setNetworkImage("");
    } catch {
      toast.error(t("common.error"));
    }
    setIsSubmitting(false);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge className="bg-yellow-50 text-yellow-600 border-yellow-200 text-[10px]">
            <Clock className="w-3 h-3 ml-1" />
            {t("network.pending")}
          </Badge>
        );
      case "approved":
        return (
          <Badge className="bg-[#E8F5E9] text-[#1B7A3D] border-green-200 text-[10px]">
            <CheckCircle2 className="w-3 h-3 ml-1" />
            ✓
          </Badge>
        );
      case "rejected":
        return (
          <Badge className="bg-red-50 text-red-500 border-red-200 text-[10px]">
            <XCircle className="w-3 h-3 ml-1" />
            ✗
          </Badge>
        );
      default:
        return null;
    }
  };

  const getNetworkTypeLabel = (type: string) => {
    const typeKeyMap: Record<string, string> = {
      wifi: t("network.wifi"),
      fiber: t("network.fiber"),
      "4g_lte": t("network.lte"),
      satellite: t("network.satellite"),
    };
    return typeKeyMap[type] || type;
  };

  // Login prompt if no user
  if (!user) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="px-4 pt-16 text-center" dir={isRTL ? "rtl" : "ltr"}>
        <div className="bg-[#E8F5E9] rounded-2xl p-8">
          <Wifi className="w-16 h-16 mx-auto text-[#1B7A3D]/30 mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">{t("network.loginFirst")}</h2>
          <p className="text-gray-500 text-sm mb-4">{t("network.mustLogin")}</p>
          <Button
            onClick={onAuthClick}
            className="bg-gradient-to-l from-[#1B7A3D] to-[#22A24D] text-white font-bold rounded-xl"
          >
            <LogIn className="w-4 h-4 ml-2" />
            {t("auth.login")}
          </Button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ type: "spring", stiffness: 120, damping: 14 }}
      className="px-4 pt-4"
      dir={isRTL ? "rtl" : "ltr"}
    >
      {/* Header Card */}
      <div className="bg-gradient-to-bl from-[#1B7A3D] to-[#22A24D] rounded-2xl p-6 text-center mb-4 card-shadow-lg relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 bottom-0 opacity-10">
          <div className="absolute top-3 right-6 w-16 h-16 border-2 border-white rounded-full" />
          <div className="absolute bottom-2 left-8 w-10 h-10 border-2 border-white rounded-full" />
          <div className="absolute top-8 left-1/3 w-6 h-6 border border-white rounded-full" />
        </div>
        <div className="relative z-10">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Wifi className="w-6 h-6 text-white/80" />
            <p className="text-white/80 text-sm">{t("network.registerNetwork")}</p>
          </div>
          <h2 className="text-2xl font-black text-white mb-1">{t("network.submitNew")}</h2>
          <p className="text-white/60 text-xs">{t("network.submitDesc")}</p>
        </div>
      </div>

      {/* Toggle Form Button */}
      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={() => setShowForm(!showForm)}
        className="w-full bg-white rounded-2xl card-shadow p-4 mb-4 flex items-center gap-3 border-2 border-[#1B7A3D]/20 hover:border-[#1B7A3D]/50 transition-all"
      >
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#1B7A3D] to-[#22A24D] flex items-center justify-center flex-shrink-0">
          <Plus className="w-6 h-6 text-white" />
        </div>
        <div className="flex-1 text-right">
          <p className="text-sm font-black text-gray-900">{t("network.form")}</p>
          <p className="text-[10px] text-gray-400">
            {showForm ? t("network.hideForm") : t("network.fillData")}
          </p>
        </div>
        {showForm ? (
          <ChevronUp className="w-5 h-5 text-[#1B7A3D]" />
        ) : (
          <ChevronDown className="w-5 h-5 text-[#1B7A3D]" />
        )}
      </motion.button>

      {/* Submission Form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="overflow-hidden mb-4"
          >
            <div className="bg-white rounded-2xl card-shadow p-4 space-y-4 border-2 border-[#1B7A3D]/30">
              {/* Network Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                  <Wifi className="w-3.5 h-3.5 text-[#1B7A3D]" />
                  {t("network.networkName")} <span className="text-red-400">*</span>
                </label>
                <Input
                  value={form.networkName}
                  onChange={(e) => {
                    const val = e.target.value;
                    // Only allow English letters, numbers, spaces, hyphens
                    if (/^[a-zA-Z0-9\s-]*$/.test(val)) {
                      setForm(prev => ({ ...prev, networkName: val }));
                    }
                  }}
                  className="bg-gray-50 border-gray-200 text-gray-900 rounded-xl h-11"
                  placeholder="Apple Net"
                  dir="ltr"
                />
              </div>

              {/* Network Image Upload */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5 text-[#1B7A3D]" />
                  {t("network.networkIcon")}
                </label>
                <div className="flex items-center gap-3">
                  {networkImage ? (
                    <div className="relative w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 border-2 border-[#1B7A3D]/20">
                      <img src={networkImage} alt={t("network.networkIcon")} className="w-full h-full object-cover" />
                      <button
                        onClick={() => setNetworkImage("")}
                        className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center shadow-sm"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <label className="w-16 h-16 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center cursor-pointer hover:border-[#1B7A3D]/50 transition-colors flex-shrink-0 bg-gray-50">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                      />
                      {isUploading ? (
                        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="w-5 h-5 border-2 border-[#1B7A3D]/30 border-t-[#1B7A3D] rounded-full" />
                      ) : (
                        <Upload className="w-5 h-5 text-gray-400" />
                      )}
                    </label>
                  )}
                  <div className="flex-1">
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                      />
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#1B7A3D] hover:text-[#165E30] transition-colors">
                        <Upload className="w-3.5 h-3.5" />
                        {networkImage ? t("network.changeImage") : t("network.uploadImage")}
                      </span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Province */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-[#1B7A3D]" />
                  {t("network.province")} <span className="text-red-400">*</span>
                </label>
                <select
                  value={form.provinceId}
                  onChange={(e) => setForm(prev => ({ ...prev, provinceId: e.target.value }))}
                  className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-xl h-11 px-3 text-sm appearance-none cursor-pointer"
                >
                  <option value="">{t("network.selectProvince")}</option>
                  {PROVINCES.map(province => (
                    <option key={province.id} value={province.id}>
                      {province.isCapital ? "⭐ " : ""}{province.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* District */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-[#1B7A3D]" />
                  {t("network.district")} <span className="text-red-400">*</span>
                </label>
                <select
                  value={form.district}
                  onChange={(e) => setForm(prev => ({ ...prev, district: e.target.value }))}
                  disabled={!form.provinceId}
                  className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-xl h-11 px-3 text-sm appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="">
                    {form.provinceId ? t("network.selectDistrict") : t("network.selectProvinceFirst")}
                  </option>
                  {districts.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              {/* Exact Location */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-[#1B7A3D]" />
                  {t("network.exactLocation")} <span className="text-red-400">*</span>
                </label>
                <Input
                  value={form.exactLocation}
                  onChange={(e) => setForm(prev => ({ ...prev, exactLocation: e.target.value }))}
                  className="bg-gray-50 border-gray-200 text-gray-900 rounded-xl h-11"
                  placeholder={t("network.exactLocation")}
                />
              </div>

              {/* Network Type */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                  <Signal className="w-3.5 h-3.5 text-[#1B7A3D]" />
                  {t("network.networkType")} <span className="text-red-400">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {NETWORK_TYPES.map(type => {
                    const typeKeyMap: Record<string, string> = {
                      wifi: t("network.wifi"),
                      fiber: t("network.fiber"),
                      "4g_lte": t("network.lte"),
                      satellite: t("network.satellite"),
                    };
                    return (
                      <motion.button
                        key={type.id}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => setForm(prev => ({ ...prev, networkType: type.id }))}
                        className={`p-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all border-2 ${
                          form.networkType === type.id
                            ? "bg-[#E8F5E9] border-[#1B7A3D] text-[#1B7A3D]"
                            : "bg-gray-50 border-gray-200 text-gray-600 hover:border-gray-300"
                        }`}
                      >
                        <span className="text-base">{type.icon}</span>
                        {typeKeyMap[type.id] || type.label}
                        {form.networkType === type.id && <Check className="w-3.5 h-3.5 mr-1" />}
                      </motion.button>
                    );
                  })}
                </div>
              </div>

              {/* Coverage & Speed Row */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                    <Signal className="w-3 h-3 text-[#1B7A3D]" />
                    {t("network.coverage")}
                  </label>
                  <Input
                    value={form.coverage}
                    onChange={(e) => setForm(prev => ({ ...prev, coverage: e.target.value }))}
                    className="bg-gray-50 border-gray-200 text-gray-900 rounded-xl h-11"
                    placeholder="2 كم"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                    <Gauge className="w-3 h-3 text-[#1B7A3D]" />
                    {t("network.speed")}
                  </label>
                  <Input
                    value={form.speed}
                    onChange={(e) => setForm(prev => ({ ...prev, speed: e.target.value }))}
                    className="bg-gray-50 border-gray-200 text-gray-900 rounded-xl h-11"
                    placeholder="50 Mbps"
                  />
                </div>
              </div>

              {/* Additional Description */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-[#1B7A3D]" />
                  {t("network.additionalDesc")}
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-xl px-3 py-2.5 text-sm min-h-[80px] resize-none focus:outline-none focus:ring-2 focus:ring-[#1B7A3D]/30 focus:border-[#1B7A3D] transition-all"
                  placeholder={t("network.additionalDesc")}
                />
              </div>

              {/* Phone */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-[#1B7A3D]" />
                  {t("network.phoneNumber")} <span className="text-red-400">*</span>
                </label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm(prev => ({ ...prev, phone: e.target.value }))}
                  className="bg-gray-50 border-gray-200 text-gray-900 rounded-xl h-11"
                  placeholder="967XXXXXXXX"
                  dir="ltr"
                />
              </div>

              {/* Submit Button */}
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="w-full bg-gradient-to-l from-[#1B7A3D] to-[#22A24D] text-white font-bold rounded-xl h-12 text-base"
              >
                {isSubmitting ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                  />
                ) : (
                  <>
                    <Send className="w-5 h-5 ml-2" />
                    {t("network.submit")}
                  </>
                )}
              </Button>

              <p className="text-[10px] text-gray-400 text-center">
                {t("network.submitNote")}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Previous Submissions */}
      {mySubmissions.length > 0 && (
        <div className="mb-4">
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => setShowSubmissions(!showSubmissions)}
            className="w-full bg-white rounded-2xl card-shadow p-4 flex items-center gap-3 border-2 border-gray-100 hover:border-gray-200 transition-all"
          >
            <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
              <FileText className="w-6 h-6 text-gray-500" />
            </div>
            <div className="flex-1 text-right">
              <p className="text-sm font-black text-gray-900">{t("network.myRequests")}</p>
              <p className="text-[10px] text-gray-400">{mySubmissions.length}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="bg-[#E8F5E9] text-[#1B7A3D] text-[9px]">
                {mySubmissions.filter(s => s.status === "pending").length} {t("network.pending")}
              </Badge>
              {showSubmissions ? (
                <ChevronUp className="w-5 h-5 text-gray-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-400" />
              )}
            </div>
          </motion.button>

          <AnimatePresence>
            {showSubmissions && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                className="overflow-hidden"
              >
                <div className="space-y-2 mt-3 max-h-96 overflow-y-auto custom-scrollbar">
                  {mySubmissions.map((submission, i) => (
                    <motion.div
                      key={submission.id}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="bg-white rounded-xl card-shadow p-3 cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => setSelectedSubmission(submission)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {submission.imageBase64 ? (
                            <img
                              src={submission.imageBase64}
                              alt={submission.networkName}
                              className="w-8 h-8 rounded-lg object-cover"
                            />
                          ) : (
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                              submission.status === "pending"
                                ? "bg-yellow-50"
                                : submission.status === "approved"
                                ? "bg-[#E8F5E9]"
                                : "bg-red-50"
                            }`}>
                              {submission.status === "pending" ? (
                                <Clock className="w-4 h-4 text-yellow-500" />
                              ) : submission.status === "approved" ? (
                                <CheckCircle2 className="w-4 h-4 text-[#1B7A3D]" />
                              ) : (
                                <XCircle className="w-4 h-4 text-red-500" />
                              )}
                            </div>
                          )}
                          <div>
                            <p className="text-xs font-bold text-gray-900">{submission.networkName}</p>
                            <p className="text-[10px] text-gray-400">
                              {submission.provinceName} - {submission.district}
                            </p>
                          </div>
                        </div>
                        {getStatusBadge(submission.status)}
                      </div>

                      {/* Details row */}
                      <div className="flex items-center gap-3 text-[10px] text-gray-400">
                        <span className="flex items-center gap-0.5">
                          <Signal className="w-3 h-3" />
                          {getNetworkTypeLabel(submission.networkType)}
                        </span>
                        {submission.coverage && (
                          <span className="flex items-center gap-0.5">
                            <Wifi className="w-3 h-3" />
                            {submission.coverage}
                          </span>
                        )}
                        {submission.speed && (
                          <span className="flex items-center gap-0.5">
                            <Gauge className="w-3 h-3" />
                            {submission.speed}
                          </span>
                        )}
                        <span className="mr-auto flex items-center gap-0.5">
                          <Clock className="w-3 h-3" />
                          {submission.createdAt ? formatDate(submission.createdAt) : ""}
                        </span>
                      </div>

                      {/* Rejection reason */}
                      {submission.status === "rejected" && submission.rejectionReason && (
                        <div className="mt-2 bg-red-50 rounded-lg p-2 flex items-start gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5 text-red-400 mt-0.5 flex-shrink-0" />
                          <p className="text-[10px] text-red-600 leading-relaxed">
                            {submission.rejectionReason}
                          </p>
                        </div>
                      )}

                      {/* Approved - show assigned network */}
                      {submission.status === "approved" && submission.assignedNetworkId && (
                        <div className="mt-2 bg-[#E8F5E9] rounded-lg p-2 flex items-start gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#1B7A3D] mt-0.5 flex-shrink-0" />
                          <p className="text-[10px] text-[#1B7A3D] leading-relaxed">
                            ✓
                          </p>
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Info Box */}
      <div className="bg-white rounded-2xl card-shadow mb-6 p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#E8F5E9] flex items-center justify-center flex-shrink-0">
            <AlertCircle className="w-5 h-5 text-[#1B7A3D]" />
          </div>
          <div>
            <h3 className="text-[#1B7A3D] font-bold mb-1 text-sm">{t("network.howItWorks")}</h3>
            <p className="text-xs text-gray-500 leading-relaxed">
              {t("network.submitNote")}
            </p>
          </div>
        </div>
      </div>

      {/* Submission Detail Bottom Sheet */}
      <AnimatePresence>
        {selectedSubmission && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-[9997]"
              onClick={() => setSelectedSubmission(null)}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 120, damping: 14 }}
              className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl z-[9998] shadow-2xl"
              style={{ maxHeight: "80vh", display: "flex", flexDirection: "column" }}
              dir={isRTL ? "rtl" : "ltr"}
            >
              <div className="flex justify-center pt-3 pb-2 flex-shrink-0">
                <div className="w-10 h-1 rounded-full bg-gray-300" />
              </div>
              <div className="px-5 pb-3 flex items-center justify-between border-b border-gray-100 flex-shrink-0">
                <h3 className="text-lg font-black text-gray-900">{t("network.requestDetails")}</h3>
                <button onClick={() => setSelectedSubmission(null)} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                  <X className="w-4 h-4 text-gray-500" />
                </button>
              </div>
              <div className="overflow-y-auto flex-1 px-5 py-4 space-y-3">
                <div className="flex items-center gap-3">
                  {selectedSubmission.imageBase64 ? (
                    <img src={selectedSubmission.imageBase64} alt={selectedSubmission.networkName} className="w-14 h-14 rounded-xl object-cover" />
                  ) : (
                    <div className="w-14 h-14 rounded-xl bg-gray-100 flex items-center justify-center">
                      <Wifi className="w-7 h-7 text-gray-400" />
                    </div>
                  )}
                  <div>
                    <h4 className="text-base font-black text-gray-900">{selectedSubmission.networkName}</h4>
                    <div className="mt-1">{getStatusBadge(selectedSubmission.status)}</div>
                  </div>
                </div>
                <div className="space-y-2 bg-gray-50 rounded-xl p-3">
                  {[
                    { label: t("network.province"), value: selectedSubmission.provinceName || "-" },
                    { label: t("network.district"), value: selectedSubmission.district || "-" },
                    { label: t("network.exactLocation"), value: selectedSubmission.exactLocation || "-" },
                    { label: t("network.networkType"), value: getNetworkTypeLabel(selectedSubmission.networkType) },
                    { label: t("network.coverage"), value: selectedSubmission.coverage || "-" },
                    { label: t("network.speed"), value: selectedSubmission.speed || "-" },
                    { label: t("network.phoneNumber"), value: selectedSubmission.userPhone || "-" },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center justify-between py-1 border-b border-gray-100 last:border-0">
                      <span className="text-[10px] text-gray-400">{item.label}</span>
                      <span className="text-[10px] font-bold text-gray-700" dir={item.label === t("network.phoneNumber") ? "ltr" : undefined}>{item.value}</span>
                    </div>
                  ))}
                </div>
                {selectedSubmission.description && (
                  <div className="bg-white rounded-xl p-3 border border-gray-100">
                    <p className="text-xs text-gray-500">{selectedSubmission.description}</p>
                  </div>
                )}
                {selectedSubmission.status === "rejected" && selectedSubmission.rejectionReason && (
                  <div className="bg-red-50 rounded-xl p-3 border border-red-100">
                    <p className="text-xs text-red-600">{selectedSubmission.rejectionReason}</p>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
