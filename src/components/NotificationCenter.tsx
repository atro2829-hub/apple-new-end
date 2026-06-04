"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell, X, TrendingUp, CreditCard, Gift, Megaphone, Trash2, Crown,
  CheckCircle, XCircle, ShoppingBag, Check, CheckCheck
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { db } from "@/lib/firebase";
import { ref, onValue, update, remove } from "firebase/database";
import type { AppNotification } from "@/lib/types";
import { iOSSpring, formatDate } from "@/lib/constants";
import { useLanguage } from "@/context/LanguageContext";

interface NotificationCenterProps {
  uid: string;
  isAdmin: boolean;
}

// Notification type configuration with specific icons and colors
const NOTIF_TYPE_CONFIG: Record<string, {
  icon: React.ElementType;
  bg: string;
  iconColor: string;
  barColor: string;
  labelKey: string;
}> = {
  deposit_approved: {
    icon: CheckCircle,
    bg: "bg-[#E8F5E9]",
    iconColor: "text-[#1B7A3D]",
    barColor: "bg-[#1B7A3D]",
    labelKey: "notifications2.depositApproved",
  },
  deposit_rejected: {
    icon: XCircle,
    bg: "bg-red-50",
    iconColor: "text-red-500",
    barColor: "bg-red-500",
    labelKey: "notifications2.depositRejected",
  },
  card_purchased: {
    icon: ShoppingBag,
    bg: "bg-blue-50",
    iconColor: "text-blue-500",
    barColor: "bg-blue-500",
    labelKey: "notifications2.cardPurchased",
  },
  gift_received: {
    icon: Gift,
    bg: "bg-purple-50",
    iconColor: "text-purple-500",
    barColor: "bg-purple-500",
    labelKey: "notifications2.incomingGift",
  },
  subscription: {
    icon: Crown,
    bg: "bg-amber-50",
    iconColor: "text-amber-500",
    barColor: "bg-amber-500",
    labelKey: "notifications2.subscription",
  },
  new_deposit_request: {
    icon: CreditCard,
    bg: "bg-sky-50",
    iconColor: "text-sky-500",
    barColor: "bg-sky-500",
    labelKey: "notifications2.depositRequest",
  },
  general: {
    icon: Bell,
    bg: "bg-gray-50",
    iconColor: "text-gray-500",
    barColor: "bg-gray-400",
    labelKey: "notifications2.general",
  },
};

function getTypeConfig(type: string) {
  return NOTIF_TYPE_CONFIG[type] || NOTIF_TYPE_CONFIG.general;
}

