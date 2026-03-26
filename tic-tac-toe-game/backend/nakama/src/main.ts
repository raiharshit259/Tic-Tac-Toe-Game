type CellValue = "X" | "O" | null;
type MatchPhase = "waiting" | "playing" | "finished";
type Winner = "X" | "O" | "draw" | null;

interface MoveRecord {
  index: number;
  mark: "X" | "O";
  userId: string;
  tick: number;
}

interface PlayerSlot {
  userId: string;
  username: string;
  sessionId: string;
  mark: "X" | "O";
  connected: boolean;
  readyForRematch: boolean;
}

interface MatchState {
  matchId: string;
  board: CellValue[];
  turn: "X" | "O";
  phase: MatchPhase;
  winner: Winner;
  winLine: number[];
  moves: MoveRecord[];
  players: Record<"X" | "O", PlayerSlot | null>;
  moveDeadlineTick: number | null;
}

interface MoveMessage {
  index: number;
}

interface RpcErrorResponse {
  ok: false;
  error: {
    code: string;
    message: string;
  };
}

const GAME_OP_CODE = {
  STATE: 1,
  MOVE: 2,
  ERROR: 3,
  PLAY_AGAIN: 4,
} as const;

const TURN_SECONDS = 30;
const TICK_RATE = 2;
const MAX_HISTORY_ROWS = 50;
const WIN_LINES: number[][] = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

function cloneEmptyBoard(): CellValue[] {
  return [null, null, null, null, null, null, null, null, null];
}

function parsePayload<T>(payload: string): T {
  return JSON.parse(payload) as T;
}

function rpcFail(code: string, message: string): string {
  const body: RpcErrorResponse = {
    ok: false,
    error: { code, message },
  };
  return JSON.stringify(body);
}

function isBoardFull(board: CellValue[]): boolean {
  for (let i = 0; i < board.length; i += 1) {
    if (board[i] === null) {
      return false;
    }
  }
  return true;
}

function detectWinner(board: CellValue[]): { winner: "X" | "O" | null; winLine: number[] } {
  for (let i = 0; i < WIN_LINES.length; i += 1) {
    const line = WIN_LINES[i];
    const a = line[0];
    const b = line[1];
    const c = line[2];
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { winner: board[a], winLine: line };
    }
  }
  return { winner: null, winLine: [] };
}

function findPlayerByUserId(state: MatchState, userId: string): PlayerSlot | null {
  if (state.players.X && state.players.X.userId === userId) {
    return state.players.X;
  }
  if (state.players.O && state.players.O.userId === userId) {
    return state.players.O;
  }
  return null;
}

function buildPublicState(state: MatchState, tick: number): string {
  const players = [] as Array<{
    userId: string;
    username: string;
    mark: "X" | "O";
    connected: boolean;
  }>;

  if (state.players.X) {
    players.push({
      userId: state.players.X.userId,
      username: state.players.X.username,
      mark: "X",
      connected: state.players.X.connected,
    });
  }
  if (state.players.O) {
    players.push({
      userId: state.players.O.userId,
      username: state.players.O.username,
      mark: "O",
      connected: state.players.O.connected,
    });
  }

  const moveRemainingMs =
    state.moveDeadlineTick === null
      ? null
      : Math.max((state.moveDeadlineTick - tick) * (1000 / TICK_RATE), 0);

  return JSON.stringify({
    type: "STATE",
    payload: {
      matchId: state.matchId,
      board: state.board,
      turn: state.turn,
      phase: state.phase,
      winner: state.winner,
      winLine: state.winLine,
      moveRemainingMs,
      moves: state.moves,
      players,
    },
  });
}

function broadcastState(dispatcher: nkruntime.MatchDispatcher, state: MatchState, tick: number): void {
  dispatcher.broadcastMessage(GAME_OP_CODE.STATE, buildPublicState(state, tick), null, null, true);
}

function sendError(dispatcher: nkruntime.MatchDispatcher, presence: nkruntime.Presence, code: string, message: string): void {
  dispatcher.broadcastMessage(
    GAME_OP_CODE.ERROR,
    JSON.stringify({
      type: "ERROR",
      payload: { code, message },
    }),
    [presence],
    null,
    true,
  );
}

