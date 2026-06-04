"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Wifi, CreditCard, Wallet, ChevronLeft, Sparkles } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

const ONBOARDING_KEY = "applenet_onboarding_done";

interface OnboardingFlowProps {
  onComplete: () => void;
  onLoginClick: () => void;
  onRegisterClick: () => void;
}

function SlideIllustration({ type, color, bgColor }: { type: string; color: string; bgColor: string }) {
  return (
    <div className="relative w-48 h-48 mx-auto mb-6">
      {/* Background circle */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 15 }}
        className="absolute inset-0 rounded-full opacity-20"
        style={{ background: `radial-gradient(circle, ${bgColor} 0%, transparent 70%)` }}
      />
      {/* Main circle */}
      <motion.div
        initial={{ scale: 0, rotate: -30 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 200, damping: 15 }}
        className="absolute inset-6 rounded-full flex items-center justify-center"
        style={{ background: `linear-gradient(135deg, ${bgColor}, ${color}15)` }}
      >
        {/* Decorative elements */}
        {type === "wifi" && (
          <div className="relative">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.2 }}
              className="absolute -top-8 -right-8 w-8 h-8 rounded-full bg-[#1B7A3D]/20"
            />
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.3 }}
              className="absolute -bottom-4 -left-6 w-6 h-6 rounded-full bg-[#22A24D]/30"
            />
            <Wifi className="w-16 h-16" style={{ color }} />
          </div>
        )}
        {type === "cards" && (
          <div className="relative">
            <motion.div
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.1, type: "spring", stiffness: 200, damping: 15 }}
              className="absolute -top-2 -right-4 w-14 h-10 rounded-lg bg-white/60 shadow-sm border border-gray-100"
            />
            <motion.div
              initial={{ y: 5, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200, damping: 15 }}
              className="absolute -bottom-1 -left-3 w-14 h-10 rounded-lg bg-white/80 shadow-sm border border-gray-100"
            />
            <CreditCard className="w-14 h-14" style={{ color }} />
          </div>
        )}
        {type === "wallet" && (
          <div className="relative">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 300, damping: 20 }}
              className="absolute -top-6 -left-6 text-2xl"
            >
              💰
            </motion.div>
            <Wallet className="w-14 h-14" style={{ color }} />
          </div>
        )}
        {type === "start" && (
          <div className="relative">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.15, type: "spring", stiffness: 300, damping: 20 }}
              className="absolute -top-4 -right-8 text-xl"
            >
              ✨
            </motion.div>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.25, type: "spring", stiffness: 300, damping: 20 }}
              className="absolute -bottom-3 -left-6 text-xl"
            >
              🎉
            </motion.div>
            <Sparkles className="w-14 h-14" style={{ color }} />
          </div>
        )}
      </motion.div>
    </div>
  );
}

