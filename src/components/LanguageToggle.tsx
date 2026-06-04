"use client";

import { motion } from "framer-motion";
import { Globe } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

export function LanguageToggle() {
  const { lang, toggleLang, t, isRTL } = useLanguage();

  return (
    <motion.button
      whileTap={{ scale: 0.85 }}
      onClick={toggleLang}
      className="w-10 h-10 rounded-2xl bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 flex items-center justify-center gap-1 transition-colors haptic-press"
      title={t("language.toggle")}
      aria-label={t("language.toggle")}
    >
      <Globe className="w-4 h-4 text-slate-600 dark:text-slate-300" />
    </motion.button>
  );
}