function persistProfile(nk: nkruntime.Nakama, userId: string, username: string): void {
  nk.sqlExec(
    "INSERT INTO user_profiles (user_id, display_name) VALUES ($1::uuid, $2) ON CONFLICT (user_id) DO UPDATE SET display_name = EXCLUDED.display_name, updated_at = NOW()",
    [userId, username],
  );
}

function resolveDisplayName(nk: nkruntime.Nakama, userId: string, fallback: string): string {
  const rows = nk.sqlQuery(
    "SELECT COALESCE(up.display_name, u.username, $2) AS username FROM users u LEFT JOIN user_profiles up ON up.user_id = u.id WHERE u.id = $1::uuid LIMIT 1",
    [userId, fallback],
  );

  if (rows.length === 0) {
    return fallback;
  }

  const value = String(rows[0].username || "").trim();
  return value || fallback;
}

function persistActiveMatch(nk: nkruntime.Nakama, state: MatchState, tick: number): void {
  const xUser = state.players.X ? state.players.X.userId : null;
  const oUser = state.players.O ? state.players.O.userId : null;
  nk.sqlExec(
    "INSERT INTO active_matches (match_id, player1_id, player2_id, phase, state_json, created_at, updated_at) VALUES ($1, $2::uuid, $3::uuid, $4, $5::jsonb, NOW(), NOW()) ON CONFLICT (match_id) DO UPDATE SET player1_id = EXCLUDED.player1_id, player2_id = EXCLUDED.player2_id, phase = EXCLUDED.phase, state_json = EXCLUDED.state_json, updated_at = NOW()",
    [state.matchId, xUser, oUser, state.phase, buildPublicState(state, tick)],
  );
}

function finalizeLeaderStats(nk: nkruntime.Nakama, player: PlayerSlot, result: "win" | "loss" | "draw"): void {
  if (result === "win") {
    nk.sqlExec(
      "INSERT INTO leaderboard_stats (user_id, wins, losses, draws, win_streak, updated_at) VALUES ($1::uuid, 1, 0, 0, 1, NOW()) ON CONFLICT (user_id) DO UPDATE SET wins = leaderboard_stats.wins + 1, win_streak = leaderboard_stats.win_streak + 1, updated_at = NOW()",
      [player.userId],
    );
    return;
  }

  if (result === "loss") {
    nk.sqlExec(
      "INSERT INTO leaderboard_stats (user_id, wins, losses, draws, win_streak, updated_at) VALUES ($1::uuid, 0, 1, 0, 0, NOW()) ON CONFLICT (user_id) DO UPDATE SET losses = leaderboard_stats.losses + 1, win_streak = 0, updated_at = NOW()",
      [player.userId],
    );
    return;
  }

  nk.sqlExec(
    "INSERT INTO leaderboard_stats (user_id, wins, losses, draws, win_streak, updated_at) VALUES ($1::uuid, 0, 0, 1, 0, NOW()) ON CONFLICT (user_id) DO UPDATE SET draws = leaderboard_stats.draws + 1, win_streak = 0, updated_at = NOW()",
    [player.userId],
  );
}

function persistFinishedMatch(nk: nkruntime.Nakama, state: MatchState): void {
  if (!state.players.X || !state.players.O || state.phase !== "finished") {
    return;
  }

  const winnerId = state.winner === "X"
    ? state.players.X.userId
    : state.winner === "O"
      ? state.players.O.userId
      : null;

  nk.sqlExec(
    "INSERT INTO match_history (match_id, player1_id, player2_id, winner_id, moves, created_at) VALUES ($1, $2::uuid, $3::uuid, $4::uuid, $5::jsonb, NOW()) ON CONFLICT (match_id) DO NOTHING",
    [state.matchId, state.players.X.userId, state.players.O.userId, winnerId, JSON.stringify(state.moves)],
  );

  if (state.winner === "draw") {
    finalizeLeaderStats(nk, state.players.X, "draw");
    finalizeLeaderStats(nk, state.players.O, "draw");
  } else if (state.winner === "X") {
    finalizeLeaderStats(nk, state.players.X, "win");
    finalizeLeaderStats(nk, state.players.O, "loss");
  } else if (state.winner === "O") {
    finalizeLeaderStats(nk, state.players.O, "win");
    finalizeLeaderStats(nk, state.players.X, "loss");
  }
}

