import { applyMove, cloneEmptyBoard, detectWinner, resetForRematch } from "./gameLogic";
import { findPlayerByUserId, persistProfile, resolveUsernameFromAccount } from "../services/playerService";
import { persistFinishedMatch } from "../services/statsService";
import { broadcastState, buildPublicState, persistActiveMatch, sendError } from "../services/stateService";
import { parsePayload, rpcFail } from "../utils/runtime";
import {
  BOT_FALLBACK_TIMEOUT_SECONDS,
  BOT_MOVE_DELAY_TICKS,
  BOT_USER_ID,
  BOT_USERNAME,
  GAME_OP_CODE,
  TICK_RATE,
  TURN_SECONDS,
  type CellValue,
  type MatchState,
  type MoveMessage,
  type PlayerSlot,
} from "../types/matchTypes";

interface MatchInitParams {
  players?: Array<{ userId: string; username: string }>;
  allowBotFallback?: boolean;
  botFallbackTimeoutSeconds?: number;
}

function isBotPlayer(player: PlayerSlot | null): boolean {
  return !!player?.isBot;
}

function getCurrentTurnPlayer(state: MatchState): PlayerSlot | null {
  return state.turn === "X" ? state.players.X : state.players.O;
}

function getOpponentPlayer(state: MatchState, player: PlayerSlot): PlayerSlot | null {
  if (state.players.X && state.players.X.userId === player.userId) {
    return state.players.O;
  }
  if (state.players.O && state.players.O.userId === player.userId) {
    return state.players.X;
  }
  return null;
}

function connectedHumanCount(state: MatchState): number {
  let count = 0;
  if (state.players.X && !state.players.X.isBot && state.players.X.connected) {
    count += 1;
  }
  if (state.players.O && !state.players.O.isBot && state.players.O.connected) {
    count += 1;
  }
  return count;
}

function scheduleBotMoveIfNeeded(state: MatchState, tick: number): void {
  const current = getCurrentTurnPlayer(state);
  if (state.phase !== "playing" || !current || !current.isBot) {
    state.botMoveAtTick = null;
    return;
  }

  if (state.botMoveAtTick === null || state.botMoveAtTick < tick) {
    state.botMoveAtTick = tick + BOT_MOVE_DELAY_TICKS;
  }
}

function availableMoves(board: CellValue[]): number[] {
  const moves: number[] = [];
  for (let i = 0; i < board.length; i += 1) {
    if (board[i] === null) {
      moves.push(i);
    }
  }
  return moves;
}

function findWinningMove(board: CellValue[], mark: "X" | "O"): number | null {
  const moves = availableMoves(board);
  for (let i = 0; i < moves.length; i += 1) {
    const move = moves[i];
    const probe = board.slice();
    probe[move] = mark;
    const result = detectWinner(probe);
    if (result.winner === mark) {
      return move;
    }
  }
  return null;
}

function pickRandomMove(moves: number[]): number | null {
  if (moves.length === 0) {
    return null;
  }
  const index = Math.floor(Math.random() * moves.length);
  return moves[index];
}

function chooseBotMove(state: MatchState, botMark: "X" | "O"): number | null {
  const board = state.board;
  const open = availableMoves(board);
  if (open.length === 0) {
    return null;
  }

  const winning = findWinningMove(board, botMark);
  if (winning !== null) {
    return winning;
  }

  const opponentMark = botMark === "X" ? "O" : "X";
  const block = findWinningMove(board, opponentMark);
  if (block !== null) {
    return block;
  }

  if (board[4] === null) {
    return 4;
  }

  const corners = [0, 2, 6, 8].filter((index) => board[index] === null);
  const cornerPick = pickRandomMove(corners);
  if (cornerPick !== null) {
    return cornerPick;
  }

  return pickRandomMove(open);
}

