"use client";

import React from "react";
import { motion } from "framer-motion";

export function AppleNetLogo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const sizes = {
    sm: { dots: "w-2 h-2", text: "text-base", gap: "gap-1" },
    md: { dots: "w-3 h-3", text: "text-xl", gap: "gap-1.5" },
    lg: { dots: "w-4 h-4", text: "text-3xl", gap: "gap-2" },
  };
  const s = sizes[size];
  return (
    <motion.div
      className="flex items-center gap-2"
      whileTap={{ scale: 0.95 }}
    >
      <div className={`grid grid-cols-2 ${s.gap}`}>
        <motion.div
          className={`${s.dots} rounded-full bg-red-500`}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0, type: "spring", stiffness: 500, damping: 20 }}
        />
        <motion.div
          className={`${s.dots} rounded-full bg-blue-500`}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.05, type: "spring", stiffness: 500, damping: 20 }}
        />
        <motion.div
          className={`${s.dots} rounded-full bg-yellow-500`}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.1, type: "spring", stiffness: 500, damping: 20 }}
        />
        <motion.div
          className={`${s.dots} rounded-full bg-[#1B7A3D]`}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.15, type: "spring", stiffness: 500, damping: 20 }}
        />
      </div>
      <span className={`${s.text} font-black`}>
        <span className="text-[#1B7A3D]">Apple</span>
        <span className="text-gray-900">Net</span>
      </span>
    </motion.div>
  );
}
