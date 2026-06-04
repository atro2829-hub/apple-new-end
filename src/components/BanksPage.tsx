"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Building2, Copy, Check, Shield } from "lucide-react";
import { db } from "@/lib/firebase";
import { ref, onValue } from "firebase/database";
import { toast } from "sonner";
import type { BankDetail } from "@/lib/types";
import { useLanguage } from "@/context/LanguageContext";

export function BanksPage() {
  const { t, isRTL } = useLanguage();
  const [banks, setBanks] = useState<BankDetail[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onValue(ref(db, "bankDetails"), (snap) => {
      const data = snap.val();
      if (data) setBanks(Object.entries(data).map(([id, val]: [string, unknown]) => ({ id, ...(val as Record<string, unknown>) })).filter((b: Record<string, unknown>) => b.isActive) as BankDetail[]);
    });
    return () => unsub();
  }, []);

  const copyAccount = (id: string, number: string) => {
    navigator.clipboard.writeText(number);
    setCopiedId(id);
    toast.success(t("banks.copied"));
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ type: "spring", stiffness: 120, damping: 14 }} className="px-4 pt-4" dir={isRTL ? "rtl" : "ltr"}>
      <div className="bg-gradient-to-br from-[#E6F9EE] to-[#F0FFF4] rounded-2xl p-4 mb-4">
        <h2 className="text-xl font-black text-gray-900 flex items-center gap-2"><Building2 className="w-6 h-6 text-[#1B7A3D]" />{t("banks.title")}</h2>
        <p className="text-sm text-gray-500 mt-1">{t("banks.transferTo")}</p>
      </div>
      <div className="space-y-3 pb-4">
        {banks.length > 0 && banks.map((bank) => (
          <div key={bank.id} className="bg-white rounded-2xl card-shadow p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-[#E8F5E9] flex items-center justify-center"><Building2 className="w-5 h-5 text-[#1B7A3D]" /></div>
              <h3 className="text-base font-bold text-gray-900">{bank.bankName}</h3>
            </div>
            <div className="space-y-2 bg-gray-50 rounded-xl p-3">
              <div className="flex items-center justify-between"><span className="text-xs text-gray-500">{t("banks.accountName")}</span><span className="text-sm text-gray-900 font-bold">{bank.accountName}</span></div>
              <div className="flex items-center justify-between"><span className="text-xs text-gray-500">{t("banks.accountNumber")}</span>
                <div className="flex items-center gap-2"><span className="text-sm text-gray-900 font-mono font-bold" dir="ltr">{bank.accountNumber}</span><button onClick={() => copyAccount(bank.id, bank.accountNumber)} className="text-[#1B7A3D]">{copiedId === bank.id ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}</button></div>
              </div>
            </div>
          </div>
        ))}
        {banks.length === 0 && (<div className="bg-white rounded-2xl card-shadow p-6 text-center"><Building2 className="w-12 h-12 mx-auto text-gray-200 mb-3" /><p className="text-gray-400 text-sm">{t("banks.noAccounts")}</p></div>)}
        <div className="bg-white rounded-2xl card-shadow p-4">
          <h3 className="text-[#1B7A3D] font-bold mb-2 flex items-center gap-2"><Shield className="w-5 h-5" />{t("banks.instructions")}</h3>
          <ol className="text-sm text-gray-500 space-y-1.5 list-decimal list-inside"><li>{t("banks.step1")}</li><li>{t("banks.step2")}</li><li>{t("banks.step3")}</li><li>{t("banks.step4")}</li></ol>
        </div>
      </div>
    </motion.div>
  );
}
