"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import type { Language } from "@/lib/i18n";
import { t as translate } from "@/lib/i18n";

interface LanguageContextValue {
  lang: Language;
  setLang: (lang: Language) => void;
  toggleLang: () => void;
  t: (path: string) => string;
  dir: "rtl" | "ltr";
  isRTL: boolean;
}

const LanguageContext = createContext<LanguageContextValue>({
  lang: "ar",
  setLang: () => {},
  toggleLang: () => {},
  t: (p) => p,
  dir: "rtl",
  isRTL: true,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Language>("ar");

  useEffect(() => {
    const saved = localStorage.getItem("applenet_lang") as Language | null;
    if (saved === "en" || saved === "ar") {
      setLangState(saved);
    }
  }, []);

  const setLang = useCallback((newLang: Language) => {
    setLangState(newLang);
    localStorage.setItem("applenet_lang", newLang);
    document.documentElement.lang = newLang;
    document.documentElement.dir = newLang === "ar" ? "rtl" : "ltr";
  }, []);

  const toggleLang = useCallback(() => {
    setLang(lang === "ar" ? "en" : "ar");
  }, [lang, setLang]);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  }, [lang]);

  const tFn = useCallback((path: string) => translate(lang, path), [lang]);

  return (
    <LanguageContext.Provider
      value={{
        lang,
        setLang,
        toggleLang,
        t: tFn,
        dir: lang === "ar" ? "rtl" : "ltr",
        isRTL: lang === "ar",
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