function resetForRematch(state: MatchState, tick: number): void {
  state.board = cloneEmptyBoard();
  state.turn = "X";
  state.phase = "playing";
  state.winner = null;
  state.winLine = [];
  state.moves = [];
  state.moveDeadlineTick = tick + TURN_SECONDS * TICK_RATE;
  if (state.players.X) {
    state.players.X.readyForRematch = false;
  }
  if (state.players.O) {
    state.players.O.readyForRematch = false;
  }
}

function applyMove(
  nk: nkruntime.Nakama,
  logger: nkruntime.Logger,
  state: MatchState,
  player: PlayerSlot,
  index: number,
  tick: number,
): { ok: boolean; code?: string; message?: string } {
  if (state.phase !== "playing") {
    return { ok: false, code: "INVALID_PHASE", message: "Match is not accepting moves." };
  }

  if (state.turn !== player.mark) {
    return { ok: false, code: "NOT_YOUR_TURN", message: "Wait for your turn." };
  }

  if (index < 0 || index > 8 || index % 1 !== 0) {
    return { ok: false, code: "BAD_MOVE", message: "Move index out of range." };
  }

  if (state.board[index] !== null) {
    return { ok: false, code: "BAD_MOVE", message: "Tile is already occupied." };
  }

  state.board[index] = player.mark;
  state.moves.push({ index, mark: player.mark, userId: player.userId, tick });
  logger.info("match=%q move user=%q mark=%q index=%q", state.matchId, player.userId, player.mark, String(index));

  const winnerResult = detectWinner(state.board);
  if (winnerResult.winner) {
    state.phase = "finished";
    state.winner = winnerResult.winner;
    state.winLine = winnerResult.winLine;
    state.moveDeadlineTick = null;
    persistFinishedMatch(nk, state);
    logger.info("match=%q finished winner=%q", state.matchId, state.winner || "none");
    return { ok: true };
  }

  if (isBoardFull(state.board)) {
    state.phase = "finished";
    state.winner = "draw";
    state.winLine = [];
    state.moveDeadlineTick = null;
    persistFinishedMatch(nk, state);
    logger.info("match=%q finished draw", state.matchId);
    return { ok: true };
  }

  state.turn = state.turn === "X" ? "O" : "X";
  state.moveDeadlineTick = tick + TURN_SECONDS * TICK_RATE;
  return { ok: true };
}

function parseMovePayload(nk: nkruntime.Nakama, msg: nkruntime.MatchMessage): MoveMessage | null {
  try {
    return JSON.parse(nk.binaryToString(msg.data)) as MoveMessage;
  } catch (_error) {
    return null;
  }
}

function handleSignal(
  nk: nkruntime.Nakama,
  logger: nkruntime.Logger,
  state: MatchState,
  tick: number,
  data: string,
): string {
  try {
    const payload = parsePayload<{
      action: "submit_move" | "rematch_request";
      userId: string;
      index?: number;
    }>(data);

    const player = findPlayerByUserId(state, payload.userId);
    if (!player) {
      return rpcFail("NOT_IN_MATCH", "User is not part of this match.");
    }

    if (payload.action === "submit_move") {
      if (typeof payload.index !== "number") {
        return rpcFail("BAD_PAYLOAD", "index is required.");
      }
      const result = applyMove(nk, logger, state, player, payload.index, tick);
      if (!result.ok) {
        return rpcFail(result.code || "MOVE_REJECTED", result.message || "Move rejected.");
      }
      persistActiveMatch(nk, state, tick);
      return JSON.stringify({ ok: true, data: { state: JSON.parse(buildPublicState(state, tick)).payload } });
    }

    if (payload.action === "rematch_request") {
      player.readyForRematch = true;
      if (state.players.X && state.players.O && state.players.X.readyForRematch && state.players.O.readyForRematch) {
        resetForRematch(state, tick);
        logger.info("match=%q rematch started", state.matchId);
      }
      persistActiveMatch(nk, state, tick);
      return JSON.stringify({ ok: true, data: { state: JSON.parse(buildPublicState(state, tick)).payload } });
    }

    return rpcFail("UNSUPPORTED_ACTION", "Unknown signal action.");
  } catch (error) {
    logger.warn("Signal handling failed: %q", String(error));
    return rpcFail("SIGNAL_ERROR", "Signal processing failed.");
  }
}

