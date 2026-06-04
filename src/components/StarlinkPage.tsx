"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Satellite, DollarSign, ShoppingCart, Check, X, Phone, Mail,
  Zap, Upload, Clock, Globe, Info, ChevronDown, ChevronUp, Star,
  Package, ShieldCheck, LogIn, MessageCircle, FileText, Heart,
  Eye
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { db } from "@/lib/firebase";
import { ref, onValue, push, set } from "firebase/database";
import { formatDate, ADMIN_WHATSAPP, generateWhatsAppLink, iOSSpring } from "@/lib/constants";
import type { StarlinkProduct, StarlinkOrder, AppUser } from "@/lib/types";
import type { User } from "firebase/auth";
import { toast } from "sonner";
import { useLanguage } from "@/context/LanguageContext";

interface StarlinkPageProps {
  user: User | null;
  onAuthClick: () => void;
}

export function StarlinkPage({ user, onAuthClick }: StarlinkPageProps) {
  const { t, isRTL } = useLanguage();
  const [products, setProducts] = useState<StarlinkProduct[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<StarlinkProduct | null>(null);
  const [showDetailSheet, setShowDetailSheet] = useState(false);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [userInfo, setUserInfo] = useState<AppUser | null>(null);
  const [isOrdering, setIsOrdering] = useState(false);
  const [userOrders, setUserOrders] = useState<StarlinkOrder[]>([]);
  const [orderPhone, setOrderPhone] = useState("");
  const [orderNotes, setOrderNotes] = useState("");
  const [showOrders, setShowOrders] = useState(true);
  const [redeemSuccess, setRedeemSuccess] = useState<{ amount: number; visible: boolean } | null>(null);

  useEffect(() => {
    const unsub = onValue(ref(db, "starlinkProducts"), (snap) => {
      const data = snap.val();
      if (data) {
        const list = Object.entries(data)
          .map(([id, val]: [string, unknown]) => ({ id, ...(val as Record<string, unknown>) }))
          .filter((p: Record<string, unknown>) => p.isActive)
          .sort((a: StarlinkProduct, b: StarlinkProduct) => a.priceUSD - b.priceUSD) as StarlinkProduct[];
        setProducts(list);
      } else {
        setProducts([]);
      }
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
      const unsub = onValue(ref(db, "starlinkOrders"), (snap) => {
        const data = snap.val();
        if (data) {
          const list = Object.entries(data)
            .map(([id, val]: [string, unknown]) => ({ id, ...(val as Record<string, unknown>) }))
            .filter((o: Record<string, unknown>) => o.userId === user.uid)
            .sort((a: StarlinkOrder, b: StarlinkOrder) => (b.createdAt || 0) - (a.createdAt || 0)) as StarlinkOrder[];
          setUserOrders(list);
        } else {
          setUserOrders([]);
        }
      });
      return () => unsub();
    }
  }, [user]);

  const handleOrder = async () => {
    if (!user || !selectedProduct) return;
    if (!orderPhone.trim()) {
      toast.error(t("starlink.phoneNumber"));
      return;
    }
    setIsOrdering(true);
    try {
      const orderRef = push(ref(db, "starlinkOrders"));
      await set(orderRef, {
        userId: user.uid,
        userName: userInfo?.displayName || user.displayName || user.email || t("credit.user"),
        userEmail: user.email || "",
        userPhone: orderPhone.trim(),
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        priceUSD: selectedProduct.priceUSD,
        notes: orderNotes.trim() || "",
        status: "pending",
        createdAt: Date.now(),
      });

      // إشعار للأدمن
      const notifRef = push(ref(db, "notifications/admin"));
      await set(notifRef, {
        type: "general",
        title: `🛰️ ${t("starlink.orders")}`,
        message: `${userInfo?.displayName || user.email} - ${selectedProduct.name} $${selectedProduct.priceUSD}`,
        isRead: false,
        createdAt: Date.now(),
        relatedId: orderRef.key,
      });

      // إشعار للمستخدم
      const userNotifRef = push(ref(db, `notifications/${user.uid}`));
      await set(userNotifRef, {
        type: "general",
        title: `✅ ${t("starlink.orderSuccess")}`,
        message: t("starlink.orderSuccess"),
        isRead: false,
        createdAt: Date.now(),
      });

      toast.success(t("starlink.orderSuccess"));

      // فتح واتساب
      const msg = `🛰️ Starlink Order\n\n👤 Name: ${userInfo?.displayName || user.email}\n📱 Phone: ${orderPhone.trim()}\n📦 Product: ${selectedProduct.name}\n💰 Price: $${selectedProduct.priceUSD} USD${orderNotes.trim() ? `\n📝 Notes: ${orderNotes.trim()}` : ""}\n\n⏰ Date: ${new Date().toLocaleString()}\n\n✅ Pending confirmation & payment`;
      setTimeout(() => {
        window.open(generateWhatsAppLink(ADMIN_WHATSAPP, msg), "_blank");
      }, 500);

      setShowOrderModal(false);
      setSelectedProduct(null);
      setOrderPhone(userInfo?.phone || "");
      setOrderNotes("");
    } catch {
      toast.error(t("starlink.orderError"));
    }
    setIsOrdering(false);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending": return <Badge className="bg-yellow-50 text-yellow-600 border-yellow-200">⏳ {t("starlink.pendingReview")}</Badge>;
      case "confirmed": return <Badge className="bg-blue-50 text-blue-600 border-blue-200">✅ {t("starlink.confirm")}</Badge>;
      case "shipped": return <Badge className="bg-purple-50 text-purple-600 border-purple-200">🚚 {t("starlink.ship")}</Badge>;
      case "delivered": return <Badge className="bg-[#E8F5E9] text-[#1B7A3D] border-green-200">📦 {t("starlink.deliver")}</Badge>;
      case "cancelled": return <Badge className="bg-red-50 text-red-500 border-red-200">❌</Badge>;
      default: return null;
    }
  };

  const getStatusProgress = (status: string) => {
    const steps = ["pending", "confirmed", "shipped", "delivered"];
    const idx = steps.indexOf(status);
    if (status === "cancelled") return -1;
    return idx;
  };

  const openDetailSheet = (product: StarlinkProduct) => {
    setSelectedProduct(product);
    setShowDetailSheet(true);
  };

  const openOrderModal = (product: StarlinkProduct) => {
    if (!user) { onAuthClick(); return; }
    if (product.quantity <= 0) { toast.error(t("starlink.outOfStock")); return; }
    setSelectedProduct(product);
    setOrderPhone(userInfo?.phone || "");
    setOrderNotes("");
    setShowOrderModal(true);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ type: "spring", stiffness: 120, damping: 14 }}
      className="px-4 pt-4"
      dir={isRTL ? "rtl" : "ltr"}
    >
      {/* Header */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl p-5 mb-4 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 bottom-0 opacity-10">
          <div className="absolute top-2 left-4 w-2 h-2 bg-white rounded-full" />
          <div className="absolute top-8 right-12 w-1.5 h-1.5 bg-white rounded-full" />
          <div className="absolute bottom-6 left-20 w-1 h-1 bg-white rounded-full" />
          <div className="absolute top-4 left-1/2 w-1 h-1 bg-white rounded-full" />
          <div className="absolute bottom-3 right-8 w-2 h-2 bg-white rounded-full" />
        </div>
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center">
              <Satellite className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white">Starlink</h2>
              <p className="text-xs text-white/50">{t("starlink.title")}</p>
            </div>
          </div>
          <div className="flex items-center gap-4 mt-3">
            <div className="flex items-center gap-1.5 bg-white/10 rounded-lg px-2.5 py-1.5">
              <Zap className="w-3.5 h-3.5 text-yellow-400" />
              <span className="text-[10px] text-white/70 font-bold">{t("starlink.highSpeed")}</span>
            </div>
            <div className="flex items-center gap-1.5 bg-white/10 rounded-lg px-2.5 py-1.5">
              <Globe className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-[10px] text-white/70 font-bold">{t("starlink.globalCoverage")}</span>
            </div>
            <div className="flex items-center gap-1.5 bg-white/10 rounded-lg px-2.5 py-1.5">
              <DollarSign className="w-3.5 h-3.5 text-green-400" />
              <span className="text-[10px] text-white/70 font-bold">{t("starlink.pricesUSD")}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Products Grid */}
      {products.length === 0 ? (
        <div className="bg-white rounded-2xl card-shadow p-8 text-center mt-4">
          <Satellite className="w-14 h-14 mx-auto text-gray-200 mb-3" />
          <p className="text-gray-400 text-sm font-bold">{t("starlink.noProducts")}</p>
          <p className="text-gray-300 text-xs mt-1">{t("starlink.stayTuned")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          {products.map((product, i) => (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-white rounded-2xl card-shadow overflow-hidden"
            >
              {/* Product Image */}
              <div className="w-full h-40 bg-gray-50 relative overflow-hidden">
                {(product as Record<string, unknown>).imageBase64 ? (
                  <img
                    src={(product as Record<string, unknown>).imageBase64 as string}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                ) : product.imageUrl ? (
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-50">
                    <Satellite className="w-12 h-12 text-gray-200" />
                  </div>
                )}
                {/* Price Badge */}
                <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm rounded-xl px-2.5 py-1 shadow-sm">
                  <div className="flex items-center gap-1">
                    <DollarSign className="w-3.5 h-3.5 text-green-500" />
                    <span className="text-sm font-black text-gray-900">{product.priceUSD.toLocaleString()}</span>
                    <span className="text-[8px] text-gray-400 font-bold">USD</span>
                  </div>
                </div>
                {/* Stock Badge */}
                <div className="absolute top-2 left-2">
                  <Badge className={`${product.quantity > 0 ? "bg-[#E8F5E9] text-[#1B7A3D]" : "bg-red-50 text-red-500"} text-[9px] shadow-sm`}>
                    {product.quantity > 0 ? `${product.quantity} ${t("starlink.available")}` : t("starlink.outOfStock")}
                  </Badge>
                </div>
              </div>

              {/* Product Info */}
              <div className="p-3">
                <h3 className="text-sm font-black text-gray-900 mb-1 truncate">{product.name}</h3>
                <p className="text-[10px] text-gray-400 line-clamp-2 mb-3">{product.description}</p>

                {/* Quick Specs */}
                <div className="grid grid-cols-4 gap-1 mb-3">
                  {[
                    { icon: Upload, label: product.specs?.downloadSpeed || "-", color: "text-green-500 bg-green-50" },
                    { icon: Zap, label: product.specs?.uploadSpeed || "-", color: "text-blue-500 bg-blue-50" },
                    { icon: Clock, label: product.specs?.latency || "-", color: "text-purple-500 bg-purple-50" },
                    { icon: Globe, label: product.specs?.coverage || "-", color: "text-orange-500 bg-orange-50" },
                  ].map((spec, si) => (
                    <div key={si} className={`rounded-lg p-1.5 text-center ${spec.color.split(" ")[1]}`}>
                      <spec.icon className={`w-3 h-3 mx-auto ${spec.color.split(" ")[0]}`} />
                      <p className="text-[7px] font-bold mt-0.5 text-gray-600 truncate">{spec.label}</p>
                    </div>
                  ))}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={() => openDetailSheet(product)}
                    className="flex-1 py-2 rounded-xl bg-gray-50 text-gray-600 text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-gray-100 transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    {t("starlink.details")}
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={() => openOrderModal(product)}
                    disabled={product.quantity <= 0}
                    className="flex-1 py-2 rounded-xl bg-gradient-to-l from-[#1B7A3D] to-[#22A24D] text-white text-xs font-bold flex items-center justify-center gap-1.5 btn-green-shadow disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ShoppingCart className="w-3.5 h-3.5" />
                    {t("starlink.orderNow")}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* My Starlink Orders */}
      {user && userOrders.length > 0 && (
        <div className="mb-4">
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => setShowOrders(!showOrders)}
            className="w-full bg-white rounded-2xl card-shadow p-4 flex items-center gap-3 border-2 border-blue-100 hover:border-blue-300 transition-all mb-2"
          >
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center flex-shrink-0">
              <Package className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1 text-right">
              <p className="text-sm font-black text-gray-900">{t("starlink.orders")}</p>
              <p className="text-[10px] text-gray-400">{userOrders.length} {t("starlink.order")}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="bg-blue-50 text-blue-600 text-[9px]">
                {userOrders.filter(o => o.status === "pending").length} {t("starlink.pendingReview")}
              </Badge>
              {showOrders ? (
                <ChevronUp className="w-5 h-5 text-blue-500" />
              ) : (
                <ChevronDown className="w-5 h-5 text-blue-500" />
              )}
            </div>
          </motion.button>

          <AnimatePresence>
            {showOrders && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                className="overflow-hidden"
              >
                <div className="space-y-2">
                  {userOrders.map((order, i) => {
                    const progress = getStatusProgress(order.status);
                    return (
                      <motion.div
                        key={order.id}
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="bg-white rounded-xl card-shadow p-3"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Satellite className="w-4 h-4 text-blue-500" />
                            <span className="text-xs font-bold text-gray-900">{order.productName}</span>
                          </div>
                          {getStatusBadge(order.status)}
                        </div>

                        {/* Status Progress Bar */}
                        {order.status !== "cancelled" && (
                          <div className="mb-2">
                            <div className="flex items-center justify-between mb-1">
                              {[t("starlink.review"), t("starlink.confirm"), t("starlink.ship"), t("starlink.deliver")].map((step, idx) => (
                                <span key={idx} className={`text-[8px] font-bold ${idx <= progress ? "text-[#1B7A3D]" : "text-gray-300"}`}>
                                  {step}
                                </span>
                              ))}
                            </div>
                            <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${Math.max(((progress + 1) / 4) * 100, 0)}%` }}
                                transition={{ duration: 0.5 }}
                                className="h-full bg-gradient-to-l from-[#1B7A3D] to-[#22A24D] rounded-full"
                              />
                            </div>
                          </div>
                        )}

                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-400">
                            ${order.priceUSD} USD
                          </span>
                          <span className="text-[10px] text-gray-300">
                            {order.createdAt ? formatDate(order.createdAt) : ""}
                          </span>
                        </div>

                        {/* Notes */}
                        {(order as Record<string, unknown>).notes && (
                          <div className="mt-2 bg-gray-50 rounded-lg p-2 flex items-start gap-1.5">
                            <FileText className="w-3 h-3 text-gray-400 mt-0.5 flex-shrink-0" />
                            <p className="text-[10px] text-gray-500">{(order as Record<string, unknown>).notes as string}</p>
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Info Box */}
      <div className="bg-blue-50 rounded-2xl p-4 mb-4 border border-blue-100">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
            <MessageCircle className="w-5 h-5 text-blue-500" />
          </div>
          <div>
            <h4 className="text-xs font-black text-blue-800 mb-1">{t("starlink.howToOrder")}</h4>
            <p className="text-[10px] text-blue-600 leading-relaxed">
              {t("starlink.howToOrderDesc")} {t("starlink.paymentUSD")}
            </p>
          </div>
        </div>
      </div>

      {/* ====== Product Detail Bottom Sheet ====== */}
      <AnimatePresence>
        {showDetailSheet && selectedProduct && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-[9997]"
              onClick={() => setShowDetailSheet(false)}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={iOSSpring.gentle}
              className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl z-[9998] shadow-2xl"
              style={{ maxHeight: "85vh", display: "flex", flexDirection: "column" }}
            >
              {/* Handle */}
              <div className="flex justify-center pt-3 pb-2 flex-shrink-0">
                <div className="w-10 h-1 rounded-full bg-gray-300" />
              </div>

              {/* Header */}
              <div className="px-5 pb-3 flex items-center justify-between border-b border-gray-100 flex-shrink-0">
                <h3 className="text-lg font-black text-gray-900">{t("starlink.productDetails")}</h3>
                <button onClick={() => setShowDetailSheet(false)} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                  <X className="w-4 h-4 text-gray-500" />
                </button>
              </div>

              {/* Content */}
              <div className="overflow-y-auto flex-1 px-5 py-4">
                {/* Product Image */}
                <div className="w-full h-48 rounded-2xl overflow-hidden mb-4 bg-gray-50">
                  {(selectedProduct as Record<string, unknown>)?.imageBase64 ? (
                    <img src={(selectedProduct as Record<string, unknown>).imageBase64 as string} alt={selectedProduct.name} className="w-full h-full object-cover" />
                  ) : selectedProduct.imageUrl ? (
                    <img src={selectedProduct.imageUrl} alt={selectedProduct.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-50">
                      <Satellite className="w-12 h-12 text-gray-200" />
                    </div>
                  )}
                </div>

                {/* Product Name & Price */}
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xl font-black text-gray-900">{selectedProduct.name}</h4>
                  <div className="flex items-center gap-1 bg-[#E8F5E9] rounded-xl px-3 py-2">
                    <DollarSign className="w-4 h-4 text-[#1B7A3D]" />
                    <span className="text-xl font-black text-[#1B7A3D]">{selectedProduct.priceUSD.toLocaleString()}</span>
                    <span className="text-[10px] text-gray-400 font-bold">USD</span>
                  </div>
                </div>

                {/* Availability */}
                <div className="mb-3">
                  <Badge className={`${selectedProduct.quantity > 0 ? "bg-[#E8F5E9] text-[#1B7A3D]" : "bg-red-50 text-red-500"} text-xs`}>
                    {selectedProduct.quantity > 0 ? `✅ ${t("starlink.inStock")} (${selectedProduct.quantity})` : `❌ ${t("starlink.outOfStock")}`}
                  </Badge>
                </div>

                {/* Description */}
                {selectedProduct.description && (
                  <div className="bg-gray-50 rounded-xl p-3 mb-4">
                    <p className="text-sm text-gray-600 leading-relaxed">{selectedProduct.description}</p>
                  </div>
                )}

                {/* Specs */}
                <div className="mb-4">
                  <h4 className="text-sm font-black text-gray-900 mb-3 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-[#1B7A3D]" />
                    {t("starlink.detailedSpecs")}
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { icon: Upload, label: t("starlink.downloadSpeed"), value: selectedProduct.specs?.downloadSpeed || "-", color: "bg-green-50 text-green-600" },
                      { icon: Zap, label: t("starlink.uploadSpeed"), value: selectedProduct.specs?.uploadSpeed || "-", color: "bg-blue-50 text-blue-600" },
                      { icon: Clock, label: t("starlink.latency"), value: selectedProduct.specs?.latency || "-", color: "bg-purple-50 text-purple-600" },
                      { icon: Globe, label: t("starlink.coverage"), value: selectedProduct.specs?.coverage || "-", color: "bg-orange-50 text-orange-600" },
                    ].map((spec, si) => (
                      <div key={si} className={`${spec.color.split(" ")[0]} rounded-xl p-3 flex items-center gap-2.5`}>
                        <spec.icon className={`w-5 h-5 ${spec.color.split(" ")[1]}`} />
                        <div>
                          <p className="text-[10px] text-gray-400">{spec.label}</p>
                          <p className="text-xs font-bold text-gray-700">{spec.value}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Features */}
                <div className="space-y-2 mb-4">
                  {[
                    { icon: Globe, text: t("starlink.globalCoverageDesc") },
                    { icon: Zap, text: t("starlink.speedUpTo") },
                    { icon: ShieldCheck, text: t("starlink.warranty") },
                    { icon: Heart, text: t("starlink.support247") },
                  ].map((feat, fi) => (
                    <div key={fi} className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-[#E8F5E9] flex items-center justify-center flex-shrink-0">
                        <feat.icon className="w-4 h-4 text-[#1B7A3D]" />
                      </div>
                      <p className="text-xs text-gray-600">{feat.text}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Footer Actions */}
              <div className="px-5 pb-5 pt-2 flex-shrink-0 border-t border-gray-100">
                <Button
                  onClick={() => {
                    setShowDetailSheet(false);
                    setTimeout(() => openOrderModal(selectedProduct), 200);
                  }}
                  disabled={selectedProduct.quantity <= 0}
                  className="w-full bg-gradient-to-l from-[#1B7A3D] to-[#22A24D] text-white font-bold rounded-xl h-12 text-base btn-green-shadow disabled:opacity-50"
                >
                  <ShoppingCart className="w-5 h-5 ml-2" />
                  {t("starlink.orderNow")} — ${selectedProduct.priceUSD.toLocaleString()} USD
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ====== Order Modal ====== */}
      <AnimatePresence>
        {showOrderModal && selectedProduct && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-[9997]"
              onClick={() => setShowOrderModal(false)}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={iOSSpring.gentle}
              className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl z-[9998] shadow-2xl"
              style={{ maxHeight: "85vh", display: "flex", flexDirection: "column" }}
            >
              {/* Handle */}
              <div className="flex justify-center pt-3 pb-2 flex-shrink-0">
                <div className="w-10 h-1 rounded-full bg-gray-300" />
              </div>

              {/* Header */}
              <div className="px-5 pb-3 flex items-center justify-between border-b border-gray-100 flex-shrink-0">
                <h3 className="text-lg font-black text-gray-900">{t("starlink.confirmOrder")}</h3>
                <button onClick={() => setShowOrderModal(false)} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                  <X className="w-4 h-4 text-gray-500" />
                </button>
              </div>

              {/* Content */}
              <div className="overflow-y-auto flex-1 px-5 py-4">
                {/* Product Info */}
                <div className="flex gap-3 mb-4 bg-gray-50 rounded-2xl p-3">
                  <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-white">
                    {(selectedProduct as Record<string, unknown>)?.imageBase64 ? (
                      <img src={(selectedProduct as Record<string, unknown>).imageBase64 as string} alt={selectedProduct.name} className="w-full h-full object-cover" />
                    ) : selectedProduct.imageUrl ? (
                      <img src={selectedProduct.imageUrl} alt={selectedProduct.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Satellite className="w-6 h-6 text-gray-300" />
                      </div>
                    )}
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-gray-900">{selectedProduct.name}</h4>
                    <div className="flex items-center gap-1 mt-1">
                      <DollarSign className="w-4 h-4 text-green-500" />
                      <span className="text-lg font-black text-gray-900">{selectedProduct.priceUSD.toLocaleString()}</span>
                      <span className="text-[10px] text-gray-400 font-bold">USD</span>
                    </div>
                  </div>
                </div>

                {/* Phone Number */}
                <div className="mb-4">
                  <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5 mb-1.5">
                    <Phone className="w-3.5 h-3.5 text-[#1B7A3D]" />
                    {t("starlink.phoneNumber")} <span className="text-red-400">*</span>
                  </label>
                  <Input
                    value={orderPhone}
                    onChange={(e) => setOrderPhone(e.target.value)}
                    className="bg-gray-50 border-gray-200 text-gray-900 rounded-xl h-11"
                    placeholder="967XXXXXXXX"
                    dir="ltr"
                  />
                </div>

                {/* Notes */}
                <div className="mb-4">
                  <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5 mb-1.5">
                    <FileText className="w-3.5 h-3.5 text-[#1B7A3D]" />
                    {t("starlink.notes")}
                  </label>
                  <textarea
                    value={orderNotes}
                    onChange={(e) => setOrderNotes(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-xl px-3 py-2.5 text-sm min-h-[70px] resize-none focus:outline-none focus:ring-2 focus:ring-[#1B7A3D]/30 focus:border-[#1B7A3D] transition-all"
                    placeholder="..."
                  />
                </div>

                {/* User Info */}
                {user && userInfo && (
                  <div className="bg-white rounded-2xl card-shadow p-4 mb-4">
                    <h4 className="text-xs font-black text-gray-900 mb-3 flex items-center gap-1.5">
                      <Info className="w-3.5 h-3.5 text-[#1B7A3D]" />
                      {t("starlink.contactInfo")}
                    </h4>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Mail className="w-3.5 h-3.5 text-gray-400" />
                        <span className="text-xs text-gray-600" dir="ltr">{user.email}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-gray-400" />
                        <span className="text-xs text-gray-600" dir="ltr">{orderPhone || userInfo.phone || t("starlink.notSpecified")}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Payment Notice */}
                <div className="bg-amber-50 rounded-xl p-3 mb-4 border border-amber-100">
                  <p className="text-[10px] text-amber-700 leading-relaxed font-bold">
                    ⚠️ {t("starlink.paymentUSD")}
                  </p>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="px-5 pb-5 pt-2 flex-shrink-0 border-t border-gray-100">
                <div className="flex gap-2">
                  <Button
                    onClick={() => setShowOrderModal(false)}
                    className="flex-1 bg-gray-100 text-gray-600 font-bold rounded-xl h-12 hover:bg-gray-200"
                  >
                    {t("common.cancel")}
                  </Button>
                  <Button
                    onClick={handleOrder}
                    disabled={isOrdering || !orderPhone.trim()}
                    className="flex-1 bg-gradient-to-l from-[#1B7A3D] to-[#22A24D] text-white font-bold rounded-xl h-12"
                  >
                    {isOrdering ? (
                      <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full" />
                    ) : (
                      <>
                        <ShoppingCart className="w-4 h-4 ml-2" />
                        {t("starlink.confirmOrder")}
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
