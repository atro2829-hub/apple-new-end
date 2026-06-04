import { db } from "@/lib/firebase";
import { ref, get, update, remove } from "firebase/database";

// ---------------------------------------------------------------------------
// Time thresholds in milliseconds
// ---------------------------------------------------------------------------
const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
const NINETY_DAYS = 90 * 24 * 60 * 60 * 1000;
const ONE_EIGHTY_DAYS = 180 * 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isOlderThan(timestamp: number | null | undefined, thresholdMs: number): boolean {
  if (!timestamp) return false;
  return Date.now() - timestamp > thresholdMs;
}

// ---------------------------------------------------------------------------
// 1. Cleanup old sold cards
//    Cards are stored flat at: cards/{cardId}
//    - 30+ days used: strip `code` & `usedBy` (keep price/tier/network/date)
//    - 180+ days used: completely remove the card record
// ---------------------------------------------------------------------------
export async function cleanupOldCards(): Promise<{
  cardsCleaned: number;
  cardsRemoved: number;
}> {
  let cardsCleaned = 0;
  let cardsRemoved = 0;

  try {
    const cardsRef = ref(db, "cards");
    const snapshot = await get(cardsRef);

    if (!snapshot.exists()) {
      return { cardsCleaned, cardsRemoved };
    }

    const cards = snapshot.val() as Record<string, Record<string, unknown>> | null;
    if (!cards) return { cardsCleaned, cardsRemoved };

    for (const [cardId, cardData] of Object.entries(cards)) {
      if (!cardData || typeof cardData !== "object") continue;

      const isUsed = (cardData as Record<string, unknown>).isUsed === true;
      const usedAt = (cardData as Record<string, unknown>).usedAt as number | null | undefined;

      // Only touch cards that are sold
      if (!isUsed) continue;

      // 180+ days old → remove entirely
      if (isOlderThan(usedAt, ONE_EIGHTY_DAYS)) {
        const cardPath = `cards/${cardId}`;
        await remove(ref(db, cardPath));
        cardsRemoved++;
        continue;
      }

      // 30+ days old → strip code & usedBy
      if (isOlderThan(usedAt, THIRTY_DAYS)) {
        const data = cardData as Record<string, unknown>;

        // Only update if there's actually a code field to remove
        if (data.code !== undefined || data.usedBy !== undefined) {
          const cardPath = `cards/${cardId}`;
          const updates: Record<string, null> = {};

          if (data.code !== undefined) updates["code"] = null;
          if (data.usedBy !== undefined) updates["usedBy"] = null;

          await update(ref(db, cardPath), updates);
          cardsCleaned++;
        }
      }
    }
  } catch (error) {
    console.error("[cleanup] Error cleaning up old cards:", error);
  }

  return { cardsCleaned, cardsRemoved };
}

// ---------------------------------------------------------------------------
// 2. Cleanup old credit history entries
//    History is stored at: credit/{uid}/history/{entryId}
//    - 90+ days: remove `description` field (keep amount/type/date)
// ---------------------------------------------------------------------------
export async function cleanupOldHistory(): Promise<{
  entriesCleaned: number;
}> {
  let entriesCleaned = 0;

  try {
    const creditRef = ref(db, "credit");
    const snapshot = await get(creditRef);

    if (!snapshot.exists()) {
      return { entriesCleaned };
    }

    const userBuckets = snapshot.val() as Record<string, Record<string, unknown>> | null;
    if (!userBuckets) return { entriesCleaned };

    // credit/{uid}/history/{entryId}
    for (const [uid, userData] of Object.entries(userBuckets)) {
      if (!userData || typeof userData !== "object") continue;

      const history = (userData as Record<string, unknown>).history as Record<string, Record<string, unknown>> | null | undefined;
      if (!history || typeof history !== "object") continue;

      for (const [entryId, entryData] of Object.entries(history)) {
        if (!entryData || typeof entryData !== "object") continue;

        const date = (entryData as Record<string, unknown>).date as number | null | undefined;

        if (isOlderThan(date, NINETY_DAYS)) {
          const data = entryData as Record<string, unknown>;

          // Only update if there's a description field to remove
          if (data.description !== undefined) {
            const entryPath = `credit/${uid}/history/${entryId}`;
            await update(ref(db, entryPath), { description: null });
            entriesCleaned++;
          }
        }
      }
    }
  } catch (error) {
    console.error("[cleanup] Error cleaning up old history:", error);
  }

  return { entriesCleaned };
}

// ---------------------------------------------------------------------------
// 3. Cleanup old commission entries that are already paid
//    Commissions are stored at: commissionEntries/{entryId}
//    - 90+ days paid: remove cardId & cardTier (keep financial summary)
// ---------------------------------------------------------------------------
export async function cleanupOldCommissions(): Promise<{
  entriesCleaned: number;
}> {
  let entriesCleaned = 0;

  try {
    const commissionsRef = ref(db, "commissionEntries");
    const snapshot = await get(commissionsRef);

    if (!snapshot.exists()) {
      return { entriesCleaned };
    }

    const entries = snapshot.val() as Record<string, Record<string, unknown>> | null;
    if (!entries) return { entriesCleaned };

    for (const [entryId, entryData] of Object.entries(entries)) {
      if (!entryData || typeof entryData !== "object") continue;

      const entry = entryData as Record<string, unknown>;
      const isPaid = entry.isPaid === true;
      const paidAt = entry.paidAt as number | null | undefined;

      if (isPaid && isOlderThan(paidAt, NINETY_DAYS)) {
        const updates: Record<string, null> = {};
        if (entry.cardId !== undefined) updates["cardId"] = null;
        if (entry.cardTier !== undefined) updates["cardTier"] = null;

        if (Object.keys(updates).length > 0) {
          const entryPath = `commissionEntries/${entryId}`;
          await update(ref(db, entryPath), updates);
          entriesCleaned++;
        }
      }
    }
  } catch (error) {
    console.error("[cleanup] Error cleaning up old commissions:", error);
  }

  return { entriesCleaned };
}

// ---------------------------------------------------------------------------
// 4. Run all cleanup steps
// ---------------------------------------------------------------------------
export async function runFullCleanup(): Promise<{
  cardsCleaned: number;
  cardsRemoved: number;
  entriesCleaned: number;
  commissionsCleaned: number;
}> {
  const [cardResult, historyResult, commissionResult] = await Promise.all([
    cleanupOldCards(),
    cleanupOldHistory(),
    cleanupOldCommissions(),
  ]);

  return {
    cardsCleaned: cardResult.cardsCleaned,
    cardsRemoved: cardResult.cardsRemoved,
    entriesCleaned: historyResult.entriesCleaned,
    commissionsCleaned: commissionResult.entriesCleaned,
  };
}
