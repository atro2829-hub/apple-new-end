"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, MapPin, Phone, Globe, Wifi, Zap, Clock, Store,
  ChevronLeft, Navigation, MessageCircle, Info, Map
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { db } from "@/lib/firebase";
import { ref, onValue } from "firebase/database";
import { generateWhatsAppLink } from "@/lib/constants";
import { useLanguage } from "@/context/LanguageContext";
import type { NetworkItem, CardSaleLocation, CardItem, TierItem, NetworkTier } from "@/lib/types";

interface NetworkDetailModalProps {
  network: NetworkItem | null;
  onClose: () => void;
  allCards?: CardItem[];
  allTiers?: TierItem[];
}

export function NetworkDetailModal({ network, onClose, allCards = [], allTiers = [] }: NetworkDetailModalProps) {
  const { t, isRTL } = useLanguage();
  const [saleLocations, setSaleLocations] = useState<CardSaleLocation[]>([]);
  const [networkTiers, setNetworkTiers] = useState<NetworkTier[]>([]);

  useEffect(() => {
    if (!network) return;

    const unsub = onValue(ref(db, "cardSaleLocations"), (snap) => {
      const data = snap.val();
      if (data) {
        const locations = Object.entries(data)
          .map(([id, val]: [string, unknown]) => ({ id, ...(val as Record<string, unknown>) }))
          .filter((loc: Record<string, unknown>) => loc.networkId === network.id && loc.isActive !== false)
          .sort((a: Record<string, unknown>, b: Record<string, unknown>) => ((b.createdAt as number) || 0) - ((a.createdAt as number) || 0)) as CardSaleLocation[];
        setSaleLocations(locations);
      } else {
        setSaleLocations([]);
      }
    });
    return () => unsub();
  }, [network]);

  useEffect(() => {
    if (!network) return;
    const unsub = onValue(ref(db, `networkTiers/${network.id}`), (snap) => {
      const data = snap.val();
      if (data) {
        setNetworkTiers(Object.entries(data).map(([id, val]: [string, unknown]) => ({ id, ...(val as Record<string, unknown>) })) as NetworkTier[]);
      } else {
        setNetworkTiers([]);
      }
    });
    return () => unsub();
  }, [network]);

  if (!network) return null;

  const availableCards = allCards.filter(c => c.network === network.id && !c.isUsed);
  const soldCards = allCards.filter(c => c.network === network.id && c.isUsed);
  const totalRevenue = soldCards.reduce((sum, c) => sum + (c.price || 0), 0);

  // Combine global tiers with network-specific tiers
  const combinedTiers = [...allTiers];
  networkTiers.forEach(nt => {
    if (!combinedTiers.some(t => t.tier === nt.tier)) {
      combinedTiers.push(nt as unknown as TierItem);
    }
  });

  // Group cards by tier
  const tierStats = combinedTiers.map(t => {
    const tierCards = allCards.filter(c => c.network === network.id && c.tier === t.tier);
    const available = tierCards.filter(c => !c.isUsed).length;
    const sold = tierCards.filter(c => c.isUsed).length;
    return { ...t, available, sold };
  }).filter(t => t.available > 0 || t.sold > 0).sort((a, b) => a.price - b.price);

  const networkTypeLabels: Record<string, string> = {
    wifi: t("network.wifi"),
    fiber: t("network.fiber"),
    "4g_lte": t("network.lte"),
    satellite: t("network.satellite"),
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[150] flex items-end justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
      dir={isRTL ? "rtl" : "ltr"}
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="w-full max-w-lg bg-white rounded-t-3xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with network color */}
        <div className="relative overflow-hidden flex-shrink-0" style={{ background: `linear-gradient(135deg, ${network.color || "#1B7A3D"}, ${network.color || "#1B7A3D"}CC)` }}>
          <div className="absolute -top-6 -right-6 w-28 h-28 bg-white/10 rounded-full" />
          <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-white/5 rounded-full" />

          <div className="relative z-10 p-5">
            {/* Close button */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shadow-md bg-white/20 overflow-hidden"
                >
                  {(network as Record<string, unknown>).imageBase64 ? (
                    <img src={(network as Record<string, unknown>).imageBase64 as string} alt={network.name} className="w-12 h-12 rounded-xl object-cover" />
                  ) : (
                    <span>{network.emoji}</span>
                  )}
                </div>
                <div>
                  <h2 className="text-lg font-black text-white">{network.name}</h2>
                  {network.ownerName && (
                    <p className="text-white/60 text-[10px]">{t("networkDetail.manager")} {network.ownerName}</p>
                  )}
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={onClose} className="text-white/60 hover:text-white hover:bg-white/10 rounded-xl h-8 w-8 p-0">
                <X className="w-5 h-5" />
              </Button>
            </div>

            {/* Location & Type badges */}
            <div className="flex flex-wrap gap-1.5 mb-3">
              {network.provinceName && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-white/20 text-white px-2 py-1 rounded-lg">
                  <Globe className="w-3 h-3" />{network.provinceName}
                </span>
              )}
              {network.district && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-white/20 text-white px-2 py-1 rounded-lg">
                  <MapPin className="w-3 h-3" />{network.district}
                </span>
              )}
              {network.networkType && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-white/20 text-white px-2 py-1 rounded-lg">
                  <Wifi className="w-3 h-3" />{networkTypeLabels[network.networkType] || network.networkType}
                </span>
              )}
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-white/15 rounded-xl p-2 text-center">
                <p className="text-lg font-black text-white">{availableCards.length}</p>
                <p className="text-[8px] text-white/60">{t("networkDetail.availableCards")}</p>
              </div>
              <div className="bg-white/15 rounded-xl p-2 text-center">
                <p className="text-lg font-black text-white">{soldCards.length}</p>
                <p className="text-[8px] text-white/60">{t("networkDetail.soldCards")}</p>
              </div>
              <div className="bg-white/15 rounded-xl p-2 text-center">
                <p className="text-sm font-black text-yellow-300">{totalRevenue.toLocaleString()}</p>
                <p className="text-[8px] text-white/60">{t("networkDetail.totalSales")}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto pb-6">
          {/* Network Details Section */}
          <div className="p-4">
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <div className="p-3 border-b border-gray-50 flex items-center gap-2">
                <Info className="w-4 h-4 text-blue-500" />
                <h3 className="text-sm font-black text-gray-900">{t("networkDetail.details")}</h3>
              </div>
              <div className="p-3 space-y-2">
                {network.exactLocation && (
                  <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-xl">
                    <MapPin className="w-4 h-4 text-red-500 shrink-0" />
                    <div>
                      <p className="text-[10px] text-gray-400 font-bold">{t("networkDetail.exactLocation")}</p>
                      <p className="text-xs text-gray-700">{network.exactLocation}</p>
                    </div>
                  </div>
                )}
                {network.coverage && (
                  <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-xl">
                    <Zap className="w-4 h-4 text-orange-500 shrink-0" />
                    <div>
                      <p className="text-[10px] text-gray-400 font-bold">{t("networkDetail.coverage")}</p>
                      <p className="text-xs text-gray-700">{network.coverage}</p>
                    </div>
                  </div>
                )}
                {network.speed && (
                  <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-xl">
                    <Navigation className="w-4 h-4 text-blue-500 shrink-0" />
                    <div>
                      <p className="text-[10px] text-gray-400 font-bold">{t("networkDetail.speed")}</p>
                      <p className="text-xs text-gray-700">{network.speed}</p>
                    </div>
                  </div>
                )}
                {network.connectionIP && (
                  <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-xl">
                    <Wifi className="w-4 h-4 text-green-500 shrink-0" />
                    <div>
                      <p className="text-[10px] text-gray-400 font-bold">{t("networkDetail.ipAddress")}</p>
                      <p className="text-xs text-gray-700 font-mono" dir="ltr">{network.connectionIP}</p>
                    </div>
                  </div>
                )}
                {network.ownerPhone && (
                  <div className="flex gap-2 mt-2">
                    <a
                      href={generateWhatsAppLink(network.ownerPhone, `مرحباً، أريد الاستفسار عن شبكة ${network.name}`)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 flex items-center justify-center gap-1.5 bg-green-500 text-white font-bold rounded-xl h-10 text-xs hover:bg-green-600 transition-colors"
                    >
                      <MessageCircle className="w-4 h-4" />{t("networkDetail.whatsapp")}
                    </a>
                    <a
                      href={`tel:${network.ownerPhone}`}
                      className="flex-1 flex items-center justify-center gap-1.5 bg-blue-500 text-white font-bold rounded-xl h-10 text-xs hover:bg-blue-600 transition-colors"
                    >
                      <Phone className="w-4 h-4" />{t("networkDetail.call")}
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Available Tiers */}
          {tierStats.length > 0 && (
            <div className="px-4 mb-4">
              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                <div className="p-3 border-b border-gray-50 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-[#1B7A3D]" />
                  <h3 className="text-sm font-black text-gray-900">{t("networkDetail.availableCategories")}</h3>
                </div>
                <div className="p-3 space-y-1.5">
                  {tierStats.map(t => (
                    <div key={t.tier || t.id} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-xl">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{t.icon || "🟢"}</span>
                        <div>
                          <p className="text-xs font-bold text-gray-900">{t.price?.toLocaleString()} ر.ي</p>
                          <p className="text-[10px] text-gray-400">{t.data} / {t.duration} {t("networkDetail.days")}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className="bg-emerald-100 text-emerald-700 text-[8px]">{t.available} {t("networkDetail.available")}</Badge>
                        <Badge className="bg-gray-100 text-gray-500 text-[8px]">{t.sold} {t("networkDetail.sold")}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Card Sale Locations */}
          <div className="px-4">
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <div className="p-3 border-b border-gray-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Store className="w-4 h-4 text-orange-500" />
                  <h3 className="text-sm font-black text-gray-900">{t("networkDetail.saleLocations")}</h3>
                </div>
                <Badge className="bg-orange-100 text-orange-700 text-[9px]">{saleLocations.length} {t("networkDetail.location")}</Badge>
              </div>
              <div className="p-3">
                {saleLocations.length === 0 ? (
                  <div className="text-center py-6">
                    <Store className="w-10 h-10 mx-auto text-gray-200 mb-2" />
                    <p className="text-gray-400 text-xs font-bold">{t("networkDetail.noLocations")}</p>
                    <p className="text-gray-300 text-[10px] mt-1">{t("networkDetail.addFromPanel")}</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {saleLocations.map((loc) => (
                      <motion.div
                        key={loc.id}
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="p-3 bg-orange-50 rounded-xl border border-orange-100"
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-9 h-9 rounded-xl bg-orange-100 flex items-center justify-center shrink-0 mt-0.5">
                            <Store className="w-4 h-4 text-orange-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-bold text-gray-900">{loc.name}</h4>
                            <div className="flex flex-wrap gap-1.5 mt-1.5">
                              {loc.provinceName && (
                                <span className="inline-flex items-center gap-0.5 text-[9px] font-bold bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-md">
                                  <Globe className="w-2.5 h-2.5" />{loc.provinceName}
                                </span>
                              )}
                              {loc.district && (
                                <span className="inline-flex items-center gap-0.5 text-[9px] font-bold bg-red-100 text-red-700 px-1.5 py-0.5 rounded-md">
                                  <MapPin className="w-2.5 h-2.5" />{loc.district}
                                </span>
                              )}
                            </div>
                            {loc.exactLocation && (
                              <p className="text-[10px] text-gray-500 mt-1.5 flex items-center gap-1">
                                <Map className="w-3 h-3 text-gray-400" />{loc.exactLocation}
                              </p>
                            )}
                            {loc.phone && (
                              <a
                                href={`tel:${loc.phone}`}
                                className="inline-flex items-center gap-1 text-[10px] text-blue-500 font-bold mt-1.5 hover:underline"
                              >
                                <Phone className="w-3 h-3" />{loc.phone}
                              </a>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom safe area */}
        <div className="h-2 bg-white" />
      </motion.div>
    </motion.div>
  );
}
