import { NextRequest, NextResponse } from "next/server";
import { runFullCleanup } from "@/lib/cleanup";

// ---------------------------------------------------------------------------
// Shared secret for authenticating cleanup requests.
// Falls back to a hardcoded value when the environment variable is absent.
// ---------------------------------------------------------------------------
const CLEANUP_SECRET = process.env.CLEANUP_SECRET_KEY || "applenet-cleanup-2025-secure";

export async function POST(request: NextRequest) {
  try {
    // ── Auth check via query parameter ────────────────────────────────────
    const { searchParams } = new URL(request.url);
    const providedKey = searchParams.get("key");

    if (!providedKey || providedKey !== CLEANUP_SECRET) {
      return NextResponse.json(
        { error: "Unauthorized. Provide a valid `key` query parameter." },
        { status: 401 }
      );
    }

    // ── Run full cleanup ─────────────────────────────────────────────────
    const startTime = Date.now();
    const result = await runFullCleanup();
    const durationMs = Date.now() - startTime;

    // ── Build summary response ───────────────────────────────────────────
    const summary = {
      success: true,
      durationMs,
      timestamp: new Date().toISOString(),
      cleanup: {
        cards: {
          codeStripped: result.cardsCleaned,
          fullyRemoved: result.cardsRemoved,
          description: [
            `${result.cardsCleaned} sold cards older than 30 days had code/usedBy fields removed.`,
            `${result.cardsRemoved} sold cards older than 180 days were completely removed.`,
          ].join(" "),
        },
        creditHistory: {
          descriptionsRemoved: result.entriesCleaned,
          description: `${result.entriesCleaned} credit history entries older than 90 days had their description field removed.`,
        },
        commissions: {
          detailsRemoved: result.commissionsCleaned,
          description: `${result.commissionsCleaned} paid commission entries older than 90 days had cardId/cardTier fields removed.`,
        },
      },
      totals: {
        itemsPartiallyCleaned: result.cardsCleaned + result.entriesCleaned + result.commissionsCleaned,
        itemsFullyRemoved: result.cardsRemoved,
      },
    };

    console.log("[cleanup] Completed:", JSON.stringify(result), `(${durationMs}ms)`);

    return NextResponse.json(summary);
  } catch (error) {
    console.error("[cleanup] Fatal error:", error);
    return NextResponse.json(
      { error: "Cleanup failed", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// Reject other methods
export async function GET() {
  return NextResponse.json(
    { error: "Method not allowed. Use POST with ?key=YOUR_SECRET" },
    { status: 405 }
  );
}
