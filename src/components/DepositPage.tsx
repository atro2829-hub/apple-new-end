"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2, Copy, Check, Send, LogIn, Wallet, Phone, Upload, X, Image as ImageIcon,
  Receipt, Clock, AlertCircle, ChevronDown, Eye
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { db } from "@/lib/firebase";
import { ref, onValue, push, set, update, query, orderByChild, equalTo, get } from "firebase/database";
import { toast } from "sonner";
import { ADMIN_WHATSAPP, generateWhatsAppLink, formatDate } from "@/lib/constants";
import { compressImageToBase64, sanitizeInput, isValidAmount } from "@/lib/utils";
import type { BankDetail, DepositRequest, AppUser } from "@/lib/types";
import type { User } from "firebase/auth";
import { useLanguage } from "@/context/LanguageContext";

interface DepositPageProps {
  user: User | null;
  onAuthClick: () => void;
}

export function DepositPage({ user, onAuthClick }: DepositPageProps) {
  const { t, isRTL } = useLanguage();
  const [banks, setBanks] = useState<BankDetail[]>([]);
  const [selectedBankId, setSelectedBankId] = useState("");
  const [amount, setAmount] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [depositRequests, setDepositRequests] = useState<DepositRequest[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [userInfo, setUserInfo] = useState<AppUser | null>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [maxBalance, setMaxBalance] = useState(0);
  const [showRequests, setShowRequests] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const MIN_DEPOSIT = 500;

  useEffect(() => {
    const unsub = onValue(ref(db, "bankDetails"), (snap) => {
      const data = snap.val();
      if (data) {
        const list = Object.entries(data).map(([id, val]: [string, unknown]) => ({ id, ...(val as Record<string, unknown>) })).filter((b: Record<string, unknown>) => b.isActive) as BankDetail[];
        setBanks(list);
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onValue(ref(db, "settings/maxBalance"), (snap) => {
      setMaxBalance(snap.val() || 0);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (user) {
      const unsub = onValue(ref(db, `users/${user.uid}`), (snap) => {
        const data = snap.val();
        if (data) setUserInfo({ uid: user.uid, ...data } as AppUser);
      });
      return () => unsub();
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      const userDepositsRef = query(ref(db, "depositRequests"), orderByChild("userId"), equalTo(user.uid));
      const unsub = onValue(userDepositsRef, (snap) => {
        const data = snap.val();
        if (data) {
          const list = Object.entries(data).map(([id, val]: [string, unknown]) => ({ id, ...(val as Record<string, unknown>) }))
            .sort((a: DepositRequest, b: DepositRequest) => (b.createdAt || 0) - (a.createdAt || 0)) as DepositRequest[];
          setDepositRequests(list);
        } else {
          setDepositRequests([]);
        }
      });
      return () => unsub();
    }
  }, [user]);

  const selectedBank = banks.find(b => b.id === selectedBankId);

  // Handle receipt file selection
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error(t("deposit.imageOnly"));
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error(t("deposit.imageTooLarge"));
      return;
    }

    setReceiptFile(file);
    setIsCompressing(true);

    try {
      // Show a quick preview from the raw file
      const previewUrl = URL.createObjectURL(file);
      setReceiptPreview(previewUrl);
      setIsCompressing(false);
    } catch {
      toast.error(t("deposit.imageError"));
      setIsCompressing(false);
    }
  };

  const removeReceipt = () => {
    setReceiptFile(null);
    setReceiptPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedBankId || !amount || !referenceNumber) {
      toast.error(t("deposit.fillAllFields"));
      return;
    }
    const depositAmount = Number(amount);
    if (!isValidAmount(depositAmount, MIN_DEPOSIT, maxBalance > 0 ? maxBalance : undefined)) {
      if (depositAmount <= 0 || isNaN(depositAmount)) {
        toast.error(t("deposit.enterValidAmount"));
      } else if (depositAmount < MIN_DEPOSIT) {
        toast.error(`${t("deposit.minAmount")} ${MIN_DEPOSIT} ر.ي`);
      } else if (maxBalance > 0 && depositAmount > maxBalance) {
        toast.error(`${t("deposit.maxAmount")} ${maxBalance.toLocaleString()} ر.ي`);
      } else {
        toast.error(t("deposit.invalidAmount"));
      }
      return;
    }
    // Sanitize reference number
    const sanitizedRef = sanitizeInput(referenceNumber);
    if (!sanitizedRef) {
      toast.error(t("deposit.invalidRef"));
      return;
    }

    setSubmitting(true);
    try {
      // Compress receipt image if provided
      let receiptBase64: string | null = null;
      if (receiptFile) {
        try {
          receiptBase64 = await compressImageToBase64(receiptFile, 512, 0.6);
        } catch {
          toast.error(t("deposit.compressError"));
          setSubmitting(false);
          return;
        }
      }

      // Save deposit request
      const reqRef = push(ref(db, "depositRequests"));
      const requestData: Record<string, unknown> = {
        userId: user.uid,
        userName: userInfo?.displayName || user.email || "مستخدم",
        userEmail: user.email,
        bankId: selectedBankId,
        bankName: selectedBank?.bankName || "",
        amount: depositAmount,
        referenceNumber: sanitizedRef,
        status: "pending",
        createdAt: Date.now(),
      };

      // Only include receiptBase64 if we have one
      if (receiptBase64) {
        requestData.receiptImage = receiptBase64;
      }

      await set(reqRef, requestData);

      // Create notification for admin
      const notifRef = push(ref(db, "notifications/admin"));
      await set(notifRef, {
        type: "new_deposit_request",
        title: "طلب إيداع جديد",
        message: `${requestData.userName} يطلب إيداع ${depositAmount} ر.ي - رقم العملية: ${referenceNumber}`,
        isRead: false,
        createdAt: Date.now(),
        relatedId: reqRef.key,
      });

      toast.success(t("deposit.submitSuccess"));

      // Generate WhatsApp message — kept in Arabic for admin, bilingual approach
      const whatsappMessage = isRTL
        ? `🏦 طلب إيداع Apple.NET\n\n👤 الاسم: ${requestData.userName}\n📧 البريد: ${user.email}\n💰 المبلغ: ${depositAmount} ريال يمني\n🔢 رقم العملية المرجعي: ${referenceNumber}\n🏦 البنك: ${selectedBank?.bankName}${receiptBase64 ? "\n📸 تم إرفاق إيصال" : ""}\n\n⏰ التاريخ: ${new Date().toLocaleString("ar-YE")}\n\n✅ في انتظار تأكيد الأدمن`
        : `🏦 Deposit Request - Apple.NET\n\n👤 Name: ${requestData.userName}\n📧 Email: ${user.email}\n💰 Amount: ${depositAmount} YER\n🔢 Reference: ${referenceNumber}\n🏦 Bank: ${selectedBank?.bankName}${receiptBase64 ? "\n📸 Receipt attached" : ""}\n\n⏰ Date: ${new Date().toLocaleString("en-US")}\n\n✅ Awaiting admin confirmation`;

      setTimeout(() => {
        window.open(generateWhatsAppLink(ADMIN_WHATSAPP, whatsappMessage), "_blank");
      }, 500);

      setAmount("");
      setReferenceNumber("");
      setSelectedBankId("");
      removeReceipt();
    } catch {
      toast.error(t("deposit.submitError"));
    }
    setSubmitting(false);
  };

  const copyAccount = (id: string, number: string) => {
    navigator.clipboard.writeText(number);
    setCopiedId(id);
    toast.success(t("deposit.copied"));
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending": return <Badge className="bg-yellow-50 text-yellow-700 border-yellow-200 text-[10px] font-bold px-2 py-0.5">⏳ {t("deposit.pending")}</Badge>;
      case "approved": return <Badge className="bg-[#E8F5E9] text-[#1B7A3D] border-[#1B7A3D]/20 text-[10px] font-bold px-2 py-0.5">✅ {t("deposit.approved")}</Badge>;
      case "rejected": return <Badge className="bg-red-50 text-red-600 border-red-200 text-[10px] font-bold px-2 py-0.5">❌ {t("deposit.rejected")}</Badge>;
      default: return null;
    }
  };

  if (!user) {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="px-4 pt-6" dir={isRTL ? "rtl" : "ltr"}>
        <div className="bg-gradient-to-br from-[#E6F9EE] to-[#F0FFF4] rounded-2xl p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center mx-auto mb-4 card-shadow"><Wallet className="w-8 h-8 text-[#1B7A3D]" /></div>
          <h2 className="text-xl font-black text-gray-900 mb-2">{t("deposit.title")}</h2>
          <p className="text-gray-500 text-sm mb-4">{t("deposit.loginToDeposit")}</p>
          <Button onClick={onAuthClick} className="bg-gradient-to-l from-[#1B7A3D] to-[#22A24D] text-white font-bold rounded-xl h-11 px-8 btn-green-shadow"><LogIn className="w-4 h-4 ml-2" />{t("auth.login")}</Button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ type: "spring", stiffness: 120, damping: 14 }} className="px-4 pt-4 pb-4" dir={isRTL ? "rtl" : "ltr"}>

      {/* Header */}
      <div className="bg-gradient-to-br from-[#E6F9EE] to-[#F0FFF4] rounded-2xl p-4 mb-4 border border-[#1B7A3D]/10">
        <h2 className="text-xl font-black text-gray-900 flex items-center gap-2">
          <Wallet className="w-6 h-6 text-[#1B7A3D]" />{t("deposit.title")}
        </h2>
        <p className="text-sm text-gray-500 mt-1">{t("deposit.transferThenSubmit")}</p>
      </div>

      {/* Deposit Form */}
      <form onSubmit={handleSubmit} className="space-y-4 mb-6">

        {/* Bank Selection */}
        <div className="bg-white rounded-2xl card-shadow overflow-hidden">
          <div className="p-4 border-b border-gray-50">
            <h3 className="text-[#1B7A3D] font-bold text-sm flex items-center gap-2"><Building2 className="w-4 h-4" />{t("deposit.selectBank")}</h3>
          </div>
          <div className="p-4 space-y-3">
            {banks.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-4">{t("deposit.noBanks")}</p>
            ) : (
              <div className="space-y-2">
                {banks.map(bank => (
                  <motion.div key={bank.id} whileTap={{ scale: 0.98 }}
                    onClick={() => setSelectedBankId(bank.id)}
                    className={`p-3 rounded-xl border-2 cursor-pointer transition-all ${selectedBankId === bank.id ? "border-[#1B7A3D] bg-[#E8F5E9]" : "border-gray-100 bg-gray-50"}`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-bold text-gray-900">{bank.bankName}</p>
                        <p className="text-xs text-gray-500">{bank.accountName}</p>
                      </div>
                      {selectedBankId === bank.id && <Check className="w-5 h-5 text-[#1B7A3D]" />}
                    </div>
                    {selectedBankId === bank.id && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} className="mt-2 pt-2 border-t border-gray-200">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-500">{t("deposit.accountNumber")}:</span>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-mono font-bold text-gray-900" dir="ltr">{bank.accountNumber}</span>
                            <button type="button" onClick={() => copyAccount(bank.id, bank.accountNumber)} className="text-[#1B7A3D]">
                              {copiedId === bank.id ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Amount & Reference */}
        <div className="bg-white rounded-2xl card-shadow overflow-hidden">
          <div className="p-4 border-b border-gray-50">
            <h3 className="text-[#1B7A3D] font-bold text-sm flex items-center gap-2"><Send className="w-4 h-4" />{t("deposit.depositDetails")}</h3>
          </div>
          <div className="p-4 space-y-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1.5 font-bold">{t("deposit.amount")}</label>
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="bg-gray-50 border-gray-200 text-gray-900 rounded-xl h-11"
                placeholder={`${t("deposit.minAmount")} ${MIN_DEPOSIT} ر.ي`}
                min={MIN_DEPOSIT}
                required
              />
              {amount && Number(amount) < MIN_DEPOSIT && (
                <p className="text-[10px] text-red-500 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{t("deposit.minAmount")} {MIN_DEPOSIT} ر.ي</p>
              )}
              {maxBalance > 0 && amount && Number(amount) > maxBalance && (
                <p className="text-[10px] text-red-500 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{t("deposit.maxAmount")} {maxBalance.toLocaleString()} ر.ي</p>
              )}
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1.5 font-bold">{t("deposit.referenceNumber")}</label>
              <Input value={referenceNumber} onChange={(e) => setReferenceNumber(e.target.value)} className="bg-gray-50 border-gray-200 text-gray-900 rounded-xl h-11" placeholder={t("deposit.refPlaceholder")} dir="ltr" required />
            </div>
          </div>
        </div>

        {/* Receipt Upload */}
        <div className="bg-white rounded-2xl card-shadow overflow-hidden">
          <div className="p-4 border-b border-gray-50">
            <h3 className="text-[#1B7A3D] font-bold text-sm flex items-center gap-2"><ImageIcon className="w-4 h-4" />{t("deposit.transferReceipt")}</h3>
          </div>
          <div className="p-4">
            {!receiptPreview ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center cursor-pointer hover:border-[#1B7A3D]/50 hover:bg-[#E8F5E9]/30 transition-all"
              >
                <Upload className="w-8 h-8 mx-auto text-gray-300 mb-2" />
                <p className="text-sm font-bold text-gray-500">{t("deposit.clickToUpload")}</p>
                <p className="text-[10px] text-gray-400 mt-1">{t("deposit.autoCompress")}</p>
              </div>
            ) : (
              <div className="relative">
                <img
                  src={receiptPreview}
                  alt={t("deposit.transferReceipt")}
                  className="w-full max-h-48 object-contain rounded-xl bg-gray-50"
                />
                <button
                  type="button"
                  onClick={removeReceipt}
                  className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 flex items-center justify-center hover:bg-black/70 transition-colors"
                >
                  <X className="w-3.5 h-3.5 text-white" />
                </button>
                {isCompressing && (
                  <div className="absolute inset-0 bg-white/80 rounded-xl flex items-center justify-center">
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="w-6 h-6 border-2 border-[#1B7A3D]/30 border-t-[#1B7A3D] rounded-full" />
                    <span className="text-xs text-[#1B7A3D] font-bold mr-2">{t("deposit.compressing")}</span>
                  </div>
                )}
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
        </div>

        {/* Submit */}
        <motion.div whileTap={{ scale: 0.98 }}>
          <Button
            type="submit"
            disabled={submitting || isCompressing || !selectedBankId || !amount || !referenceNumber || (Number(amount) < MIN_DEPOSIT) || (maxBalance > 0 && Number(amount) > maxBalance)}
            className="w-full bg-gradient-to-l from-[#1B7A3D] to-[#22A24D] hover:from-[#165E30] hover:to-[#134D28] text-white font-bold rounded-xl h-12 btn-green-shadow disabled:opacity-50"
          >
            {submitting ? (
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full" />
            ) : (
              <><Send className="w-4 h-4 ml-2" />{t("deposit.submit")}</>
            )}
          </Button>
        </motion.div>

        {/* WhatsApp info */}
        <div className="bg-[#E8F5E9] rounded-xl p-3 flex items-center gap-3 border border-[#1B7A3D]/10">
          <Phone className="w-5 h-5 text-[#1B7A3D] flex-shrink-0" />
          <p className="text-xs text-gray-600 leading-relaxed">{t("deposit.whatsappInfo")}</p>
        </div>
      </form>

      {/* My Deposit Requests */}
      <div className="mb-4">
        <button
          onClick={() => setShowRequests(!showRequests)}
          className="w-full flex items-center justify-between mb-3"
        >
          <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
            <Receipt className="w-5 h-5 text-[#1B7A3D]" />{t("deposit.myRequests")}
          </h3>
          <div className="flex items-center gap-2">
            {depositRequests.length > 0 && (
              <Badge className="bg-[#E8F5E9] text-[#1B7A3D] text-[9px]">{depositRequests.length}</Badge>
            )}
            <motion.div animate={{ rotate: showRequests ? 180 : 0 }} transition={{ duration: 0.2 }}>
              <ChevronDown className="w-4 h-4 text-gray-400" />
            </motion.div>
          </div>
        </button>

        <AnimatePresence>
          {showRequests && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="overflow-hidden"
            >
              {depositRequests.length === 0 ? (
                <div className="bg-white rounded-2xl card-shadow p-6 text-center">
                  <Wallet className="w-10 h-10 mx-auto text-gray-200 mb-2" />
                  <p className="text-gray-400 text-sm">{t("deposit.noRequests")}</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar">
                  {depositRequests.map((req, i) => (
                    <motion.div key={req.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="bg-white rounded-xl card-shadow p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-[#E8F5E9] flex items-center justify-center">
                            <Wallet className="w-4 h-4 text-[#1B7A3D]" />
                          </div>
                          <div>
                            <span className="text-sm font-bold text-gray-900">{req.amount} ر.ي</span>
                            <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
                              <span>{req.bankName}</span>
                              <span>•</span>
                              <span>{req.createdAt ? formatDate(req.createdAt) : ""}</span>
                            </div>
                          </div>
                        </div>
                        {getStatusBadge(req.status)}
                      </div>
                      <div className="flex items-center justify-between text-xs text-gray-400 pt-1 border-t border-gray-50">
                        <span className="flex items-center gap-1"><Receipt className="w-3 h-3" />{t("deposit.refNum")}: {req.referenceNumber}</span>
                        {(req as Record<string, unknown>).receiptImage && (
                          <span className="flex items-center gap-0.5 text-[#1B7A3D]"><ImageIcon className="w-3 h-3" />{t("deposit.receiptAttached")}</span>
                        )}
                      </div>
                      {req.rejectionReason && (
                        <div className="mt-2 bg-red-50 rounded-lg p-2 flex items-start gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5" />
                          <p className="text-[10px] text-red-600">{req.rejectionReason}</p>
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