export function NotificationCenter({ uid, isAdmin }: NotificationCenterProps) {
  const { t, isRTL } = useLanguage();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedNotif, setSelectedNotif] = useState<AppNotification | null>(null);
  const [mounted, setMounted] = useState(false);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

  const notifPath = isAdmin ? "notifications/admin" : `notifications/${uid}`;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setLoading(true);
    const notifRef = ref(db, notifPath);
    const unsub = onValue(notifRef, (snap) => {
      const data = snap.val();
      if (data) {
        const list = Object.entries(data)
          .map(([id, val]: [string, unknown]) => ({ id, ...(val as Record<string, unknown>) }))
          .sort((a: AppNotification, b: AppNotification) => (b.createdAt || 0) - (a.createdAt || 0)) as AppNotification[];
        setNotifications(list);
      } else {
        setNotifications([]);
      }
      setLoading(false);
    }, (error) => {
      console.error("Notification listener error:", error);
      setLoading(false);
    });
    return () => unsub();
  }, [notifPath]);

  // Lock body scroll when sheet or modal is open
  useEffect(() => {
    if (isOpen || selectedNotif) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [isOpen, selectedNotif]);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const markAsRead = async (notifId: string) => {
    try {
      await update(ref(db, `${notifPath}/${notifId}`), { isRead: true });
    } catch (error) {
      console.error("Mark as read error:", error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const updates: Record<string, boolean> = {};
      notifications.filter(n => !n.isRead).forEach(n => { updates[`${n.id}/isRead`] = true; });
      if (Object.keys(updates).length > 0) {
        await update(ref(db, notifPath), updates);
      }
    } catch (error) {
      console.error("Mark all as read error:", error);
    }
  };

  const deleteNotification = async (notifId: string) => {
    // Animate out first
    setDeletingIds(prev => new Set(prev).add(notifId));
    setTimeout(async () => {
      try {
        await remove(ref(db, `${notifPath}/${notifId}`));
        if (selectedNotif?.id === notifId) setSelectedNotif(null);
      } catch (error) {
        console.error("Delete notification error:", error);
      }
      setDeletingIds(prev => {
        const next = new Set(prev);
        next.delete(notifId);
        return next;
      });
    }, 200);
  };

  const getIcon = (type: string) => {
    const config = getTypeConfig(type);
    const IconComp = config.icon;
    return <IconComp className={`w-4 h-4 ${config.iconColor}`} />;
  };

  const getBgColor = (type: string) => {
    return getTypeConfig(type).bg;
  };

  const getBarColor = (type: string) => {
    return getTypeConfig(type).barColor;
  };

  // Sheet content (rendered via Portal)
  const sheetContent = (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="notif-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/40 z-[9998]"
            onClick={() => setIsOpen(false)}
          />

          {/* Sheet */}
          <motion.div
            key="notif-sheet"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={iOSSpring.gentle}
            className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl z-[9999] shadow-2xl"
            style={{ maxHeight: "85vh", display: "flex", flexDirection: "column" }}
            dir={isRTL ? "rtl" : "ltr"}
          >
            {/* Drag Handle */}
            <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
              <div className="w-10 h-1 rounded-full bg-gray-300" />
            </div>

            {/* Header */}
            <div className="px-4 pb-3 flex items-center justify-between border-b border-gray-100 flex-shrink-0">
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-[#1B7A3D]" />
                <h3 className="text-lg font-black text-gray-900">{t("notifications2.title")}</h3>
                {unreadCount > 0 && (
                  <Badge className="bg-red-500 text-white text-[10px]">{unreadCount} {t("notifications2.new")}</Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={markAllAsRead}
                    className="flex items-center gap-1 text-xs font-bold text-[#1B7A3D] hover:text-[#165E30] transition-colors px-2 py-1 rounded-lg hover:bg-[#E8F5E9]"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    {t("notifications2.readAll")}
                  </motion.button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
                >
                  <X className="w-4 h-4 text-gray-500" />
                </button>
              </div>
            </div>

            {/* Notifications List - scrollable area */}
            <div className="overflow-y-auto px-4 py-3 flex-1 min-h-0">
              {loading ? (
                <div className="py-12 text-center">
                  <motion.div
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    <Bell className="w-10 h-10 mx-auto text-gray-200 mb-3" />
                  </motion.div>
                  <p className="text-gray-400 text-sm">{t("notifications2.loading")}</p>
                </div>
              ) : notifications.length === 0 ? (
                <div className="py-12 text-center">
                  <div className="w-16 h-16 rounded-full bg-[#E8F5E9] flex items-center justify-center mx-auto mb-4">
                    <Bell className="w-8 h-8 text-[#1B7A3D]" />
                  </div>
                  <p className="text-gray-500 font-bold">{t("notifications2.noNotifications")}</p>
                  <p className="text-gray-400 text-xs mt-1">{t("notifications2.noNotificationsDesc")}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {notifications.map((notif, index) => {
                    const config = getTypeConfig(notif.type);
                    const isDeleting = deletingIds.has(notif.id);
                    return (
                      <motion.div
                        key={notif.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: isDeleting ? 0 : 1, y: 0, x: isDeleting ? -100 : 0 }}
                        exit={{ opacity: 0, x: -100 }}
                        transition={{ delay: index * 0.03, ...iOSSpring.gentle }}
                        className={`relative p-3 rounded-2xl ${notif.isRead ? "bg-gray-50" : "bg-white border border-[#E8F5E9]"} flex items-start gap-3 cursor-pointer group active:scale-[0.98] transition-transform`}
                        onClick={() => {
                          if (!notif.isRead) markAsRead(notif.id);
                          setIsOpen(false);
                          setTimeout(() => setSelectedNotif(notif), 200);
                        }}
                      >
                        {/* Unread indicator */}
                        {!notif.isRead && (
                          <div className="absolute top-3 right-3 w-2.5 h-2.5 rounded-full bg-[#1B7A3D] shadow-sm" />
                        )}

                        {/* Type icon */}
                        <div className={`w-10 h-10 rounded-xl ${config.bg} flex items-center justify-center flex-shrink-0`}>
                          {React.createElement(config.icon, { className: `w-4 h-4 ${config.iconColor}` })}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0 pr-4">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${config.bg} ${config.iconColor}`}>{t(config.labelKey)}</span>
                          </div>
                          <p className="text-sm font-bold text-gray-900">{notif.title}</p>
                          <p className="text-xs text-gray-500 mt-0.5 leading-relaxed line-clamp-2">{notif.message}</p>
                          <p className="text-[10px] text-gray-300 mt-1.5">{notif.createdAt ? formatDate(notif.createdAt) : ""}</p>
                        </div>

                        {/* Delete button */}
                        <motion.button
                          whileTap={{ scale: 0.9 }}
                          onClick={(e) => { e.stopPropagation(); deleteNotification(notif.id); }}
                          className="absolute bottom-3 left-3 opacity-0 group-hover:opacity-100 transition-opacity w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center hover:bg-red-100"
                        >
                          <Trash2 className="w-3 h-3 text-red-400" />
                        </motion.button>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  // Modal content (rendered via Portal)
  const modalContent = (
    <AnimatePresence>
      {selectedNotif && (
        <>
          {/* Backdrop */}
          <motion.div
            key="modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/50 z-[10000]"
            onClick={() => setSelectedNotif(null)}
          />

          {/* Centered Floating Card */}
          <motion.div
            key="modal-card"
            initial={{ opacity: 0, scale: 0.85, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85, y: 20 }}
            transition={{ ...iOSSpring.bouncy }}
            className="fixed z-[10001] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-[400px] bg-white rounded-3xl shadow-2xl overflow-hidden"
            dir={isRTL ? "rtl" : "ltr"}
          >
            {/* Top Color Bar */}
            <div className={`h-2 w-full ${getBarColor(selectedNotif.type)}`} />

            {/* Close Button */}
            <button
              onClick={() => setSelectedNotif(null)}
              className="absolute top-4 left-4 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors z-10"
            >
              <X className="w-4 h-4 text-gray-500" />
            </button>

            {/* Content */}
            <div className="p-6 pt-5">
              {/* Icon & Type */}
              <div className="flex flex-col items-center text-center mb-5">
                <div className={`w-16 h-16 rounded-2xl ${getBgColor(selectedNotif.type)} flex items-center justify-center mb-3 shadow-sm`}>
                  {React.cloneElement(getIcon(selectedNotif.type), { className: "w-8 h-8" })}
                </div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded ${getBgColor(selectedNotif.type)} ${getTypeConfig(selectedNotif.type).iconColor}`}>
                    {t(getTypeConfig(selectedNotif.type).labelKey)}
                  </span>
                  {!selectedNotif.isRead && (
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-[#E8F5E9] text-[#1B7A3D]">{t("notifications2.new")}</span>
                  )}
                </div>
                <h3 className="text-lg font-black text-gray-900 leading-snug">{selectedNotif.title}</h3>
              </div>

              {/* Message */}
              <div className="bg-gray-50 rounded-2xl p-4 mb-5">
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{selectedNotif.message}</p>
              </div>

              {/* Date */}
              <div className="flex items-center justify-center gap-1.5 text-gray-300 mb-5">
                <span className="text-xs">{selectedNotif.createdAt ? formatDate(selectedNotif.createdAt) : ""}</span>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={() => { deleteNotification(selectedNotif.id); setSelectedNotif(null); }}
                  className="flex-1 py-3 rounded-2xl bg-red-50 text-red-500 font-bold text-sm hover:bg-red-100 transition-colors flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  {t("notifications2.delete")}
                </button>
                <button
                  onClick={() => setSelectedNotif(null)}
                  className="flex-1 py-3 rounded-2xl bg-[#1B7A3D] text-white font-bold text-sm hover:bg-[#165E30] transition-colors"
                >
                  {t("common.close")}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  return (
    <>
      {/* Bell Button - stays in header */}
      <button
        onClick={() => setIsOpen(true)}
        className="relative w-9 h-9 rounded-xl bg-[#E8F5E9] flex items-center justify-center hover:bg-green-100 transition-colors"
      >
        <Bell className="w-5 h-5 text-[#1B7A3D]" />
        {unreadCount > 0 && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ ...iOSSpring.bouncy }}
            className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] rounded-full bg-red-500 flex items-center justify-center shadow-sm"
          >
            <span className="text-[9px] text-white font-bold">{unreadCount > 9 ? "9+" : unreadCount}</span>
          </motion.div>
        )}
      </button>

      {/* Render overlays via Portal to escape stacking context */}
      {mounted && createPortal(sheetContent, document.body)}
      {mounted && createPortal(modalContent, document.body)}
    </>
  );
}