function matchInit(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  params: { players?: Array<{ userId: string; username: string }> },
): { state: MatchState; tickRate: number; label: string } {
  const state: MatchState = {
    matchId: ctx.matchId || "",
    board: cloneEmptyBoard(),
    turn: "X",
    phase: "waiting",
    winner: null,
    winLine: [],
    moves: [],
    players: { X: null, O: null },
    moveDeadlineTick: null,
  };

  if (params && params.players && params.players.length > 0) {
    state.players.X = {
      userId: params.players[0].userId,
      username: params.players[0].username,
      sessionId: "",
      mark: "X",
      connected: false,
      readyForRematch: false,
    };

    if (params.players.length > 1) {
      state.players.O = {
        userId: params.players[1].userId,
        username: params.players[1].username,
        sessionId: "",
        mark: "O",
        connected: false,
        readyForRematch: false,
      };
    }
  }

  return { state, tickRate: TICK_RATE, label: "tic_tac_toe" };
}

function matchJoinAttempt(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  dispatcher: nkruntime.MatchDispatcher,
  tick: number,
  state: MatchState,
  presence: nkruntime.Presence,
): { state: MatchState; accept: boolean; rejectMessage?: string } {
  const existing = findPlayerByUserId(state, presence.userId);
  if (existing) {
    return { state, accept: true };
  }

  if (!state.players.X || !state.players.O) {
    return { state, accept: true };
  }

  return { state, accept: false, rejectMessage: "Match is full." };
}

function matchJoin(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  dispatcher: nkruntime.MatchDispatcher,
  tick: number,
  state: MatchState,
  presences: nkruntime.Presence[],
): { state: MatchState } {
  const beforeX = state.players.X ? state.players.X.userId : "none";
  const beforeO = state.players.O ? state.players.O.userId : "none";
  const beforePhase = state.phase;

  for (let i = 0; i < presences.length; i += 1) {
    const presence = presences[i];
    const existing = findPlayerByUserId(state, presence.userId);
    const resolvedUsername = resolveDisplayName(nk, presence.userId, presence.username || "player");
    persistProfile(nk, presence.userId, resolvedUsername);
    logger.info("User joined: %q (userId=%q)", resolvedUsername, presence.userId);

    if (existing) {
      existing.sessionId = presence.sessionId;
      existing.username = resolvedUsername;
      existing.connected = true;
      logger.info("match=%q join reconnect user=%q mark=%q", state.matchId, presence.userId, existing.mark);
      continue;
    }

    if (!state.players.X) {
      state.players.X = {
        userId: presence.userId,
        username: resolvedUsername,
        sessionId: presence.sessionId,
        mark: "X",
        connected: true,
        readyForRematch: false,
      };
      logger.info("match=%q join assign user=%q mark=X", state.matchId, presence.userId);
      continue;
    }

    if (!state.players.O) {
      state.players.O = {
        userId: presence.userId,
        username: resolvedUsername,
        sessionId: presence.sessionId,
        mark: "O",
        connected: true,
        readyForRematch: false,
      };
      logger.info("match=%q join assign user=%q mark=O", state.matchId, presence.userId);
    }
  }

  if (state.players.X && state.players.O && state.phase === "waiting") {
    state.phase = "playing";
    state.moveDeadlineTick = tick + TURN_SECONDS * TICK_RATE;
    logger.info("match=%q phase_transition waiting->playing x=%q o=%q", state.matchId, state.players.X.userId, state.players.O.userId);
  }

  logger.info(
    "match=%q join count=%q before_phase=%q after_phase=%q before_x=%q before_o=%q after_x=%q after_o=%q",
    state.matchId,
    String(presences.length),
    beforePhase,
    state.phase,
    beforeX,
    beforeO,
    state.players.X ? state.players.X.userId : "none",
    state.players.O ? state.players.O.userId : "none",
  );
  persistActiveMatch(nk, state, tick);
  broadcastState(dispatcher, state, tick);
  return { state };
}

