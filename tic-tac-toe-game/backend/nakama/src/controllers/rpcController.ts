import type { MoveRecord } from "../types/matchTypes";
import { MAX_HISTORY_ROWS } from "../types/matchTypes";
import { findOrCreateWaitingMatch } from "../services/matchmakingService";
import { persistProfile, syncAccountUsername } from "../services/playerService";
import { upsertWaitingMatchStub } from "../services/stateService";
import { decodeStateJsonValue, normalizeMatchId, parseRpcRequest, rpcFail, sanitizeUsername } from "../utils/runtime";

export function rpcCreateMatchRoom(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  payload: string,
): string {
  parseRpcRequest<{ preferredMark?: "X" | "O" }>(payload || "{}");
  const matchId = nk.matchCreate("tic_tac_toe", { allowBotFallback: false });
  upsertWaitingMatchStub(nk, matchId);
  logger.info("rpc=create_match_room user=%q match=%q", ctx.userId || "unknown", matchId);
  return JSON.stringify({ ok: true, data: { matchId } });
}

export function rpcJoinMatchRoom(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  payload: string,
): string {
  if (!payload) {
    return rpcFail("BAD_REQUEST", "Payload is required.");
  }

  const data = parseRpcRequest<{ matchId?: string }>(payload);
  const incoming = normalizeMatchId(data.matchId);
  if (!incoming) {
    return rpcFail("BAD_REQUEST", "matchId is required.");
  }

  let resolvedMatchId = incoming;
  if (!resolvedMatchId.includes(".")) {
    const rows = nk.sqlQuery(
      "SELECT match_id FROM active_matches WHERE split_part(match_id, '.', 1) = $1 LIMIT 1",
      [resolvedMatchId],
    );
    if (rows.length > 0) {
      resolvedMatchId = String(rows[0].match_id || resolvedMatchId);
    }
  }

  logger.info(
    "rpc=join_match_room user=%q incoming=%q resolved=%q",
    ctx.userId || "unknown",
    incoming,
    resolvedMatchId,
  );
  return JSON.stringify({ ok: true, data: { matchId: resolvedMatchId } });
}

export function rpcFindMatch(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  payload: string,
): string {
  const req = parseRpcRequest<{ botFallbackTimeoutSeconds?: number }>(payload || "{}");
  const matchId = findOrCreateWaitingMatch(ctx, logger, nk, {
    botFallbackTimeoutSeconds: req.botFallbackTimeoutSeconds,
  });
  return JSON.stringify({ ok: true, data: { matchId } });
}

export function rpcSubmitMove(
  ctx: nkruntime.Context,
  _logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  payload: string,
): string {
  if (!payload) {
    return rpcFail("BAD_REQUEST", "Payload is required.");
  }

  const data = parseRpcRequest<{ matchId?: string; index?: number }>(payload);
  if (!data.matchId || typeof data.index !== "number") {
    return rpcFail("BAD_REQUEST", "matchId and index are required.");
  }

  return nk.matchSignal(
    data.matchId,
    JSON.stringify({ action: "submit_move", userId: ctx.userId || "", index: data.index }),
  );
}

export function rpcGetMatchState(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  payload: string,
): string {
  if (!payload) {
    return rpcFail("BAD_REQUEST", "Payload is required.");
  }

  const data = parseRpcRequest<{ matchId?: string }>(payload);
  const incoming = normalizeMatchId(data.matchId);
  if (!incoming) {
    return rpcFail("BAD_REQUEST", "matchId is required.");
  }

  let resolvedMatchId = incoming;
  let rows = nk.sqlQuery("SELECT state_json FROM active_matches WHERE match_id = $1 LIMIT 1", [resolvedMatchId]);

  if (rows.length === 0 && !incoming.includes(".")) {
    rows = nk.sqlQuery(
      "SELECT state_json, match_id FROM active_matches WHERE split_part(match_id, '.', 1) = $1 LIMIT 1",
      [incoming],
    );
    if (rows.length > 0) {
      resolvedMatchId = String(rows[0].match_id || resolvedMatchId);
    }
  }

  if (rows.length === 0) {
    logger.info("rpc=get_match_state miss user=%q incoming=%q", ctx.userId || "unknown", incoming);
    return rpcFail("NOT_FOUND", "Match not found.");
  }

  const stateJson = decodeStateJsonValue(rows[0].state_json);
  if (!stateJson) {
    return rpcFail("STATE_ERROR", "Stored match state is invalid.");
  }

  let parsed: { payload?: unknown } | Record<string, unknown>;
  try {
    parsed = JSON.parse(stateJson) as { payload: unknown };
  } catch (_error) {
    return rpcFail("STATE_ERROR", "Stored match state could not be parsed.");
  }

  const statePayload = (parsed as { payload?: unknown }).payload ?? parsed;
  return JSON.stringify({ ok: true, data: { state: statePayload } });
}

