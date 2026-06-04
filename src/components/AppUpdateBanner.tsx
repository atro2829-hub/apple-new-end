"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw, X, Download } from "lucide-react";
import { db } from "@/lib/firebase";
import { ref, onValue } from "firebase/database";
import { useLanguage } from "@/context/LanguageContext";

const APP_VERSION = "2.1.0";

function compareVersions(v1: string, v2: string): number {
  const parts1 = v1.split(".").map(Number);
  const parts2 = v2.split(".").map(Number);
  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;
    if (p1 < p2) return -1;
    if (p1 > p2) return 1;
  }
  return 0;
}

export function AppUpdateBanner() {
  const { t, isRTL } = useLanguage();
  const [showBanner, setShowBanner] = useState(false);
  const [newWorker, setNewWorker] = useState<ServiceWorker | null>(null);
  const [updating, setUpdating] = useState(false);
  const [updateType, setUpdateType] = useState<"pwa" | "version">("pwa");
  const [downloadUrl, setDownloadUrl] = useState("");
  const [updateMsg, setUpdateMsg] = useState("");

  // Listen for Firebase settings (app version, download URL)
  useEffect(() => {
    const settingsUnsub = onValue(ref(db, "settings"), (snap) => {
      const data = snap.val();
      if (!data) return;

      const latestVersion = data.latestAppVersion as string | undefined;
      const url = data.appDownloadUrl as string | undefined;
      const msg = data.updateMessage as string | undefined;

      if (url) setDownloadUrl(url);
      if (msg) setUpdateMsg(msg);

      if (latestVersion && compareVersions(APP_VERSION, latestVersion) < 0) {
        // Current app version is older than latest
        setUpdateType("version");
        setShowBanner(true);
      }
    });
    return () => settingsUnsub();
  }, []);

  // Check for PWA service worker updates
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    navigator.serviceWorker.ready.then((registration) => {
      registration.addEventListener("updatefound", () => {
        const newSW = registration.installing;
        if (newSW) {
          newSW.addEventListener("statechange", () => {
            if (newSW.state === "installed" && navigator.serviceWorker.controller) {
              setNewWorker(newSW);
              setUpdateType("pwa");
              setShowBanner(true);
            }
          });
        }
      });

      if (registration.waiting) {
        setNewWorker(registration.waiting);
        setUpdateType("pwa");
        setShowBanner(true);
      }
    });
  }, []);

  const handlePwaUpdate = async () => {
    setUpdating(true);
    if (newWorker) {
      newWorker.postMessage({ type: "SKIP_WAITING" });
    }
    setTimeout(() => {
      window.location.reload();
    }, 500);
  };

  const handleVersionUpdate = () => {
    if (downloadUrl) {
      window.open(downloadUrl, "_blank");
    }
    setShowBanner(false);
  };

  const handleDismiss = () => {
    setShowBanner(false);
  };

  const message = updateType === "version"
    ? (updateMsg || t("update.newUpdate"))
    : t("update.tapToUpdate");

  return (
    <AnimatePresence>
      {showBanner && (
        <motion.div
          initial={{ y: -80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -80, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          className="fixed top-0 left-0 right-0 z-[150] safe-top"
        >
          <div className="bg-gradient-to-l from-[#1B7A3D] to-[#22A24D] text-white shadow-lg" dir={isRTL ? "rtl" : "ltr"}>
            <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <motion.div
                  animate={{ rotate: updating ? 360 : 0 }}
                  transition={{ duration: 1, repeat: updating ? Infinity : 0, ease: "linear" }}
                >
                  {updateType === "version" ? (
                    <Download className="w-4 h-4 flex-shrink-0" />
                  ) : (
                    <RefreshCw className="w-4 h-4 flex-shrink-0" />
                  )}
                </motion.div>
                <span className="text-sm font-bold truncate">
                  {updating ? t("update.updating") : message}
                </span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {!updating && (
                  <>
                    <button
                      onClick={updateType === "pwa" ? handlePwaUpdate : handleVersionUpdate}
                      className="px-3 py-1 bg-white/20 rounded-lg text-xs font-bold hover:bg-white/30 transition-colors"
                    >
                      {updateType === "pwa" ? t("update.update") : t("update.download")}
                    </button>
                    <button
                      onClick={handleDismiss}
                      className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