export function OnboardingFlow({ onComplete, onLoginClick, onRegisterClick }: OnboardingFlowProps) {
  const { t, isRTL } = useLanguage();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [direction, setDirection] = useState(0);

  const slides = [
    {
      id: 0,
      icon: Wifi,
      color: "#1B7A3D",
      bgColor: "#E8F5E9",
      title: t("onboarding.welcome"),
      description: t("onboarding.welcomeDesc"),
      illustration: "wifi",
    },
    {
      id: 1,
      icon: CreditCard,
      color: "#007AFF",
      bgColor: "#E3F2FD",
      title: t("onboarding.buyCards"),
      description: t("onboarding.buyCardsDesc"),
      illustration: "cards",
    },
    {
      id: 2,
      icon: Wallet,
      color: "#FF9500",
      bgColor: "#FFF3E0",
      title: t("onboarding.deposit"),
      description: t("onboarding.depositDesc"),
      illustration: "wallet",
    },
    {
      id: 3,
      icon: Sparkles,
      color: "#AF52DE",
      bgColor: "#F3E5F5",
      title: t("onboarding.getStart"),
      description: t("onboarding.getStartDesc"),
      illustration: "start",
    },
  ];

  // Check if already completed
  useEffect(() => {
    if (localStorage.getItem(ONBOARDING_KEY) === "true") {
      onComplete();
    }
  }, [onComplete]);

  const handleNext = () => {
    if (currentSlide < slides.length - 1) {
      setDirection(1);
      setCurrentSlide((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentSlide > 0) {
      setDirection(-1);
      setCurrentSlide((prev) => prev - 1);
    }
  };

  const handleFinish = () => {
    localStorage.setItem(ONBOARDING_KEY, "true");
    onComplete();
  };

  const handleSkip = () => {
    localStorage.setItem(ONBOARDING_KEY, "true");
    onComplete();
  };

  const slideVariants = {
    enter: (dir: number) => ({
      x: dir > 0 ? -300 : 300,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (dir: number) => ({
      x: dir > 0 ? 300 : -300,
      opacity: 0,
    }),
  };

  const currentSlideData = slides[currentSlide];
  const isLastSlide = currentSlide === slides.length - 1;

  return (
    <div className="fixed inset-0 bg-white z-[200] flex flex-col" dir={isRTL ? "rtl" : "ltr"}>
      {/* Skip button */}
      {!isLastSlide && (
        <div className="flex justify-start p-4">
          <button
            onClick={handleSkip}
            className="text-sm font-semibold text-gray-400 hover:text-gray-600 transition-colors px-3 py-1"
          >
            {t("onboarding.skip")}
          </button>
        </div>
      )}

      {/* Slide content */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 overflow-hidden">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={currentSlide}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="flex flex-col items-center text-center"
          >
            <SlideIllustration
              type={currentSlideData.illustration}
              color={currentSlideData.color}
              bgColor={currentSlideData.bgColor}
            />
            <h2 className="text-2xl font-black text-gray-900 mb-3">
              {currentSlideData.title}
            </h2>
            <p className="text-gray-500 text-sm leading-relaxed max-w-xs">
              {currentSlideData.description}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Page dots */}
      <div className="flex justify-center gap-2 py-4">
        {slides.map((_, index) => (
          <motion.button
            key={index}
            onClick={() => {
              setDirection(index > currentSlide ? 1 : -1);
              setCurrentSlide(index);
            }}
            className="h-2 rounded-full transition-colors"
            animate={{
              width: index === currentSlide ? 24 : 8,
              backgroundColor: index === currentSlide ? currentSlideData.color : "#d1d5db",
            }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
          />
        ))}
      </div>

      {/* Bottom actions */}
      <div className="px-6 pb-10 pt-2 space-y-3">
        {isLastSlide ? (
          <>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={onRegisterClick}
              className="w-full py-3.5 rounded-2xl text-white font-bold text-base"
              style={{
                background: `linear-gradient(to left, #1B7A3D, #22A24D)`,
                boxShadow: "0 2px 8px rgba(27, 122, 61, 0.3)",
              }}
            >
              {t("onboarding.createAccount")}
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={onLoginClick}
              className="w-full py-3.5 rounded-2xl font-bold text-base border-2 border-[#1B7A3D] text-[#1B7A3D] bg-[#E8F5E9]"
            >
              {t("onboarding.signIn")}
            </motion.button>
            <button
              onClick={handleFinish}
              className="w-full py-2 text-sm text-gray-400 hover:text-gray-600 transition-colors"
            >
              {t("onboarding.browseNoAccount")}
            </button>
          </>
        ) : (
          <div className="flex items-center justify-between">
            {currentSlide > 0 ? (
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={handlePrev}
                className="flex items-center gap-1 text-gray-400 font-semibold text-sm"
              >
                <ChevronLeft className="w-4 h-4 rotate-180" />
                {t("onboarding.previous")}
              </motion.button>
            ) : (
              <div />
            )}
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleNext}
              className="px-8 py-3 rounded-2xl text-white font-bold text-sm"
              style={{
                background: `linear-gradient(to left, ${currentSlideData.color}, ${currentSlideData.color}dd)`,
                boxShadow: `0 2px 8px ${currentSlideData.color}40`,
              }}
            >
              {t("onboarding.next")}
            </motion.button>
          </div>
        )}
      </div>
    </div>
  );
}