function matchLeave(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  dispatcher: nkruntime.MatchDispatcher,
  tick: number,
  state: MatchState,
  presences: nkruntime.Presence[],
): { state: MatchState } {
  for (let i = 0; i < presences.length; i += 1) {
    const leaving = findPlayerByUserId(state, presences[i].userId);
    if (leaving) {
      leaving.connected = false;
      leaving.sessionId = "";
    }
  }

  logger.info("match=%q leave count=%q", state.matchId, String(presences.length));
  persistActiveMatch(nk, state, tick);
  broadcastState(dispatcher, state, tick);
  return { state };
}

function matchLoop(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  dispatcher: nkruntime.MatchDispatcher,
  tick: number,
  state: MatchState,
  messages: nkruntime.MatchMessage[],
): { state: MatchState } | null {
  state.matchId = ctx.matchId || state.matchId;

  for (let i = 0; i < messages.length; i += 1) {
    const msg = messages[i];

    if (msg.opCode === GAME_OP_CODE.MOVE) {
      const player = findPlayerByUserId(state, msg.sender.userId);
      if (!player) {
        continue;
      }

      const parsedMove = parseMovePayload(nk, msg);
      if (!parsedMove || typeof parsedMove.index !== "number") {
        sendError(dispatcher, msg.sender, "BAD_PAYLOAD", "Move payload must contain an index.");
        continue;
      }

      const result = applyMove(nk, logger, state, player, parsedMove.index, tick);
      if (!result.ok) {
        sendError(dispatcher, msg.sender, result.code || "MOVE_REJECTED", result.message || "Move rejected.");
      }

      persistActiveMatch(nk, state, tick);
      broadcastState(dispatcher, state, tick);
      continue;
    }

    if (msg.opCode === GAME_OP_CODE.PLAY_AGAIN) {
      const player = findPlayerByUserId(state, msg.sender.userId);
      if (!player || state.phase !== "finished") {
        continue;
      }
      player.readyForRematch = true;

      if (state.players.X && state.players.O && state.players.X.readyForRematch && state.players.O.readyForRematch) {
        resetForRematch(state, tick);
      }

      persistActiveMatch(nk, state, tick);
      broadcastState(dispatcher, state, tick);
    }
  }

  if (state.phase === "playing" && state.moveDeadlineTick !== null && tick >= state.moveDeadlineTick) {
    state.phase = "finished";
    state.winner = state.turn === "X" ? "O" : "X";
    state.winLine = [];
    state.moveDeadlineTick = null;
    persistFinishedMatch(nk, state);
    logger.info("match=%q timeout winner=%q", state.matchId, state.winner || "none");
    persistActiveMatch(nk, state, tick);
    broadcastState(dispatcher, state, tick);
  }

  // Server-authoritative heartbeat: keep both clients in sync for timer/turn visuals.
  if (state.phase === "playing") {
    broadcastState(dispatcher, state, tick);
    if (tick % TICK_RATE === 0) {
      persistActiveMatch(nk, state, tick);
    }
  }

  const xMissing = !state.players.X || !state.players.X.connected;
  const oMissing = !state.players.O || !state.players.O.connected;
  if (state.phase === "waiting" && xMissing && oMissing && tick > TICK_RATE * 20) {
    nk.sqlExec("DELETE FROM active_matches WHERE match_id = $1", [state.matchId]);
    return null;
  }

  return { state };
}

function matchTerminate(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  dispatcher: nkruntime.MatchDispatcher,
  tick: number,
  state: MatchState,
  graceSeconds: number,
): { state: MatchState } {
  nk.sqlExec("DELETE FROM active_matches WHERE match_id = $1", [state.matchId]);
  logger.info("match=%q terminated grace=%q", state.matchId, String(graceSeconds));
  return { state };
}

function matchSignal(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  dispatcher: nkruntime.MatchDispatcher,
  tick: number,
  state: MatchState,
  data: string,
): { state: MatchState; data?: string } {
  const signalResult = handleSignal(nk, logger, state, tick, data);
  persistActiveMatch(nk, state, tick);
  broadcastState(dispatcher, state, tick);
  return { state, data: signalResult };
}

function parseRpcRequest<T>(rawPayload: string): T {
  if (!rawPayload || rawPayload === "{}") {
    return {} as T;
  }
  return JSON.parse(rawPayload) as T;
}

