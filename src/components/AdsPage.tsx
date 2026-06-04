"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Megaphone } from "lucide-react";
import { db } from "@/lib/firebase";
import { ref, onValue } from "firebase/database";
import type { Advertisement } from "@/lib/types";

export function AdsPage() {
  const [ads, setAds] = useState<Advertisement[]>([]);

  useEffect(() => {
    const unsub = onValue(ref(db, "advertisements"), (snap) => {
      const data = snap.val();
      if (data) setAds(Object.entries(data).map(([id, val]: [string, unknown]) => ({ id, ...(val as Record<string, unknown>) })).filter((a: Record<string, unknown>) => a.isActive) as Advertisement[]);
    });
    return () => unsub();
  }, []);

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ type: "spring", stiffness: 120, damping: 14 }} className="px-4 pt-4">
      <div className="bg-gradient-to-br from-orange-50 to-yellow-50 rounded-2xl p-4 mb-4">
        <h2 className="text-xl font-black text-gray-900 flex items-center gap-2"><Megaphone className="w-6 h-6 text-orange-500" />الإعلانات</h2>
      </div>
      {ads.length > 0 ? (
        <div className="space-y-3 pb-4">{ads.map(ad => (<div key={ad.id} className="bg-white rounded-2xl card-shadow overflow-hidden">{ad.imageUrl && <img src={ad.imageUrl} alt={ad.title} className="w-full h-40 object-cover" />}<div className="p-4"><h4 className="font-bold text-gray-900">{ad.title}</h4><p className="text-sm text-gray-500 mt-1">{ad.description}</p></div></div>))}</div>
      ) : (
        <div className="space-y-3 pb-4">
          <div className="bg-white rounded-2xl card-shadow overflow-hidden"><img src="/images/IMG-20260527-WA0043.jpg" alt="إعلان" className="w-full h-48 object-cover" /><div className="p-4"><h4 className="font-bold text-gray-900">شرائح Apple.NET</h4><p className="text-sm text-gray-500 mt-1">سيعمل شريحة Apple.NET وسيبيعها بالاسواق قريباً!</p></div></div>
          <div className="bg-white rounded-2xl card-shadow overflow-hidden"><img src="/images/IMG-20260527-WA0044.jpg" alt="إعلان" className="w-full h-48 object-cover" /><div className="p-4"><h4 className="font-bold text-gray-900">عروض حصرية</h4><p className="text-sm text-gray-500 mt-1">تابعنا للحصول على أحدث العروض</p></div></div>
        </div>
      )}
    </motion.div>
  );
}
