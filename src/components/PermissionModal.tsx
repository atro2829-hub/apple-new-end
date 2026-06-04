"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, BellRing, X, CheckCircle, Camera, MapPin, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { requestNotificationPermission, getNotificationPermission } from "@/lib/notifications";
import { useLanguage } from "@/context/LanguageContext";

const DISMISSED_KEY = "applenet_perms_dismissed";

export function PermissionModal() {
  const { t, isRTL } = useLanguage();
  const [show, setShow] = useState(false);
  const [step, setStep] = useState<"notifications" | "done">("notifications");
  const [notifStatus, setNotifStatus] = useState<"idle" | "granted" | "denied" | "loading">("idle");
  const [cameraStatus, setCameraStatus] = useState<"idle" | "granted" | "denied" | "loading">("idle");
  const [locationStatus, setLocationStatus] = useState<"idle" | "granted" | "denied" | "loading">("idle");

  useEffect(() => {
    const timer = setTimeout(() => {
      const dismissed = sessionStorage.getItem(DISMISSED_KEY);
      if (dismissed) return;
      const perm = getNotificationPermission();
      if (perm === "default") {
        setShow(true);
      }
    }, 3500);
    return () => clearTimeout(timer);
  }, []);

  const handleAllow = async () => {
    setNotifStatus("loading");

    // 1) Request push notifications
    const result = await requestNotificationPermission();
    setNotifStatus(result.granted ? "granted" : "denied");

    // 2) Request camera permission
    setCameraStatus("loading");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      // Immediately stop the stream - we just needed the permission
      stream.getTracks().forEach(track => track.stop());
      setCameraStatus("granted");
    } catch {
      setCameraStatus("denied");
    }

    // 3) Request location permission
    setLocationStatus("loading");
    try {
      await new Promise<void>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          () => resolve(),
          () => reject(new Error("Location denied")),
          { timeout: 5000 }
        );
      });
      setLocationStatus("granted");
    } catch {
      setLocationStatus("denied");
    }

    setTimeout(() => {
      handleDismiss();
    }, 1500);
  };

  const handleDismiss = () => {
    sessionStorage.setItem(DISMISSED_KEY, "1");
    setShow(false);
  };

  const isProcessing = notifStatus === "loading" || cameraStatus === "loading" || locationStatus === "loading";

  return (
    <AnimatePresence>
      {show && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-[300] backdrop-blur-sm"
            onClick={handleDismiss}
          />
          <motion.div
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", stiffness: 350, damping: 30 }}
            className="fixed bottom-0 left-0 right-0 z-[301] max-w-lg mx-auto"
            dir={isRTL ? "rtl" : "ltr"}
          >
            <div className="bg-white dark:bg-slate-900 rounded-t-3xl shadow-2xl overflow-hidden">
              <div className="w-10 h-1 bg-gray-200 dark:bg-slate-700 rounded-full mx-auto mt-3 mb-0" />

              <div className="px-6 pt-5 pb-8">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-lg font-black text-gray-900 dark:text-white">
                    {t("permissions2.title")}
                  </h2>
                  <button
                    onClick={handleDismiss}
                    className="w-8 h-8 rounded-full bg-gray-100 dark:bg-slate-700 flex items-center justify-center"
                  >
                    <X className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                  </button>
                </div>

                <div className="space-y-3 mb-6">
                  <PermissionItem
                    icon={<BellRing className="w-5 h-5 text-[#1B7A3D]" />}
                    title={t("permissions2.pushNotifications")}
                    desc={t("permissions2.pushDesc")}
                    status={notifStatus}
                    bgColor="bg-[#E8F5E9] dark:bg-green-900/30"
                  />
                  <PermissionItem
                    icon={<Camera className="w-5 h-5 text-blue-500" />}
                    title={t("permissions2.cameraPhotos")}
                    desc={t("permissions2.cameraDesc")}
                    status={cameraStatus}
                    bgColor="bg-blue-50 dark:bg-blue-900/30"
                  />
                  <PermissionItem
                    icon={<MapPin className="w-5 h-5 text-orange-500" />}
                    title={t("permissions2.location")}
                    desc={t("permissions2.locationDesc")}
                    status={locationStatus}
                    bgColor="bg-orange-50 dark:bg-orange-900/30"
                  />
                </div>

                <div className="flex items-center gap-2 mb-5 p-3 bg-gray-50 dark:bg-slate-800 rounded-2xl">
                  <Shield className="w-4 h-4 text-[#1B7A3D] flex-shrink-0" />
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">
                    {t("permissions2.dataSafe")}
                  </p>
                </div>

                <div className="flex gap-3">
                  <Button
                    variant="ghost"
                    onClick={handleDismiss}
                    className="flex-1 rounded-2xl h-12 font-bold text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-slate-700"
                  >
                    {t("permissions2.later")}
                  </Button>
                  <Button
                    onClick={handleAllow}
                    disabled={isProcessing}
                    className="flex-1 bg-gradient-to-l from-[#1B7A3D] to-[#22A24D] hover:from-[#165E30] hover:to-[#1B7A3D] text-white font-bold rounded-2xl h-12 btn-green-shadow"
                  >
                    {isProcessing ? (
                      <span className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        {t("permissions2.enabling")}
                      </span>
                    ) : notifStatus === "granted" && cameraStatus === "granted" && locationStatus === "granted" ? (
                      <span className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4" />
                        {t("permissions2.enabled")}
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <Bell className="w-4 h-4" />
                        {t("permissions2.allowAll")}
                      </span>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function PermissionItem({
  icon,
  title,
  desc,
  status,
  bgColor,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  status: "idle" | "granted" | "denied" | "loading";
  bgColor: string;
}) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-2xl bg-gray-50/50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-700">
      <div className={`w-10 h-10 rounded-xl ${bgColor} flex items-center justify-center flex-shrink-0`}>
        {status === "loading" ? (
          <div className="w-5 h-5 border-2 border-gray-300 border-t-[#1B7A3D] rounded-full animate-spin" />
        ) : (
          icon
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-gray-900 dark:text-white">{title}</p>
        <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">{desc}</p>
      </div>
      {status === "granted" && <CheckCircle className="w-5 h-5 text-[#1B7A3D] flex-shrink-0 mt-0.5" />}
      {status === "denied" && <X className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />}
    </div>
  );
}