function normalizeMatchId(raw: string | undefined): string {
  return String(raw || "").trim();
}

function uint8ToUtf8(bytes: Uint8Array): string {
  if (typeof TextDecoder !== "undefined") {
    return new TextDecoder("utf-8").decode(bytes);
  }

  let out = "";
  for (let i = 0; i < bytes.length; i += 1) {
    out += String.fromCharCode(bytes[i]);
  }
  return out;
}

function decodeStateJsonValue(nk: nkruntime.Nakama, value: unknown): string | null {
  if (typeof value === "string") {
    return value;
  }

  if (value instanceof ArrayBuffer) {
    return uint8ToUtf8(new Uint8Array(value));
  }

  if (ArrayBuffer.isView(value)) {
    const view = value as ArrayBufferView;
    const start = view.byteOffset;
    const end = view.byteOffset + view.byteLength;
    return uint8ToUtf8(new Uint8Array(view.buffer.slice(start, end)));
  }

  if (Array.isArray(value)) {
    const bytes = new Uint8Array(value as number[]);
    return uint8ToUtf8(bytes);
  }

  if (value && typeof value === "object") {
    const maybeData = (value as { data?: unknown }).data;
    if (Array.isArray(maybeData)) {
      const bytes = new Uint8Array(maybeData as number[]);
      return uint8ToUtf8(bytes);
    }

    // Already a structured object (typical for jsonb adapters).
    return JSON.stringify(value);
  }

  return null;
}

function buildPlaceholderState(matchId: string): string {
  return JSON.stringify({
    type: "STATE",
    payload: {
      matchId,
      board: cloneEmptyBoard(),
      turn: "X",
      phase: "waiting",
      winner: null,
      winLine: [],
      moveRemainingMs: null,
      moves: [],
      players: [],
    },
  });
}

function upsertWaitingMatchStub(nk: nkruntime.Nakama, matchId: string): void {
  nk.sqlExec(
    "INSERT INTO active_matches (match_id, player1_id, player2_id, phase, state_json, created_at, updated_at) VALUES ($1, NULL, NULL, 'waiting', $2::jsonb, NOW(), NOW()) ON CONFLICT (match_id) DO UPDATE SET phase = 'waiting', state_json = EXCLUDED.state_json, updated_at = NOW()",
    [matchId, buildPlaceholderState(matchId)],
  );
}

function rpcCreateMatchRoom(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, payload: string): string {
  parseRpcRequest<{ preferredMark?: "X" | "O" }>(payload || "{}");
  const matchId = nk.matchCreate("tic_tac_toe", {});
  upsertWaitingMatchStub(nk, matchId);
  logger.info("rpc=create_match_room user=%q match=%q", ctx.userId || "unknown", matchId);
  return JSON.stringify({ ok: true, data: { matchId } });
}

function rpcJoinMatchRoom(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, payload: string): string {
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

function rpcFindMatch(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama): string {
  // Serialize matchmaking selection/creation to avoid concurrent callers creating separate rooms.
  nk.sqlQuery("SELECT pg_advisory_lock($1)", [424242]);
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
          // Probe match process liveness; running matches return a JSON error payload (e.g. NOT_IN_MATCH).
          nk.matchSignal(matchId, JSON.stringify({ action: "submit_move", userId: "health-check", index: 0 }));
          logger.info("rpc=find_match user=%q reuse=%q", ctx.userId || "unknown", matchId);
          return JSON.stringify({ ok: true, data: { matchId } });
        } catch (_error) {
          logger.info("rpc=find_match stale=%q cleanup=true", matchId);
          nk.sqlExec("DELETE FROM active_matches WHERE match_id = $1", [matchId]);
        }
      }
    }

    const createdMatchId = nk.matchCreate("tic_tac_toe", {});
    upsertWaitingMatchStub(nk, createdMatchId);

    // Under advisory lock this select returns a single canonical waiting room for this moment.
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
    return JSON.stringify({ ok: true, data: { matchId: selectedMatchId } });
  } finally {
    nk.sqlQuery("SELECT pg_advisory_unlock($1)", [424242]);
  }
}

