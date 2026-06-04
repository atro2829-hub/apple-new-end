"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Wallet, Shield, Receipt, TrendingUp, CreditCard, LogIn, Ticket, X, Check,
  Sparkles, Star, Clock, Crown, MapPin, Filter, Phone, Wifi, PiggyBank,
  ShoppingBag, Gift, RotateCcw, DollarSign, ArrowLeft, Plus
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { db } from "@/lib/firebase";
import { ref, onValue, get, update, push, set, runTransaction, remove } from "firebase/database";
import { ADEN_DISTRICTS, formatDate } from "@/lib/constants";
import { normalizeCode } from "@/lib/utils";
import type { CreditHistory, SubscriptionPlan, UserSubscription, NetworkItem, CardItem } from "@/lib/types";
import type { User } from "firebase/auth";
import { toast } from "sonner";
import { useLanguage } from "@/context/LanguageContext";

interface CreditPageProps {
  user: User | null;
  onAuthClick: () => void;
  onNavigate?: (tab: string) => void;
}

// Icon + color mapping for each credit history type
// Using labelKey instead of label so translation is resolved inside the component
const HISTORY_TYPE_CONFIG: Record<string, { icon: React.ElementType; bg: string; iconColor: string; labelKey: string; sign: string }> = {
  deposit:   { icon: PiggyBank,  bg: "bg-[#E8F5E9]", iconColor: "text-[#1B7A3D]", labelKey: "credit.deposit",     sign: "+" },
  purchase:  { icon: ShoppingBag, bg: "bg-red-50",     iconColor: "text-red-500",   labelKey: "credit.purchase",    sign: "-" },
  gift:      { icon: Gift,        bg: "bg-purple-50",  iconColor: "text-purple-500", labelKey: "credit.gift",       sign: "+" },
  redeem:    { icon: Ticket,      bg: "bg-sky-50",     iconColor: "text-sky-500",    labelKey: "credit.redeem",     sign: "+" },
  commission:{ icon: DollarSign,  bg: "bg-amber-50",   iconColor: "text-amber-500",  labelKey: "credit.commission", sign: "+" },
  refund:    { icon: RotateCcw,   bg: "bg-teal-50",    iconColor: "text-teal-500",   labelKey: "credit.refund",     sign: "+" },
};

function getTypeConfig(type: string) {
  return HISTORY_TYPE_CONFIG[type] || HISTORY_TYPE_CONFIG.deposit;
}