function injectBotIfTimedOut(logger: nkruntime.Logger, state: MatchState, tick: number): boolean {
  if (!state.allowBotFallback || state.phase !== "waiting") {
    return false;
  }

  if (state.players.X && state.players.O) {
    state.waitingStartedTick = null;
    return false;
  }

  const humansWaiting = connectedHumanCount(state);
  if (humansWaiting !== 1) {
    state.waitingStartedTick = null;
    return false;
  }

  if (state.waitingStartedTick === null) {
    state.waitingStartedTick = tick;
    return false;
  }

  const timeoutTicks = state.botFallbackTimeoutSeconds * TICK_RATE;
  if (tick - state.waitingStartedTick < timeoutTicks) {
    return false;
  }

  if (!state.players.X) {
    state.players.X = {
      userId: BOT_USER_ID,
      username: BOT_USERNAME,
      sessionId: "bot",
      mark: "X",
      connected: true,
      readyForRematch: true,
      isBot: true,
    };
  } else if (!state.players.O) {
    state.players.O = {
      userId: BOT_USER_ID,
      username: BOT_USERNAME,
      sessionId: "bot",
      mark: "O",
      connected: true,
      readyForRematch: true,
      isBot: true,
    };
  } else {
    return false;
  }

  if (state.players.X && state.players.O) {
    state.phase = "playing";
    state.moveDeadlineTick = tick + TURN_SECONDS * TICK_RATE;
    state.waitingStartedTick = null;
    scheduleBotMoveIfNeeded(state, tick);
    logger.info("match=%q bot_fallback=enabled timeout_seconds=%q", state.matchId, String(state.botFallbackTimeoutSeconds));
    return true;
  }

  return false;
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

      if (isBotPlayer(player)) {
        return rpcFail("BAD_REQUEST", "Bot player cannot submit moves.");
      }

      const result = applyMove(logger, state, player, payload.index, tick, () => persistFinishedMatch(nk, state));
      if (!result.ok) {
        return rpcFail(result.code || "MOVE_REJECTED", result.message || "Move rejected.");
      }

      scheduleBotMoveIfNeeded(state, tick);

      persistActiveMatch(nk, state, tick);
      return JSON.stringify({ ok: true, data: { state: JSON.parse(buildPublicState(state, tick)).payload } });
    }

    if (payload.action === "rematch_request") {
      if (isBotPlayer(player)) {
        return rpcFail("BAD_REQUEST", "Bot player cannot request rematch.");
      }

      player.readyForRematch = true;
      const opponent = getOpponentPlayer(state, player);
      if (opponent?.isBot) {
        opponent.readyForRematch = true;
      }

      if (state.players.X && state.players.O && state.players.X.readyForRematch && state.players.O.readyForRematch) {
        resetForRematch(state, tick);
        scheduleBotMoveIfNeeded(state, tick);
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

export function matchInit(
  ctx: nkruntime.Context,
  _logger: nkruntime.Logger,
  _nk: nkruntime.Nakama,
  params: MatchInitParams,
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
    allowBotFallback: !!params?.allowBotFallback,
    botFallbackTimeoutSeconds:
      params && typeof params.botFallbackTimeoutSeconds === "number" && Number.isFinite(params.botFallbackTimeoutSeconds)
        ? Math.max(3, Math.floor(params.botFallbackTimeoutSeconds))
        : BOT_FALLBACK_TIMEOUT_SECONDS,
    waitingStartedTick: null,
    botMoveAtTick: null,
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

export function matchJoinAttempt(
  _ctx: nkruntime.Context,
  _logger: nkruntime.Logger,
  _nk: nkruntime.Nakama,
  _dispatcher: nkruntime.MatchDispatcher,
  _tick: number,
  state: MatchState,
  presence: nkruntime.Presence,
): { state: MatchState; accept: boolean; rejectMessage?: string } {
  const existing = findPlayerByUserId(state, presence.userId);
  if (existing || !state.players.X || !state.players.O) {
    return { state, accept: true };
  }

  return { state, accept: false, rejectMessage: "Match is full." };
}

export function matchJoin(
  _ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  dispatcher: nkruntime.MatchDispatcher,
  tick: number,
  state: MatchState,
  presences: nkruntime.Presence[],
): { state: MatchState } {
  for (let i = 0; i < presences.length; i += 1) {
    const presence = presences[i];
    const existing = findPlayerByUserId(state, presence.userId);
    const resolvedUsername = resolveUsernameFromAccount(nk, presence.userId, presence.username || "player");
    persistProfile(nk, presence.userId, resolvedUsername);

    if (existing) {
      existing.sessionId = presence.sessionId;
      existing.username = resolvedUsername;
      existing.connected = true;
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
    }
  }

  if (state.players.X && state.players.O && state.phase === "waiting") {
    state.phase = "playing";
    state.moveDeadlineTick = tick + TURN_SECONDS * TICK_RATE;
    state.waitingStartedTick = null;
    scheduleBotMoveIfNeeded(state, tick);
    logger.info("match=%q phase_transition waiting->playing", state.matchId);
  } else if (state.allowBotFallback) {
    const humansWaiting = connectedHumanCount(state);
    state.waitingStartedTick = humansWaiting === 1 ? state.waitingStartedTick ?? tick : null;
  }

  persistActiveMatch(nk, state, tick);
  broadcastState(dispatcher, state, tick);
  return { state };
}

export function matchLeave(
  _ctx: nkruntime.Context,
  _logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  dispatcher: nkruntime.MatchDispatcher,
  tick: number,
  state: MatchState,
  presences: nkruntime.Presence[],
): { state: MatchState } {
  for (let i = 0; i < presences.length; i += 1) {
    const leavingUserId = presences[i].userId;

    if (state.phase === "waiting") {
      if (state.players.X && state.players.X.userId === leavingUserId) {
        state.players.X = null;
      }
      if (state.players.O && state.players.O.userId === leavingUserId) {
        state.players.O = null;
      }
      continue;
    }

    const leaving = findPlayerByUserId(state, leavingUserId);
    if (leaving) {
      leaving.connected = false;
      leaving.sessionId = "";
    }
  }

  if (state.phase === "waiting" && state.allowBotFallback) {
    const humansWaiting = connectedHumanCount(state);
    state.waitingStartedTick = humansWaiting === 1 ? state.waitingStartedTick ?? tick : null;
  }

  persistActiveMatch(nk, state, tick);
  broadcastState(dispatcher, state, tick);
  return { state };
}

export function matchLoop(
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
    const player = findPlayerByUserId(state, msg.sender.userId);

    if (msg.opCode === GAME_OP_CODE.MOVE) {
      if (!player) {
        continue;
      }

      if (isBotPlayer(player)) {
        continue;
      }

      const parsedMove = parseMovePayload(nk, msg);
      if (!parsedMove || typeof parsedMove.index !== "number") {
        sendError(dispatcher, msg.sender, "BAD_PAYLOAD", "Move payload must contain an index.");
        continue;
      }

      const result = applyMove(logger, state, player, parsedMove.index, tick, () => persistFinishedMatch(nk, state));
      if (!result.ok) {
        sendError(dispatcher, msg.sender, result.code || "MOVE_REJECTED", result.message || "Move rejected.");
      }

      scheduleBotMoveIfNeeded(state, tick);

      persistActiveMatch(nk, state, tick);
      broadcastState(dispatcher, state, tick);
      continue;
    }

    if (msg.opCode === GAME_OP_CODE.PLAY_AGAIN) {
      if (!player || player.isBot || state.phase !== "finished") {
        continue;
      }
      player.readyForRematch = true;
      const opponent = getOpponentPlayer(state, player);
      if (opponent?.isBot) {
        opponent.readyForRematch = true;
      }
      if (state.players.X && state.players.O && state.players.X.readyForRematch && state.players.O.readyForRematch) {
        resetForRematch(state, tick);
        scheduleBotMoveIfNeeded(state, tick);
      }
      persistActiveMatch(nk, state, tick);
      broadcastState(dispatcher, state, tick);
    }
  }

  if (injectBotIfTimedOut(logger, state, tick)) {
    persistActiveMatch(nk, state, tick);
    broadcastState(dispatcher, state, tick);
  }

  if (state.phase === "playing") {
    const currentTurn = getCurrentTurnPlayer(state);
    if (currentTurn?.isBot && state.botMoveAtTick !== null && tick >= state.botMoveAtTick) {
      const chosenMove = chooseBotMove(state, currentTurn.mark);
      if (chosenMove !== null) {
        const move = applyMove(logger, state, currentTurn, chosenMove, tick, () => persistFinishedMatch(nk, state));
        if (move.ok) {
          scheduleBotMoveIfNeeded(state, tick);
          persistActiveMatch(nk, state, tick);
          broadcastState(dispatcher, state, tick);
        }
      } else {
        state.botMoveAtTick = null;
      }
    }
  }

  if (state.phase === "playing" && state.moveDeadlineTick !== null && tick >= state.moveDeadlineTick) {
    state.phase = "finished";
    state.winner = state.turn === "X" ? "O" : "X";
    state.winLine = [];
    state.moveDeadlineTick = null;
    state.botMoveAtTick = null;
    persistFinishedMatch(nk, state);
    persistActiveMatch(nk, state, tick);
    broadcastState(dispatcher, state, tick);
  }

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

export function matchTerminate(
  _ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  _dispatcher: nkruntime.MatchDispatcher,
  _tick: number,
  state: MatchState,
  graceSeconds: number,
): { state: MatchState } {
  nk.sqlExec("DELETE FROM active_matches WHERE match_id = $1", [state.matchId]);
  logger.info("match=%q terminated grace=%q", state.matchId, String(graceSeconds));
  return { state };
}

export function matchSignal(
  _ctx: nkruntime.Context,
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
