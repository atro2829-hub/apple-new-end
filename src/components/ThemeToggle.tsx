"use client";

import { useTheme } from "next-themes";
import { motion } from "framer-motion";
import { Sun, Moon } from "lucide-react";
import { useEffect, useState } from "react";
import { useLanguage } from "@/context/LanguageContext";

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { theme, setTheme } = useTheme();
  const { t, isRTL } = useLanguage();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  const isDark = theme === "dark";

  return (
    <motion.button
      whileTap={{ scale: 0.85 }}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={`relative flex items-center justify-center rounded-2xl transition-colors haptic-press
        ${compact
          ? "w-10 h-10 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600"
          : "w-10 h-10 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600"
        }`}
      title={isDark ? t("theme.light") : t("theme.dark")}
      aria-label={t("theme.toggle")}
    >
      <motion.div
        key={isDark ? "moon" : "sun"}
        initial={{ rotate: -30, opacity: 0, scale: 0.7 }}
        animate={{ rotate: 0, opacity: 1, scale: 1 }}
        exit={{ rotate: 30, opacity: 0, scale: 0.7 }}
        transition={{ duration: 0.2 }}
      >
        {isDark
          ? <Sun className="w-4 h-4 text-amber-400" />
          : <Moon className="w-4 h-4 text-slate-600" />
        }
      </motion.div>
    </motion.button>
  );
}
