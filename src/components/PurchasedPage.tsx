"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ShoppingBag, Check, Copy, HardDrive, Clock, Wallet, Receipt, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { db } from "@/lib/firebase";
import { ref, onValue } from "firebase/database";
import { toast } from "sonner";
import { formatDate, NETWORKS as DEFAULT_NETWORKS } from "@/lib/constants";
import type { NetworkItem } from "@/lib/types";
import type { User } from "firebase/auth";
import { useLanguage } from "@/context/LanguageContext";

interface PurchasedCard {
  id: string;
  cardCode: string;
  cardData: string;
  cardDuration: number;
  price: number;
  tier: string;
  network: string;
  purchasedAt: number;
}

interface PurchasedPageProps {
  user: User | null;
  onAuthClick: () => void;
}

export function PurchasedPage({ user, onAuthClick }: PurchasedPageProps) {
  const { t, isRTL } = useLanguage();
  const [purchasedCards, setPurchasedCards] = useState<PurchasedCard[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [fbNetworks, setFbNetworks] = useState<NetworkItem[]>(DEFAULT_NETWORKS.map(n => ({ ...n, ownerId: null, ownerName: null, createdAt: 0 })));

  // Load networks from Firebase
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
    if (user) {
      const unsub = onValue(ref(db, "cards"), (snap) => {
        const data = snap.val();
        if (data) {
          const cardsWithDetails: PurchasedCard[] = [];
          Object.entries(data).forEach(([id, val]: [string, unknown]) => {
            const card = val as Record<string, unknown>;
            if (card.usedBy === user.uid) {
              cardsWithDetails.push({
                id, cardCode: card.code as string, cardData: card.data as string,
                cardDuration: card.duration as number, price: card.price as number,
                tier: card.tier as string, network: (card.network as string) || "",
                purchasedAt: (card.usedAt as number) || 0,
              });
            }
          });
          cardsWithDetails.sort((a, b) => b.purchasedAt - a.purchasedAt);
          setPurchasedCards(cardsWithDetails);
        }
      });
      return () => unsub();
    }
  }, [user]);

  const handleCopy = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    toast.success(t("purchased.codeCopied"));
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (!user) {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="px-4 pt-6" dir={isRTL ? "rtl" : "ltr"}>
        <div className="bg-gradient-to-br from-[#E6F9EE] to-[#F0FFF4] rounded-2xl p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center mx-auto mb-4 card-shadow"><ShoppingBag className="w-8 h-8 text-[#1B7A3D]" /></div>
          <h2 className="text-xl font-black text-gray-900 mb-2">{t("purchased.title")}</h2>
          <p className="text-gray-500 text-sm mb-4">{t("purchased.loginFirst")}</p>
          <Button onClick={onAuthClick} className="bg-gradient-to-l from-[#1B7A3D] to-[#22A24D] text-white font-bold rounded-xl h-11 px-8 btn-green-shadow"><LogIn className="w-4 h-4 ml-2" />{t("auth.login")}</Button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ type: "spring", stiffness: 120, damping: 14 }} className="px-4 pt-4" dir={isRTL ? "rtl" : "ltr"}>
      <div className="bg-gradient-to-br from-[#E6F9EE] to-[#F0FFF4] rounded-2xl p-4 mb-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xl font-black text-gray-900 flex items-center gap-2"><ShoppingBag className="w-6 h-6 text-[#1B7A3D]" />{t("purchased.title")}</h2>
          <Badge className="bg-[#E8F5E9] text-[#1B7A3D]">{purchasedCards.length} كرت</Badge>
        </div>
        <p className="text-sm text-gray-500">{t("purchased.subtitle")}</p>
      </div>

      {purchasedCards.length === 0 ? (
        <div className="bg-white rounded-2xl card-shadow p-8 text-center mt-4">
          <div className="w-20 h-20 rounded-full bg-[#E8F5E9] flex items-center justify-center mx-auto mb-4"><Receipt className="w-10 h-10 text-[#1B7A3D]" /></div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">{t("purchased.noCards")}</h3>
          <p className="text-gray-500 text-sm">{t("purchased.noCardsDesc")}</p>
        </div>
      ) : (
        <div className="space-y-3 pb-4">
          {purchasedCards.map((card, i) => (
            <motion.div key={card.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05, type: "spring", stiffness: 200, damping: 20 }} className="bg-white rounded-2xl card-shadow overflow-hidden">
              <div className="bg-gradient-to-l from-[#1B7A3D] to-[#22A24D] px-4 py-2.5 flex items-center justify-between">
                <div className="flex items-center gap-2"><Check className="w-4 h-4 text-white" /><span className="text-white font-bold text-sm">{t("purchased.purchasedSuccess")}</span></div>
                <Badge className="bg-white/20 text-white text-[10px]">{card.tier ? `فئة ${card.tier} ر.ي` : `${card.price} ر.ي`}</Badge>
                {card.network && (() => { const netInfo = fbNetworks.find(n => n.id === card.network); return netInfo ? <Badge className="bg-white/20 text-white text-[10px]">{netInfo.emoji} {netInfo.name}</Badge> : null; })()}
              </div>
              <div className="p-4">
                <div className="bg-[#E8F5E9] rounded-xl p-3 mb-3">
                  <p className="text-[10px] text-gray-500 font-bold mb-1">{t("purchased.cardCode")}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-mono font-black text-[#1B7A3D] tracking-wider" dir="ltr">{card.cardCode}</span>
                    <button onClick={() => handleCopy(card.cardCode, card.id)} className="w-9 h-9 rounded-xl bg-white flex items-center justify-center hover:bg-green-50 transition-colors card-shadow">
                      {copiedId === card.id ? <Check className="w-4 h-4 text-[#1B7A3D]" /> : <Copy className="w-4 h-4 text-[#1B7A3D]" />}
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-gray-50 rounded-xl p-2 text-center"><HardDrive className="w-4 h-4 text-[#1B7A3D] mx-auto mb-1" /><p className="text-[10px] text-gray-400">{t("purchased.data")}</p><p className="text-xs font-bold text-gray-900">{card.cardData || "-"}</p></div>
                  <div className="bg-gray-50 rounded-xl p-2 text-center"><Clock className="w-4 h-4 text-[#1B7A3D] mx-auto mb-1" /><p className="text-[10px] text-gray-400">{t("purchased.days")}</p><p className="text-xs font-bold text-gray-900">{card.cardDuration ? (card.cardDuration === 2 ? t("purchased.twoDays") : `${card.cardDuration} ${t("purchased.days")}`) : "-"}</p></div>
                  <div className="bg-gray-50 rounded-xl p-2 text-center"><Wallet className="w-4 h-4 text-[#1B7A3D] mx-auto mb-1" /><p className="text-[10px] text-gray-400">{t("purchased.price")}</p><p className="text-xs font-bold text-gray-900">{card.price} ر.ي</p></div>
                </div>
                <div className="mt-3 flex items-center gap-1.5 text-gray-400"><Clock className="w-3 h-3" /><span className="text-[10px]">{formatDate(card.purchasedAt)}</span></div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
