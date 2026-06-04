"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, MessageCircle, Heart, ThumbsUp, Laugh, Flame, Clap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { db, auth } from "@/lib/firebase";
import { ref, set, push, onValue, update, remove, get } from "firebase/database";
import { toast } from "sonner";
import { useLanguage } from "@/context/LanguageContext";
import type { User } from "firebase/auth";

interface ChatPageProps {
  user: User | null;
  isAdmin: boolean;
}

interface ChatPost {
  id: string;
  authorId: string;
  authorName: string;
  authorPhoto?: string;
  content: string;
  createdAt: number;
  reactions: Record<string, Record<string, boolean>>; // emoji -> uid -> true
}

const REACTIONS = [
  { emoji: "❤️", key: "heart" },
  { emoji: "👍", key: "thumbsup" },
  { emoji: "😂", key: "laugh" },
  { emoji: "🔥", key: "fire" },
  { emoji: "👏", key: "clap" },
];

export function ChatPage({ user, isAdmin }: ChatPageProps) {
  const { t, isRTL } = useLanguage();
  const [posts, setPosts] = useState<ChatPost[]>([]);
  const [newPost, setNewPost] = useState("");
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    const unsub = onValue(ref(db, "chatPosts"), (snap) => {
      const data = snap.val();
      if (data) {
        const postsList = Object.entries(data).map(([id, val]: [string, unknown]) => ({
          id,
          ...(val as Record<string, unknown>),
        })).sort((a: ChatPost, b: ChatPost) => (b.createdAt || 0) - (a.createdAt || 0)) as ChatPost[];
        setPosts(postsList);
      } else {
        setPosts([]);
      }
    });
    return () => unsub();
  }, []);

  const handlePost = async () => {
    if (!user || !isAdmin) return;
    if (!newPost.trim()) return;
    setIsSending(true);
    try {
      // Get author name and photo
      const userSnap = await get(ref(db, `users/${user.uid}`));
      const userData = userSnap.val();
      const postRef = push(ref(db, "chatPosts"));
      await set(postRef, {
        authorId: user.uid,
        authorName: userData?.displayName || user.email?.split("@")[0] || "Admin",
        authorPhoto: userData?.photoURL || "",
        content: newPost.trim(),
        createdAt: Date.now(),
        reactions: {},
      });
      setNewPost("");
      toast.success(t("chat.posted"));
    } catch {
      toast.error(t("common.error"));
    }
    setIsSending(false);
  };

  const handleReaction = async (postId: string, emojiKey: string) => {
    if (!user) return;
    try {
      const reactionRef = ref(db, `chatPosts/${postId}/reactions/${emojiKey}/${user.uid}`);
      const snap = await get(reactionRef);
      if (snap.exists()) {
        await remove(reactionRef);
      } else {
        await set(reactionRef, true);
      }
    } catch {
      // Silently fail for reactions
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!user || !isAdmin) return;
    try {
      await remove(ref(db, `chatPosts/${postId}`));
      toast.success(t("admin2.deleted"));
    } catch {
      toast.error(t("common.error"));
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
        <div className="w-10 h-10 rounded-2xl bg-[#E8F5E9] dark:bg-green-900/30 flex items-center justify-center">
          <MessageCircle className="w-5 h-5 text-[#1B7A3D]" />
        </div>
        <div>
          <h2 className="text-lg font-black text-gray-900 dark:text-white">{t("chat.title")}</h2>
          <p className="text-[10px] text-gray-400 dark:text-slate-500">{t("chat.subtitle")}</p>
        </div>
      </div>

      {/* Admin Post Form */}
      {isAdmin && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl card-shadow p-4 border border-gray-100/50 dark:border-slate-700/50">
          <div className="flex gap-2">
            <Input
              value={newPost}
              onChange={(e) => setNewPost(e.target.value)}
              placeholder={t("chat.writePost")}
              className="bg-gray-50 border-gray-200 rounded-xl text-sm"
              onKeyDown={(e) => { if (e.key === "Enter" && !isSending) handlePost(); }}
            />
            <Button
              onClick={handlePost}
              disabled={isSending || !newPost.trim()}
              className="bg-gradient-to-l from-[#1B7A3D] to-[#22A24D] text-white font-bold rounded-xl px-4 btn-green-shadow"
            >
              {isSending ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Posts List */}
      <div className="space-y-3">
        {posts.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 rounded-2xl card-shadow p-8 text-center">
            <MessageCircle className="w-12 h-12 text-gray-200 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-gray-400 dark:text-slate-500 text-sm font-bold">{t("chat.noPosts")}</p>
          </div>
        ) : (
          posts.map((post, i) => (
            <motion.div
              key={post.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="bg-white dark:bg-slate-800 rounded-2xl card-shadow p-4 border border-gray-100/50 dark:border-slate-700/50"
            >
              {/* Post Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  {post.authorPhoto ? (
                    <img src={post.authorPhoto} alt={post.authorName} className="w-9 h-9 rounded-full object-cover" />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#1B7A3D] to-[#22A24D] flex items-center justify-center">
                      <span className="text-white font-bold text-sm">{(post.authorName || "A")[0].toUpperCase()}</span>
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-bold text-gray-900 dark:text-white">{post.authorName}</p>
                    <p className="text-[10px] text-gray-400 dark:text-slate-500">
                      {new Date(post.createdAt).toLocaleDateString(isRTL ? "ar-YE" : "en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
                {isAdmin && (
                  <button
                    onClick={() => handleDeletePost(post.id)}
                    className="text-gray-300 hover:text-red-500 transition-colors text-xs"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Post Content */}
              <p className="text-sm text-gray-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap mb-3">{post.content}</p>

              {/* Reactions */}
              <div className="flex gap-1.5 flex-wrap">
                {REACTIONS.map((reaction) => {
                  const reactionUsers = post.reactions?.[reaction.key] || {};
                  const count = Object.keys(reactionUsers).length;
                  const hasReacted = user ? !!reactionUsers[user.uid] : false;
                  return (
                    <motion.button
                      key={reaction.key}
                      whileTap={{ scale: 0.85 }}
                      onClick={() => handleReaction(post.id, reaction.key)}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold transition-all ${
                        hasReacted
                          ? "bg-[#E8F5E9] dark:bg-green-900/30 text-[#1B7A3D] border border-[#1B7A3D]/20"
                          : "bg-gray-50 dark:bg-slate-700 text-gray-500 dark:text-slate-400 border border-gray-100 dark:border-slate-600"
                      }`}
                    >
                      <span className="text-sm">{reaction.emoji}</span>
                      {count > 0 && <span>{count}</span>}
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          ))
        )}
      </div>
    </motion.div>
  );
}