export function rpcRematchRequest(
  ctx: nkruntime.Context,
  _logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  payload: string,
): string {
  if (!payload) {
    return rpcFail("BAD_REQUEST", "Payload is required.");
  }

  const data = parseRpcRequest<{ matchId?: string }>(payload);
  if (!data.matchId) {
    return rpcFail("BAD_REQUEST", "matchId is required.");
  }

  return nk.matchSignal(data.matchId, JSON.stringify({ action: "rematch_request", userId: ctx.userId || "" }));
}

export function rpcSetUsername(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  payload: string,
): string {
  const userId = ctx.userId || "";
  if (!userId) {
    return rpcFail("UNAUTHORIZED", "User context missing.");
  }

  const req = parseRpcRequest<{ username?: string }>(payload || "{}");
  const username = sanitizeUsername(req.username);
  if (!username) {
    return rpcFail("BAD_REQUEST", "username is required.");
  }

  syncAccountUsername(logger, nk, userId, username);
  persistProfile(nk, userId, username);
  return JSON.stringify({ ok: true, data: { username } });
}

export function rpcGetLeaderboard(
  _ctx: nkruntime.Context,
  _logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  payload: string,
): string {
  const req = parseRpcRequest<{ limit?: number }>(payload || "{}");
  const limit = req.limit && req.limit > 0 && req.limit <= 100 ? req.limit : 20;

  const rows = nk.sqlQuery(
    "SELECT ls.user_id, COALESCE(up.display_name, u.username, 'player') AS username, ls.wins, ls.losses, ls.draws, ls.win_streak, (ls.wins * 3 + ls.draws) AS score FROM leaderboard_stats ls LEFT JOIN users u ON u.id = ls.user_id LEFT JOIN user_profiles up ON up.user_id = ls.user_id ORDER BY score DESC, ls.win_streak DESC, ls.updated_at ASC LIMIT $1",
    [limit],
  );

  const data = rows.map((row, index) => ({
    userId: String(row.user_id || ""),
    username: String(row.username || "player"),
    wins: Number(row.wins || 0),
    losses: Number(row.losses || 0),
    draws: Number(row.draws || 0),
    winStreak: Number(row.win_streak || 0),
    score: Number(row.score || 0),
    rank: index + 1,
  }));

  return JSON.stringify({ ok: true, data });
}

export function rpcGetMatchHistory(
  ctx: nkruntime.Context,
  _logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  payload: string,
): string {
  const req = parseRpcRequest<{ limit?: number }>(payload || "{}");
  const limit = req.limit && req.limit > 0 && req.limit <= MAX_HISTORY_ROWS ? req.limit : 10;
  const userId = ctx.userId || "";

  if (!userId) {
    return rpcFail("UNAUTHORIZED", "User context missing.");
  }

  const rows = nk.sqlQuery(
    "SELECT match_id, player1_id, player2_id, winner_id, moves, created_at FROM match_history WHERE player1_id = $1::uuid OR player2_id = $1::uuid ORDER BY created_at DESC LIMIT $2",
    [userId, limit],
  );

  return JSON.stringify({
    ok: true,
    data: {
      rows: rows.map((row) => ({
        matchId: String(row.match_id || ""),
        player1Id: String(row.player1_id || ""),
        player2Id: String(row.player2_id || ""),
        winnerId: row.winner_id ? String(row.winner_id) : null,
        moves: (typeof row.moves === "string" ? JSON.parse(String(row.moves)) : row.moves) as MoveRecord[],
        createdAt: String(row.created_at || ""),
      })),
    },
  });
}

