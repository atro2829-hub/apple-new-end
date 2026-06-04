"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Smartphone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { db } from "@/lib/firebase";
import { ref, onValue } from "firebase/database";
import type { SimCard } from "@/lib/types";

export function SimsPage() {
  const [sims, setSims] = useState<SimCard[]>([]);

  useEffect(() => {
    const unsub = onValue(ref(db, "simCards"), (snap) => {
      const data = snap.val();
      if (data) setSims(Object.entries(data).map(([id, val]: [string, unknown]) => ({ id, ...(val as Record<string, unknown>) })).filter((s: Record<string, unknown>) => s.isAvailable) as SimCard[]);
    });
    return () => unsub();
  }, []);

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ type: "spring", stiffness: 120, damping: 14 }} className="px-4 pt-4">
      <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-4 mb-4">
        <h2 className="text-xl font-black text-gray-900 flex items-center gap-2"><Smartphone className="w-6 h-6 text-purple-500" />شرائح SIM</h2>
        <p className="text-sm text-gray-500 mt-1">شرائح Apple.NET - متوفرة قريباً!</p>
      </div>
      <div className="space-y-3 pb-4">
        {sims.length > 0 ? sims.map(sim => (
          <div key={sim.id} className="bg-white rounded-2xl card-shadow overflow-hidden">
            {sim.imageUrl && <img src={sim.imageUrl} alt={sim.name} className="w-full h-40 object-cover" />}
            <div className="p-4"><h4 className="font-bold text-gray-900">{sim.name}</h4><p className="text-sm text-gray-500 mt-1">{sim.description}</p><p className="text-[#1B7A3D] font-bold mt-2">{sim.price} ريال يمني</p></div>
          </div>
        )) : (
          <div className="bg-white rounded-2xl card-shadow overflow-hidden">
            <img src="/images/IMG-20260527-WA0042.jpg" alt="شريحة Apple.NET" className="w-full h-48 object-cover" />
            <div className="p-4"><Badge className="bg-purple-50 text-purple-600 mb-2">قريباً</Badge><h4 className="font-bold text-gray-900">شريحة Apple.NET</h4><p className="text-sm text-gray-500 mt-1">شريحة إنترنت عالية السرعة</p><p className="text-[#1B7A3D] font-bold mt-2">5,000 ريال يمني</p></div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
