"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquareWarning, Plus, CheckCircle2, XCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { db } from "@/lib/firebase";
import { ref, set, push, onValue, update, remove, get } from "firebase/database";
import { toast } from "sonner";
import { useLanguage } from "@/context/LanguageContext";
import type { User } from "firebase/auth";
import type { AppUser } from "@/lib/types";

interface ComplaintPageProps {
  user: User | null;
  isAdmin: boolean;
  onBack?: () => void;
}

interface Ticket {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  subject: string;
  description: string;
  type: string;
  status: "pending" | "accepted" | "rejected";
  createdAt: number;
  resolvedAt: number | null;
  adminNote: string | null;
}

export function ComplaintPage({ user, isAdmin, onBack }: ComplaintPageProps) {
  const { t, isRTL } = useLanguage();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [ticketType, setTicketType] = useState("complaint");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const unsub = onValue(ref(db, "tickets"), (snap) => {
      const data = snap.val();
      if (data) {
        let ticketsList = Object.entries(data).map(([id, val]: [string, unknown]) => ({
          id,
          ...(val as Record<string, unknown>),
        })).sort((a: Ticket, b: Ticket) => (b.createdAt || 0) - (a.createdAt || 0)) as Ticket[];
        
        // Non-admin users only see their own tickets
        if (!isAdmin && user) {
          ticketsList = ticketsList.filter(t => t.userId === user.uid);
        }
        setTickets(ticketsList);
      } else {
        setTickets([]);
      }
    });
    return () => unsub();
  }, [isAdmin, user]);

  const handleSubmit = async () => {
    if (!user) return;
    if (!subject.trim() || !description.trim()) {
      toast.error(t("complaint.fillFields"));
      return;
    }
    setIsSubmitting(true);
    try {
      const userSnap = await get(ref(db, `users/${user.uid}`));
      const userData = userSnap.val() as AppUser | null;
      const ticketRef = push(ref(db, "tickets"));
      await set(ticketRef, {
        userId: user.uid,
        userName: userData?.displayName || user.email?.split("@")[0] || "",
        userEmail: user.email || "",
        subject: subject.trim(),
        description: description.trim(),
        type: ticketType,
        status: "pending",
        createdAt: Date.now(),
        resolvedAt: null,
        adminNote: null,
      });
      setSubject("");
      setDescription("");
      setShowForm(false);
      toast.success(t("complaint.submitted"));
    } catch {
      toast.error(t("common.error"));
    }
    setIsSubmitting(false);
  };

  const handleAccept = async (ticket: Ticket) => {
    try {
      // Send notification to user
      const notifRef = push(ref(db, `notifications/${ticket.userId}`));
      await set(notifRef, {
        type: "general",
        title: t("complaint.acceptedTitle"),
        message: `${t("complaint.acceptedMsg")} "${ticket.subject}"`,
        isRead: false,
        createdAt: Date.now(),
      });
      // Delete ticket after acceptance
      await remove(ref(db, `tickets/${ticket.id}`));
      toast.success(t("complaint.acceptedAndRemoved"));
    } catch {
      toast.error(t("common.error"));
    }
  };

  const handleReject = async (ticket: Ticket) => {
    try {
      await update(ref(db, `tickets/${ticket.id}`), {
        status: "rejected",
        resolvedAt: Date.now(),
        adminNote: t("complaint.rejectedNote"),
      });
      // Send notification
      const notifRef = push(ref(db, `notifications/${ticket.userId}`));
      await set(notifRef, {
        type: "general",
        title: t("complaint.rejectedTitle"),
        message: `${t("complaint.rejectedMsg")} "${ticket.subject}"`,
        isRead: false,
        createdAt: Date.now(),
      });
      toast.success(t("complaint.rejected"));
    } catch {
      toast.error(t("common.error"));
    }
  };

  const handleDeleteRejected = async (ticketId: string) => {
    try {
      await remove(ref(db, `tickets/${ticketId}`));
      toast.success(t("admin2.deleted"));
    } catch {
      toast.error(t("common.error"));
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "pending": return <span className="flex items-center gap-1 text-amber-500 text-[10px] font-bold bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-full"><Clock className="w-3 h-3" />{t("complaint.pending")}</span>;
      case "accepted": return <span className="flex items-center gap-1 text-green-500 text-[10px] font-bold bg-green-50 dark:bg-green-900/20 px-2 py-0.5 rounded-full"><CheckCircle2 className="w-3 h-3" />{t("complaint.accepted")}</span>;
      case "rejected": return <span className="flex items-center gap-1 text-red-500 text-[10px] font-bold bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded-full"><XCircle className="w-3 h-3" />{t("complaint.rejected")}</span>;
      default: return null;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ type: "spring", stiffness: 120, damping: 14 }}
      className="px-4 pt-3 pb-6 space-y-4"
      dir={isRTL ? "rtl" : "ltr"}
    >
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center">
          <MessageSquareWarning className="w-5 h-5 text-orange-500" />
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-black text-gray-900 dark:text-white">{t("complaint.title")}</h2>
          <p className="text-[10px] text-gray-400 dark:text-slate-500">{t("complaint.subtitle")}</p>
        </div>
        {user && !isAdmin && (
          <Button
            onClick={() => setShowForm(!showForm)}
            className="bg-gradient-to-l from-[#1B7A3D] to-[#22A24D] text-white font-bold rounded-xl text-xs h-9 px-3 btn-green-shadow"
          >
            <Plus className="w-3.5 h-3.5 ml-1" />
            {t("complaint.new")}
          </Button>
        )}
      </div>

      {/* New Ticket Form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-white dark:bg-slate-800 rounded-2xl card-shadow p-4 space-y-3 border border-gray-100/50 dark:border-slate-700/50">
              {/* Type selection */}
              <div className="flex gap-2">
                {["complaint", "suggestion", "inquiry"].map((type) => (
                  <button
                    key={type}
                    onClick={() => setTicketType(type)}
                    className={`px-3 py-1.5 rounded-xl text-[10px] font-bold transition-all ${
                      ticketType === type
                        ? "bg-[#1B7A3D] text-white"
                        : "bg-gray-50 dark:bg-slate-700 text-gray-500 dark:text-slate-400"
                    }`}
                  >
                    {t(`complaint.type_${type}`)}
                  </button>
                ))}
              </div>

              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder={t("complaint.subjectPlaceholder")}
                className="bg-gray-50 border-gray-200 rounded-xl text-sm"
              />
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t("complaint.descPlaceholder")}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl text-sm p-3 min-h-[80px] resize-none focus:border-[#1B7A3D] focus:ring-[#1B7A3D] outline-none"
              />
              <div className="flex gap-2">
                <Button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="flex-1 bg-gradient-to-l from-[#1B7A3D] to-[#22A24D] text-white font-bold rounded-xl h-10 btn-green-shadow"
                >
                  {isSubmitting ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : t("complaint.submit")}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setShowForm(false)}
                  className="rounded-xl"
                >
                  {t("common.cancel")}
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tickets List */}
      <div className="space-y-2">
        {tickets.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 rounded-2xl card-shadow p-8 text-center">
            <MessageSquareWarning className="w-12 h-12 text-gray-200 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-gray-400 dark:text-slate-500 text-sm font-bold">{t("complaint.noTickets")}</p>
          </div>
        ) : (
          tickets.map((ticket, i) => (
            <motion.div
              key={ticket.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="bg-white dark:bg-slate-800 rounded-2xl card-shadow p-4 border border-gray-100/50 dark:border-slate-700/50"
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white">{ticket.subject}</h3>
                  {isAdmin && (
                    <p className="text-[10px] text-gray-400 mt-0.5">{ticket.userName} - {ticket.userEmail}</p>
                  )}
                </div>
                {statusBadge(ticket.status)}
              </div>
              <p className="text-xs text-gray-500 dark:text-slate-400 leading-relaxed mb-2">{ticket.description}</p>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-gray-300 dark:text-slate-600">
                  {new Date(ticket.createdAt).toLocaleDateString(isRTL ? "ar-YE" : "en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </span>
                {isAdmin && ticket.status === "pending" && (
                  <div className="flex gap-1.5">
                    <Button
                      onClick={() => handleAccept(ticket)}
                      size="sm"
                      className="bg-green-500 hover:bg-green-600 text-white font-bold rounded-lg text-[10px] h-7 px-2.5"
                    >
                      <CheckCircle2 className="w-3 h-3 ml-0.5" />{t("complaint.accept")}
                    </Button>
                    <Button
                      onClick={() => handleReject(ticket)}
                      size="sm"
                      className="bg-red-500 hover:bg-red-600 text-white font-bold rounded-lg text-[10px] h-7 px-2.5"
                    >
                      <XCircle className="w-3 h-3 ml-0.5" />{t("complaint.reject")}
                    </Button>
                  </div>
                )}
                {isAdmin && ticket.status === "rejected" && (
                  <Button
                    onClick={() => handleDeleteRejected(ticket.id)}
                    size="sm"
                    variant="ghost"
                    className="text-red-400 text-[10px] h-7 px-2"
                  >
                    {t("admin2.deleted")}
                  </Button>
                )}
              </div>
            </motion.div>
          ))
        )}
      </div>
    </motion.div>
  );
}