function rpcSubmitMove(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, payload: string): string {
  if (!payload) {
    return rpcFail("BAD_REQUEST", "Payload is required.");
  }

  const data = parseRpcRequest<{ matchId?: string; index?: number }>(payload);
  if (!data.matchId || typeof data.index !== "number") {
    return rpcFail("BAD_REQUEST", "matchId and index are required.");
  }

  const signalResult = nk.matchSignal(
    data.matchId,
    JSON.stringify({ action: "submit_move", userId: ctx.userId || "", index: data.index }),
  );
  return signalResult;
}

function rpcGetMatchState(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, payload: string): string {
  if (!payload) {
    return rpcFail("BAD_REQUEST", "Payload is required.");
  }

  const data = parseRpcRequest<{ matchId?: string }>(payload);
  const incoming = normalizeMatchId(data.matchId);
  if (!incoming) {
    return rpcFail("BAD_REQUEST", "matchId is required.");
  }

  let resolvedMatchId = incoming;
  logger.info("rpc=get_match_state user=%q incoming=%q", ctx.userId || "unknown", incoming);

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

  logger.info("rpc=get_match_state hit user=%q incoming=%q resolved=%q", ctx.userId || "unknown", incoming, resolvedMatchId);

  const stateValue = rows[0].state_json;
  const stateJson = decodeStateJsonValue(nk, stateValue);
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

function rpcRematchRequest(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, payload: string): string {
  if (!payload) {
    return rpcFail("BAD_REQUEST", "Payload is required.");
  }

  const data = parseRpcRequest<{ matchId?: string }>(payload);
  if (!data.matchId) {
    return rpcFail("BAD_REQUEST", "matchId is required.");
  }

  const signalResult = nk.matchSignal(
    data.matchId,
    JSON.stringify({ action: "rematch_request", userId: ctx.userId || "" }),
  );
  return signalResult;
}

function sanitizeUsername(username: string | undefined): string {
  return String(username || "").trim().slice(0, 24);
}

function rpcSetUsername(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, payload: string): string {
  const userId = ctx.userId || "";
  if (!userId) {
    return rpcFail("UNAUTHORIZED", "User context missing.");
  }

  const req = parseRpcRequest<{ username?: string }>(payload || "{}");
  const username = sanitizeUsername(req.username);
  if (!username) {
    return rpcFail("BAD_REQUEST", "username is required.");
  }

  // Keep Nakama account identity in sync with the chosen frontend username.
  try {
    const nkAny = nk as unknown as {
      accountUpdateId?: (
        userId: string,
        username?: string | null,
        displayName?: string | null,
        avatarUrl?: string | null,
        langTag?: string | null,
        location?: string | null,
        timezone?: string | null,
        metadata?: Record<string, unknown> | null,
      ) => void;
    };

    if (nkAny.accountUpdateId) {
      nkAny.accountUpdateId(userId, username, username, null, null, null, null, null);
    }
  } catch (error) {
    logger.warn("rpc=set_username accountUpdateId failed user=%q error=%q", userId, String(error));
  }

  persistProfile(nk, userId, username);
  return JSON.stringify({ ok: true, data: { username } });
}

function rpcGetLeaderboard(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, payload: string): string {
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

function rpcGetMatchHistory(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, payload: string): string {
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

function InitModule(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, initializer: nkruntime.Initializer): void {
  initializer.registerMatch("tic_tac_toe", {
    matchInit,
    matchJoinAttempt,
    matchJoin,
    matchLeave,
    matchLoop,
    matchTerminate,
    matchSignal,
  });

  initializer.registerRpc("create_match_room", rpcCreateMatchRoom);
  initializer.registerRpc("join_match_room", rpcJoinMatchRoom);
  initializer.registerRpc("find_match", rpcFindMatch);
  initializer.registerRpc("submit_move", rpcSubmitMove);
  initializer.registerRpc("get_match_state", rpcGetMatchState);
  initializer.registerRpc("rematch_request", rpcRematchRequest);
  initializer.registerRpc("set_username", rpcSetUsername);
  initializer.registerRpc("get_leaderboard", rpcGetLeaderboard);
  initializer.registerRpc("get_match_history", rpcGetMatchHistory);

  logger.info("Tic-tac-toe authoritative module loaded.");
}