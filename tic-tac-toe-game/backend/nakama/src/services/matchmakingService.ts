import { upsertWaitingMatchStub } from "./stateService";
import { BOT_FALLBACK_TIMEOUT_SECONDS, BOT_FALLBACK_TIMEOUT_MIN_SECONDS } from "../types/matchTypes";

const MATCHMAKING_LOCK_ID = 424242;

interface MatchmakingOptions {
  botFallbackTimeoutSeconds?: number;
}

function resolveFallbackTimeoutSeconds(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return BOT_FALLBACK_TIMEOUT_SECONDS;
  }

  const normalized = Math.floor(value);
  return normalized >= BOT_FALLBACK_TIMEOUT_MIN_SECONDS ? normalized : BOT_FALLBACK_TIMEOUT_SECONDS;
}

export function findOrCreateWaitingMatch(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  options?: MatchmakingOptions,
): string {
  const botFallbackTimeoutSeconds = resolveFallbackTimeoutSeconds(options?.botFallbackTimeoutSeconds);

  nk.sqlQuery("SELECT pg_advisory_lock($1)", [MATCHMAKING_LOCK_ID]);
  try {
    let rows = nk.sqlQuery(
      "SELECT match_id FROM active_matches WHERE phase = 'waiting' AND (player1_id IS NULL OR player2_id IS NULL) ORDER BY created_at ASC LIMIT 10",
      [],
    );

    if (rows.length > 0) {
      for (let i = 0; i < rows.length; i += 1) {
        const matchId = String(rows[i].match_id || "");
        if (!matchId) {
          continue;
        }

        try {
          nk.matchSignal(matchId, JSON.stringify({ action: "submit_move", userId: "health-check", index: 0 }));
          logger.info("rpc=find_match user=%q reuse=%q", ctx.userId || "unknown", matchId);
          return matchId;
        } catch (_error) {
          logger.info("rpc=find_match stale=%q cleanup=true", matchId);
          nk.sqlExec("DELETE FROM active_matches WHERE match_id = $1", [matchId]);
        }
      }
    }

    const createdMatchId = nk.matchCreate("tic_tac_toe", {
      allowBotFallback: true,
      botFallbackTimeoutSeconds,
    });
    upsertWaitingMatchStub(nk, createdMatchId);

    rows = nk.sqlQuery(
      "SELECT match_id FROM active_matches WHERE phase = 'waiting' AND (player1_id IS NULL OR player2_id IS NULL) ORDER BY created_at ASC LIMIT 1",
      [],
    );

    const selectedMatchId = rows.length > 0 ? String(rows[0].match_id || createdMatchId) : createdMatchId;
    logger.info(
      "rpc=find_match user=%q create=%q selected=%q",
      ctx.userId || "unknown",
      createdMatchId,
      selectedMatchId,
    );
    return selectedMatchId;
  } finally {
    nk.sqlQuery("SELECT pg_advisory_unlock($1)", [MATCHMAKING_LOCK_ID]);
  }
}