export function CreditPage({ user, onAuthClick, onNavigate }: CreditPageProps) {
  const { t, isRTL } = useLanguage();

  const [balance, setBalance] = useState(0);
  const [history, setHistory] = useState<CreditHistory[]>([]);
  const [showRedeem, setShowRedeem] = useState(false);
  const [redeemCode, setRedeemCode] = useState("");
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [maxBalance, setMaxBalance] = useState(0);
  const [plans, setPlans] = useState<Record<string, SubscriptionPlan>>({});
  const [mySubscription, setMySubscription] = useState<UserSubscription | null>(null);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [showPlans, setShowPlans] = useState(false);
  const [districtFilter, setDistrictFilter] = useState<string>("all");
  const [fbNetworks, setFbNetworks] = useState<NetworkItem[]>([]);
  const [allCards, setAllCards] = useState<CardItem[]>([]);
  const [fbDistricts, setFbDistricts] = useState<string[]>(ADEN_DISTRICTS);
  const [showDistricts, setShowDistricts] = useState(false);
  const [showHistory, setShowHistory] = useState(true);
  const [redeemSuccess, setRedeemSuccess] = useState<{ amount: number; visible: boolean } | null>(null);
  const redeemSectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (showRedeem && redeemSectionRef.current) {
      setTimeout(() => {
        redeemSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }, 100);
    }
  }, [showRedeem]);

  useEffect(() => {
    const unsubs: (() => void)[] = [];
    // Load networks
    const netUnsub = onValue(ref(db, "networks"), (snap) => {
      const data = snap.val();
      if (data) {
        setFbNetworks(Object.entries(data).map(([id, val]: [string, unknown]) => ({ id, ...(val as Record<string, unknown>) })) as NetworkItem[]);
      }
    });
    unsubs.push(netUnsub);
    // Load cards
    const cardsUnsub = onValue(ref(db, "cards"), (snap) => {
      const data = snap.val();
      setAllCards(data ? Object.entries(data).map(([id, val]: [string, unknown]) => ({ id, ...(val as Record<string, unknown>) })) as CardItem[] : []);
    });
    unsubs.push(cardsUnsub);
    // Load districts from settings
    const distUnsub = onValue(ref(db, "settings/districts"), (snap) => {
      const data = snap.val();
      if (data && Array.isArray(data)) setFbDistricts(data);
    });
    unsubs.push(distUnsub);

    if (user) {
      const unsub1 = onValue(ref(db, `credit/${user.uid}/amount`), (snap) => setBalance(snap.val() || 0));
      const unsub2 = onValue(ref(db, `credit/${user.uid}/history`), (snap) => {
        const data = snap.val();
        if (data) {
          setHistory(Object.entries(data).map(([id, val]: [string, unknown]) => ({ id, ...(val as Record<string, unknown>) })).sort((a: CreditHistory, b: CreditHistory) => (b.date || 0) - (a.date || 0)) as CreditHistory[]);
        }
      });
      const unsub3 = onValue(ref(db, "settings/maxBalance"), (snap) => setMaxBalance(snap.val() || 0));
      const unsub4 = onValue(ref(db, "subscriptionPlans"), (snap) => setPlans(snap.val() || {}));
      const unsub5 = onValue(ref(db, `userSubscriptions/${user.uid}`), async (snap) => {
        const data = snap.val();
        if (data) {
          const sub = data as UserSubscription;
          // Check if subscription expired
          if (sub.expiresAt && sub.expiresAt < Date.now() && sub.isActive) {
            // Auto-renew check - read fresh data from Firebase
            if (sub.autoRenew) {
              try {
                const planSnap = await get(ref(db, `subscriptionPlans/${sub.planId}`));
                const plan = planSnap.val() as SubscriptionPlan | null;
                const creditSnap = await get(ref(db, `credit/${user!.uid}/amount`));
                const currentBal = creditSnap.val() || 0;
                if (plan && currentBal >= plan.price) {
                  // Use runTransaction on amount for atomic deduction
                  const amountRef = ref(db, `credit/${user!.uid}/amount`);
                  const renewResult = await runTransaction(amountRef, (cur) => {
                    const bal = (cur || 0) as number;
                    if (bal < plan.price) return; // abort
                    return bal - plan.price;
                  });
                  if (renewResult.committed) {
                    await update(ref(db, `credit/${user!.uid}`), { updatedAt: Date.now() });
                    const histRef = push(ref(db, `credit/${user!.uid}/history`));
                    await set(histRef, { type: "purchase", amount: plan.price, description: `${t("credit.renewSubscriptionDesc")} ${plan.name}`, date: Date.now() });
                    await update(ref(db, `userSubscriptions/${user!.uid}`), {
                      activatedAt: Date.now(),
                      expiresAt: Date.now() + plan.durationDays * 86400000,
                      isActive: true,
                    });
                    toast.success(`${t("credit.renewAutoSuccess")} ${plan.name} ${t("credit.automatically")}`);
                  } else {
                    await update(ref(db, `userSubscriptions/${user!.uid}`), { isActive: false });
                    toast.info(t("credit.subscriptionExpired"));
                  }
                } else {
                  await update(ref(db, `userSubscriptions/${user!.uid}`), { isActive: false });
                  toast.info(t("credit.subscriptionExpired"));
                }
              } catch {
                await update(ref(db, `userSubscriptions/${user!.uid}`), { isActive: false });
              }
            } else {
              await update(ref(db, `userSubscriptions/${user!.uid}`), { isActive: false });
            }
          }
          setMySubscription(sub.isActive && (!sub.expiresAt || sub.expiresAt > Date.now()) ? sub : null);
        } else {
          setMySubscription(null);
        }
      });
      unsubs.push(unsub1, unsub2, unsub3, unsub4, unsub5);
    } else {
      setBalance(0);
      setHistory([]);
      setMySubscription(null);
    }
    return () => unsubs.forEach(u => u());
  }, [user, t]);

  const activePlans = Object.entries(plans).filter(([, p]) => p.isActive).map(([id, p]) => ({ id, ...p }));

  // normalizeCode is imported from @/lib/utils

  const handleRedeemCode = async () => {
    if (!user || !redeemCode.trim()) {
      toast.error(t("credit.enterCodeFirst"));
      return;
    }
    setIsRedeeming(true);
    try {
      const enteredCode = normalizeCode(redeemCode);
      console.log("[Redeem] Normalized code:", enteredCode, "length:", enteredCode.length);

      if (enteredCode.length < 4) {
        toast.error(t("credit.codeTooShort"));
        setIsRedeeming(false);
        return;
      }

      // ─── Ensure credit record exists ──────────────────
      const creditSnap = await get(ref(db, `credit/${user.uid}`));
      if (!creditSnap.exists()) {
        await set(ref(db, `credit/${user.uid}`), { amount: 0, updatedAt: Date.now() });
        console.log("[Redeem] Created credit record for user");
      }

      // 1) Check shared redeem code lookup first (mass charge codes)
      const sharedLookupSnap = await get(ref(db, `sharedRedeemCodeLookup/${enteredCode}`));
      const sharedLookupData = sharedLookupSnap.val() as { pushId: string; amount: number; maxRedemptions: number; currentRedemptions: number; isActive: boolean } | null;

      if (sharedLookupData) {
        console.log("[Redeem] Found shared code:", sharedLookupData);

        if (sharedLookupData.isActive === false) {
          toast.error(t("credit.codeDisabled"));
          setIsRedeeming(false);
          return;
        }

        if (sharedLookupData.currentRedemptions >= sharedLookupData.maxRedemptions) {
          toast.error(t("credit.codeMaxReached"));
          setIsRedeeming(false);
          return;
        }

        const redeemedBySnap = await get(ref(db, `sharedRedeemCodes/${sharedLookupData.pushId}/redeemedBy/${user.uid}`));
        if (redeemedBySnap.exists()) {
          toast.error(t("credit.codeAlreadyUsed"));
          setIsRedeeming(false);
          return;
        }

        const codeAmount = sharedLookupData.amount;
        if (codeAmount <= 0) {
          toast.error(t("credit.codeInvalid"));
          setIsRedeeming(false);
          return;
        }

        // Add credit atomically
        const amountRef = ref(db, `credit/${user.uid}/amount`);
        let actualAmount = codeAmount;
        const creditResult = await runTransaction(amountRef, (currentAmount) => {
          const bal = (currentAmount || 0) as number;
          let newBal = bal + codeAmount;
          if (maxBalance > 0 && newBal > maxBalance) {
            actualAmount = Math.max(maxBalance - bal, 0);
            if (actualAmount <= 0) return bal;
            newBal = maxBalance;
          }
          return newBal;
        });

        if (!creditResult.committed || actualAmount <= 0) {
          toast.error(`${t("credit.balanceCeiling")} ${maxBalance.toLocaleString()} ${t("credit.riyalShort")}`);
          setIsRedeeming(false);
          return;
        }

        // Atomically increment currentRedemptions and add user to redeemedBy
        const sharedCodeRef = ref(db, `sharedRedeemCodes/${sharedLookupData.pushId}`);
        const transactionResult = await runTransaction(sharedCodeRef, (currentData) => {
          if (currentData === null) return null;
          const data = currentData as Record<string, unknown>;
          if (data.isActive === false) return;
          const currentRedemptions = (data.currentRedemptions as number) || 0;
          const maxRedemptions = (data.maxRedemptions as number) || 0;
          if (currentRedemptions >= maxRedemptions) return;
          const redeemedBy = (data.redeemedBy as Record<string, unknown>) || {};
          if (redeemedBy[user.uid]) return;
          return {
            ...data,
            currentRedemptions: currentRedemptions + 1,
            redeemedBy: {
              ...redeemedBy,
              [user.uid]: {
                uid: user.uid,
                name: user.displayName || user.email || t("credit.user"),
                redeemedAt: Date.now(),
              },
            },
          };
        });

        if (!transactionResult.committed) {
          await runTransaction(amountRef, (cur) => {
            const bal = (cur || 0) as number;
            return Math.max(bal - actualAmount, 0);
          });
          toast.error(t("credit.sharedCodeFailed"));
          setIsRedeeming(false);
          return;
        }

        // Update lookup currentRedemptions
        try {
          await update(ref(db, `sharedRedeemCodeLookup/${enteredCode}`), {
            currentRedemptions: (sharedLookupData.currentRedemptions || 0) + 1,
          });
        } catch { /* non-critical */ }

        await update(ref(db, `credit/${user.uid}`), { updatedAt: Date.now() });

        const histRef = push(ref(db, `credit/${user.uid}/history`));
        await set(histRef, {
          type: "redeem",
          amount: actualAmount,
          description: `${t("credit.sharedCodeCharge")} (${enteredCode})`,
          date: Date.now(),
        });

        const notifRef = push(ref(db, `notifications/${user.uid}`));
        await set(notifRef, {
          type: "deposit_approved",
          title: t("credit.sharedCodeCharge"),
          message: `${t("credit.sharedCodeChargeMsg")} ${actualAmount.toLocaleString()} ${t("credit.riyalShort")} ${t("credit.viaSharedCode")}`,
          isRead: false,
          createdAt: Date.now(),
        });

        toast.success(`${t("credit.chargedAmountSuccess")} ${actualAmount.toLocaleString()} ${t("credit.chargedSuccessFull")}`);
        setRedeemSuccess({ amount: actualAmount, visible: true });
        setRedeemCode("");
        setShowRedeem(false);
        setIsRedeeming(false);
        setTimeout(() => setRedeemSuccess(null), 3000);
        return;
      }

      // 2) Check regular redeem code lookup
      let foundCodeId: string | null = null;
      let codeAmount = 0;

      const lookupSnap = await get(ref(db, `redeemCodeLookup/${enteredCode}`));
      const lookupData = lookupSnap.val() as { pushId: string; amount: number; isUsed: boolean } | null;
      console.log("[Redeem] Lookup result:", lookupData);

      if (lookupData) {
        if (lookupData.isUsed === true) {
          toast.error(t("credit.codeUsedAlready"));
          setIsRedeeming(false);
          return;
        }
        foundCodeId = lookupData.pushId;
        codeAmount = lookupData.amount || 0;
      } else {
        // 3) Lookup not found - search directly in redeemCodes
        console.log("[Redeem] Lookup not found, searching redeemCodes directly...");
        const codesSnap = await get(ref(db, "redeemCodes"));
        if (codesSnap.exists()) {
          const allCodes = codesSnap.val() as Record<string, { code: string; amount: number; isUsed: boolean }>;
          for (const [id, val] of Object.entries(allCodes)) {
            const normalizedStoredCode = normalizeCode(val.code || "");
            if (normalizedStoredCode === enteredCode) {
              if (val.isUsed === true) {
                toast.error(t("credit.codeUsedAlready"));
                setIsRedeeming(false);
                return;
              }
              foundCodeId = id;
              codeAmount = val.amount || 0;
              break;
            }
          }
        }
        if (!foundCodeId) {
          toast.error(t("credit.codeNotFound"));
          setIsRedeeming(false);
          return;
        }
      }

      if (codeAmount <= 0) {
        toast.error(t("credit.codeInvalid"));
        setIsRedeeming(false);
        return;
      }

      // 4) Charge credit using runTransaction
      const amountRef = ref(db, `credit/${user.uid}/amount`);
      const chargeResult = await runTransaction(amountRef, (currentAmount) => {
        const bal = (currentAmount || 0) as number;
        if (maxBalance > 0 && bal + codeAmount > maxBalance) {
          return; // abort transaction
        }
        return bal + codeAmount;
      });

      if (!chargeResult.committed) {
        toast.error(`${t("credit.balanceCeiling")} ${maxBalance.toLocaleString()} ${t("credit.riyalShort")} ${t("credit.balanceCeilingPreventsAdd")}`);
        setIsRedeeming(false);
        return;
      }

      await update(ref(db, `credit/${user.uid}`), { updatedAt: Date.now() });
      const finalAmount = chargeResult.snapshot.val();
      console.log("[Redeem] Credit updated successfully, new amount:", finalAmount);

      // 5) Mark code as used in lookup (non-critical if fails)
      try {
        await update(ref(db, `redeemCodeLookup/${enteredCode}`), {
          isUsed: true,
          usedBy: user.uid,
          usedAt: Date.now(),
        });
      } catch { /* lookup may not exist for older codes */ }

      // 6) Mark code as used in codes table
      await update(ref(db, `redeemCodes/${foundCodeId}`), {
        isUsed: true,
        usedBy: user.uid,
        usedByName: user.displayName || user.email || t("credit.user"),
        usedAt: Date.now(),
      });

      // 6b) Delete the code from database after successful redemption
      try {
        await remove(ref(db, `redeemCodes/${foundCodeId}`));
        if (enteredCode) {
          await remove(ref(db, `redeemCodeLookup/${enteredCode}`));
        }
      } catch { /* non-critical - code already processed */ }

      // 7) Add to history
      const histRef = push(ref(db, `credit/${user.uid}/history`));
      await set(histRef, {
        type: "redeem",
        amount: codeAmount,
        description: `${t("credit.codeCharge")} (${enteredCode})`,
        date: Date.now(),
      });

      // 8) Send notification
      const notifRef = push(ref(db, `notifications/${user.uid}`));
      await set(notifRef, {
        type: "deposit_approved",
        title: t("credit.codeCharge"),
        message: `${t("credit.codeChargeMsg")} ${codeAmount.toLocaleString()} ${t("credit.riyalShort")} ${t("credit.viaChargeCode")}`,
        isRead: false,
        createdAt: Date.now(),
      });

      toast.success(`${t("credit.chargedAmountSuccess")} ${codeAmount.toLocaleString()} ${t("credit.chargedSuccessFull")}`);
      setRedeemSuccess({ amount: codeAmount, visible: true });
      setRedeemCode("");
      setShowRedeem(false);
      setTimeout(() => setRedeemSuccess(null), 3000);
    } catch (error: unknown) {
      console.error("[Redeem] Error:", error);
      const msg = error instanceof Error ? error.message : t("credit.redeemError");
      toast.error(msg.includes("permission") ? t("credit.noPermission") : t("credit.redeemErrorRetry"));
    }
    setIsRedeeming(false);
  };

  const handleSubscribe = async (plan: SubscriptionPlan & { id: string }) => {
    if (!user) return;
    setIsSubscribing(true);
    try {
      // Use runTransaction on amount field only to avoid race conditions
      const amountRef = ref(db, `credit/${user.uid}/amount`);
      const result = await runTransaction(amountRef, (currentAmount) => {
        const bal = (currentAmount || 0) as number;
        if (bal < plan.price) return; // abort - insufficient balance
        return bal - plan.price;
      });

      if (!result.committed) {
        toast.error(`${t("credit.insufficientBalanceNeed")} ${plan.price.toLocaleString()} ${t("credit.riyalShort")}`);
        setIsSubscribing(false);
        return;
      }

      // Update updatedAt separately
      await update(ref(db, `credit/${user.uid}`), { updatedAt: Date.now() });

      const histRef = push(ref(db, `credit/${user.uid}/history`));
      await set(histRef, { type: "purchase", amount: plan.price, description: `${t("credit.subscribePlanDesc")} ${plan.name}`, date: Date.now() });
      await set(ref(db, `userSubscriptions/${user.uid}`), {
        planId: plan.id,
        planName: plan.name,
        activatedAt: Date.now(),
        expiresAt: Date.now() + plan.durationDays * 86400000,
        isActive: true,
        autoRenew: true,
        uid: user.uid,
      });
      const notifRef = push(ref(db, `notifications/${user.uid}`));
      await set(notifRef, {
        type: "subscription",
        title: t("credit.newSubscription"),
        message: `${t("credit.planActivated")} ${plan.name} ${t("credit.forDuration")} ${plan.durationDays} ${t("credit.day")}`,
        isRead: false,
        createdAt: Date.now(),
      });
      toast.success(`${t("credit.subscribeSuccessMsg")} ${plan.name} ${t("credit.successEmoji")}`);
    } catch {
      toast.error(t("credit.subscriptionError"));
    }
    setIsSubscribing(false);
  };

  const toggleAutoRenew = async () => {
    if (!user || !mySubscription) return;
    try {
      await update(ref(db, `userSubscriptions/${user.uid}`), { autoRenew: !mySubscription.autoRenew });
      toast.success(mySubscription.autoRenew ? t("credit.autoRenewDisabled") : t("credit.autoRenewEnabled"));
    } catch {
      toast.error(t("credit.errorOccurred"));
    }
  };

  if (!user) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="px-4 pt-16 text-center">
        <div className="bg-[#E8F5E9] rounded-2xl p-8">
          <Wallet className="w-16 h-16 mx-auto text-[#1B7A3D]/30 mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">{t("credit.loginFirst")}</h2>
          <p className="text-gray-500 text-sm mb-4">{t("credit.mustLogin")}</p>
          <Button onClick={onAuthClick} className="bg-gradient-to-l from-[#1B7A3D] to-[#22A24D] text-white font-bold rounded-xl"><LogIn className="w-4 h-4 ml-2" />{t("auth.login")}</Button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ type: "spring", stiffness: 120, damping: 14 }} className="px-4 pt-4 pb-4">

      {/* ===== Large Balance Card ===== */}
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 18 }}
        className="relative overflow-hidden rounded-3xl mb-5"
      >
        {/* Main gradient card */}
        <div className="bg-gradient-to-bl from-[#1B7A3D] via-[#1f8e46] to-[#22A24D] rounded-3xl p-6 relative overflow-hidden backdrop-blur-xl" style={{ background: "linear-gradient(to bottom left, rgba(27,122,61,0.85), rgba(34,162,77,0.9)), rgba(255,255,255,0.08)", boxShadow: "0 8px 32px rgba(27,122,61,0.3), inset 0 1px 0 rgba(255,255,255,0.1)" }}>
          {/* Decorative elements */}
          <div className="absolute top-0 left-0 w-40 h-40 bg-white/10 rounded-full -translate-x-1/2 -translate-y-1/2 backdrop-blur-sm" />
          <div className="absolute bottom-0 right-0 w-32 h-32 bg-white/10 rounded-full translate-x-1/3 translate-y-1/3 backdrop-blur-sm" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-white/[0.05] rounded-full backdrop-blur-sm" />

          {/* Wallet icon */}
          <div className="flex items-center justify-center gap-2 mb-3 relative z-10">
            <Wallet className="w-5 h-5 text-white/70" />
            <p className="text-white/70 text-sm font-bold">{t("credit.currentBalance")}</p>
          </div>

          {/* Balance amount */}
          <motion.div
            key={balance}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="relative z-10 text-center mb-2"
          >
            <p className="text-5xl font-black text-white tracking-tight">{balance.toLocaleString()}</p>
          </motion.div>
          <p className="text-white/50 text-sm text-center relative z-10 mb-3">{t("credit.yemeniRial")}</p>

          {/* Max balance info */}
          {maxBalance > 0 && (
            <div className="relative z-10">
              <div className="bg-white/10 rounded-xl px-3 py-1.5">
                <div className="flex items-center justify-between text-white/40 text-[10px]">
                  <span>{t("credit.maxBalance")}</span>
                  <span>{maxBalance.toLocaleString()} {t("credit.riyalShort")}</span>
                </div>
                {/* Progress bar */}
                <div className="mt-1.5 h-1 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-white/40 rounded-full transition-all duration-700"
                    style={{ width: `${Math.min((balance / maxBalance) * 100, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* ===== Quick Actions ===== */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        {/* Deposit button */}
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => onNavigate?.("deposit")}
          className="bg-white rounded-2xl card-shadow p-4 flex flex-col items-center gap-2 border-2 border-[#1B7A3D]/10 hover:border-[#1B7A3D]/30 transition-all"
        >
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#1B7A3D] to-[#22A24D] flex items-center justify-center">
            <Plus className="w-6 h-6 text-white" />
          </div>
          <span className="text-xs font-black text-gray-900">{t("credit.deposit")}</span>
          <span className="text-[9px] text-gray-400">{t("credit.transferToAdmin")}</span>
        </motion.button>

        {/* Redeem code button */}
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => setShowRedeem(!showRedeem)}
          className={`bg-white rounded-2xl card-shadow p-4 flex flex-col items-center gap-2 border-2 transition-all ${showRedeem ? 'border-sky-300 ring-2 ring-sky-100' : 'border-sky-100 hover:border-sky-300'}`}
        >
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-sky-500 to-sky-600 flex items-center justify-center">
            <Ticket className="w-6 h-6 text-white" />
          </div>
          <span className="text-xs font-black text-gray-900">{t("credit.redeemCode")}</span>
          <span className="text-[9px] text-gray-400">{showRedeem ? t("credit.hideCodeField") : t("credit.enterChargeCode")}</span>
        </motion.button>
      </div>

      {/* Redeem Code Input */}
      <AnimatePresence>
        {showRedeem && (
          <motion.div
            ref={redeemSectionRef}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="overflow-hidden mb-4"
          >
            <div className="bg-white rounded-2xl card-shadow p-4 space-y-3 border-2 border-sky-200">
              <div className="flex items-center justify-between">
                <h3 className="text-sky-600 font-bold text-sm flex items-center gap-2"><Ticket className="w-4 h-4" />{t("credit.redeemCodeTitle")}</h3>
                <button onClick={() => setShowRedeem(false)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
              </div>
              <div className="relative">
                <Input
                  value={redeemCode}
                  onChange={(e) => setRedeemCode(normalizeCode(e.target.value))}
                  className="bg-gray-50 border-gray-200 text-gray-900 rounded-xl h-12 text-center text-lg font-black tracking-widest"
                  placeholder="APXXXXXXXX"
                  dir="ltr"
                  maxLength={10}
                />
              </div>
              <Button
                onClick={handleRedeemCode}
                disabled={!redeemCode.trim() || isRedeeming}
                className="w-full bg-gradient-to-l from-sky-500 to-sky-600 text-white font-bold rounded-xl h-12 text-base hover:from-sky-600 hover:to-sky-700"
              >
                {isRedeeming ? (
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full" />
                ) : (
                  <><Check className="w-5 h-5 ml-2" />{t("credit.redeemBtn")}</>
                )}
              </Button>
              <p className="text-[10px] text-gray-400 text-center">{t("credit.redeemDesc")}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* District Filter */}
      <div className="mb-4">
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => setShowDistricts(!showDistricts)}
          className="w-full bg-white rounded-2xl card-shadow p-3 flex items-center justify-between border-2 border-[#1B7A3D]/20 hover:border-[#1B7A3D]/50 transition-all"
        >
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-[#E8F5E9] flex items-center justify-center"><MapPin className="w-4 h-4 text-[#1B7A3D]" /></div>
            <div className="text-right">
              <p className="text-xs font-bold text-gray-900">{t("credit.districtFilter")}</p>
              <p className="text-[10px] text-gray-400">{districtFilter === "all" ? t("credit.allDistricts") : districtFilter}</p>
            </div>
          </div>
          <Filter className="w-4 h-4 text-[#1B7A3D]" />
        </motion.button>
        <AnimatePresence>
          {showDistricts && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="overflow-hidden"
            >
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  onClick={() => { setDistrictFilter("all"); setShowDistricts(false); }}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${districtFilter === "all" ? "bg-[#1B7A3D] text-white shadow-md" : "bg-white text-gray-600 card-shadow"}`}
                >
                  {t("credit.all")}
                </button>
                {fbDistricts.map(d => (
                  <button
                    key={d}
                    onClick={() => { setDistrictFilter(d); setShowDistricts(false); }}
                    className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${districtFilter === d ? "bg-[#1B7A3D] text-white shadow-md" : "bg-white text-gray-600 card-shadow"}`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Networks by District */}
      {fbNetworks.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-black text-gray-900 flex items-center gap-1.5"><Wifi className="w-4 h-4 text-[#1B7A3D]" />{t("credit.availableNetworks")}</h3>
            <Badge className="bg-[#E8F5E9] text-[#1B7A3D] text-[9px]">
              {districtFilter === "all" ? fbNetworks.length : fbNetworks.filter(n => n.location === districtFilter).length} {t("credit.networkCount")}
            </Badge>
          </div>
          <div className="space-y-2">
            {fbNetworks
              .filter(n => districtFilter === "all" || n.location === districtFilter)
              .map(net => {
                const availableCount = allCards.filter(c => c.network === net.id && !c.isUsed).length;
                return (
                  <div key={net.id} className="bg-white rounded-xl card-shadow p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center text-base overflow-hidden" style={{ backgroundColor: net.bgColor || (net.color + "1A") }}>
                          {(net as Record<string, unknown>).imageBase64 ? (
                            <img src={(net as Record<string, unknown>).imageBase64 as string} alt={net.name} className="w-8 h-8 rounded-lg object-cover" />
                          ) : (
                            <span>{net.emoji}</span>
                          )}
                        </div>
                        <div>
                          <p className="text-xs font-bold" style={{ color: net.color }}>{net.name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {net.location && (
                              <span className="text-[10px] text-gray-400 flex items-center gap-0.5"><MapPin className="w-2.5 h-2.5" />{net.location}</span>
                            )}
                            {net.ownerPhone && (
                              <a href={`https://wa.me/${net.ownerPhone}`} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-500 flex items-center gap-0.5 hover:underline">
                                <Phone className="w-2.5 h-2.5" />{t("credit.contact")}
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                      <Badge className="bg-[#E8F5E9] text-[#1B7A3D] text-[9px]">{availableCount} {t("credit.cardCount")}</Badge>
                    </div>
                  </div>
                );
              })}
            {fbNetworks.filter(n => districtFilter === "all" || n.location === districtFilter).length === 0 && (
              <div className="bg-white rounded-xl card-shadow p-4 text-center">
                <Wifi className="w-8 h-8 mx-auto text-gray-200 mb-1" />
                <p className="text-gray-400 text-xs">{t("credit.noNetworks")}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Active Subscription Card */}
      {mySubscription && (
        <div className="bg-gradient-to-bl from-amber-400 to-orange-500 rounded-2xl p-4 mb-4 card-shadow-lg text-white">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2"><Crown className="w-5 h-5" /><span className="font-bold text-sm">{mySubscription.planName}</span></div>
            <Badge className="bg-white/20 text-white border-0 text-[10px]">{t("credit.active")}</Badge>
          </div>
          <div className="flex items-center gap-2 text-white/80 text-xs mb-2">
            <Clock className="w-3 h-3" />
            <span>{t("credit.expires")}: {mySubscription.expiresAt ? formatDate(mySubscription.expiresAt) : ""}</span>
          </div>
          <div className="flex items-center justify-between">
            <button onClick={toggleAutoRenew} className="text-[10px] text-white/70 hover:text-white transition-colors">
              {mySubscription.autoRenew ? `🔄 ${t("credit.autoRenewOn")}` : `⏸ ${t("credit.autoRenewOff")}`}
            </button>
          </div>
        </div>
      )}

      {/* Subscription Plans */}
      {activePlans.length > 0 && (
        <div className="mb-4">
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => setShowPlans(!showPlans)}
            className="w-full bg-white rounded-2xl card-shadow p-4 flex items-center gap-3 border-2 border-amber-200 hover:border-amber-400 transition-all"
          >
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center flex-shrink-0">
              <Crown className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1 text-right">
              <p className="text-sm font-black text-gray-900">{t("credit.subscriptionPlans")}</p>
              <p className="text-[10px] text-gray-400">{activePlans.length} {t("credit.availablePlans")}</p>
            </div>
            <Star className="w-5 h-5 text-amber-500" />
          </motion.button>

          <AnimatePresence>
            {showPlans && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                className="overflow-hidden"
              >
                <div className="space-y-3 mt-3">
                  {activePlans.map(plan => (
                    <div key={plan.id} className="bg-white rounded-2xl card-shadow p-4 border border-amber-100">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="text-sm font-black text-gray-900 flex items-center gap-1"><Crown className="w-4 h-4 text-amber-500" />{plan.name}</p>
                          {plan.description && <p className="text-[10px] text-gray-400 mt-0.5">{plan.description}</p>}
                        </div>
                        <p className="text-lg font-black text-[#1B7A3D]">{plan.price.toLocaleString()} <span className="text-[10px] text-gray-400">{t("credit.riyalShort")}</span></p>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-gray-400">{t("credit.durationLabel")}: {plan.durationDays} {t("credit.day")}</span>
                        <Button
                          onClick={() => handleSubscribe(plan)}
                          disabled={balance < plan.price || isSubscribing || !!mySubscription}
                          className="bg-gradient-to-l from-amber-400 to-orange-500 text-white font-bold rounded-xl h-8 text-xs px-4"
                        >
                          {mySubscription ? t("credit.alreadySubscribed") : balance < plan.price ? t("credit.insufficientBalance") : t("credit.subscribe")}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Info card */}
      <div className="bg-white rounded-2xl card-shadow mb-5 p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#E8F5E9] flex items-center justify-center flex-shrink-0"><Shield className="w-5 h-5 text-[#1B7A3D]" /></div>
          <div>
            <h3 className="text-[#1B7A3D] font-bold mb-1">{t("credit.howToCharge")}</h3>
            <p className="text-sm text-gray-500 leading-relaxed">{t("credit.howToChargeDesc")}</p>
          </div>
        </div>
      </div>

      {/* ===== Transaction History Timeline ===== */}
      <div className="mb-2">
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="w-full flex items-center justify-between mb-3"
        >
          <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
            <Receipt className="w-5 h-5 text-[#1B7A3D]" />{t("credit.transactionHistory")}
          </h3>
          <div className="flex items-center gap-2">
            {history.length > 0 && (
              <Badge className="bg-[#E8F5E9] text-[#1B7A3D] text-[9px]">{history.length}</Badge>
            )}
            <motion.div animate={{ rotate: showHistory ? 180 : 0 }} transition={{ duration: 0.2 }}>
              <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </motion.div>
          </div>
        </button>

        <AnimatePresence>
          {showHistory && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="overflow-hidden"
            >
              {history.length === 0 ? (
                <div className="bg-white rounded-2xl card-shadow p-8 text-center">
                  <Receipt className="w-12 h-12 mx-auto text-gray-200 mb-2" />
                  <p className="text-gray-400 text-sm">{t("credit.noTransactions")}</p>
                </div>
              ) : (
                <div className="relative max-h-96 overflow-y-auto custom-scrollbar space-y-2">
                  {/* Timeline line */}
                  {history.map((item, i) => {
                    const config = getTypeConfig(item.type);
                    const IconComp = config.icon;
                    const isPositive = ["deposit", "gift", "redeem", "commission", "refund"].includes(item.type);

                    return (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.03 }}
                        className="bg-white rounded-xl card-shadow p-3 relative"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            {/* Type icon */}
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${config.bg}`}>
                              <IconComp className={`w-4 h-4 ${config.iconColor}`} />
                            </div>
                            <div>
                              <p className="text-xs font-bold text-gray-900">{item.description}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${config.bg} ${config.iconColor}`}>
                                  {t(config.labelKey)}
                                </span>
                                <span className="text-[10px] text-gray-400">{item.date ? formatDate(item.date) : ""}</span>
                              </div>
                            </div>
                          </div>
                          <span className={`font-black text-sm ${isPositive ? "text-[#1B7A3D]" : "text-red-500"}`}>
                            {config.sign}{item.amount.toLocaleString()} {t("credit.riyalShort")}
                          </span>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {/* ====== Redeem Success Animation ====== */}
      <AnimatePresence>
        {redeemSuccess && redeemSuccess.visible && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-[10000] flex items-center justify-center"
            onClick={() => setRedeemSuccess(null)}
          >
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className="bg-white rounded-3xl p-8 mx-6 text-center shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 400, damping: 12 }}
                className="w-20 h-20 rounded-full bg-[#E8F5E9] flex items-center justify-center mx-auto mb-4"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.4, type: "spring", stiffness: 500, damping: 15 }}
                >
                  <Check className="w-10 h-10 text-[#1B7A3D]" />
                </motion.div>
              </motion.div>
              <motion.h3
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-lg font-black text-gray-900 mb-2"
              >
                {t("credit.chargedSuccessTitle")}
              </motion.h3>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                <span className="text-4xl font-black text-[#1B7A3D]">
                  +{redeemSuccess.amount.toLocaleString()}
                </span>
                <p className="text-sm text-gray-400 mt-1">{t("credit.yemeniRial")}</p>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: [0, -10, 0] }}
                animate={{ opacity: 1, y: [0, -8, 0] }}
                transition={{ delay: 0.7, duration: 0.5 }}
                className="mt-4"
              >
                <Sparkles className="w-6 h-6 text-amber-400 mx-auto" />
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
