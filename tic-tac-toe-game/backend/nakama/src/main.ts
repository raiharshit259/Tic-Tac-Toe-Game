import {
  matchInit as internalMatchInit,
  matchJoinAttempt as internalMatchJoinAttempt,
  matchJoin as internalMatchJoin,
  matchLeave as internalMatchLeave,
  matchLoop as internalMatchLoop,
  matchTerminate as internalMatchTerminate,
  matchSignal as internalMatchSignal,
} from "./match/matchHandler";
import {
  rpcCreateMatchRoom as internalRpcCreateMatchRoom,
  rpcFindMatch as internalRpcFindMatch,
  rpcGetLeaderboard as internalRpcGetLeaderboard,
  rpcGetMatchHistory as internalRpcGetMatchHistory,
  rpcGetMatchState as internalRpcGetMatchState,
  rpcJoinMatchRoom as internalRpcJoinMatchRoom,
  rpcRematchRequest as internalRpcRematchRequest,
  rpcSetUsername as internalRpcSetUsername,
  rpcSubmitMove as internalRpcSubmitMove,
} from "./controllers/rpcController";
import { ensureRuntimeSchema } from "./services/schemaService";
import type { MatchState } from "./types/matchTypes";

function matchInit(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  params: { players?: Array<{ userId: string; username: string }> },
): { state: MatchState; tickRate: number; label: string } {
  return internalMatchInit(ctx, logger, nk, params);
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
  return internalMatchJoinAttempt(ctx, logger, nk, dispatcher, tick, state, presence);
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
  return internalMatchJoin(ctx, logger, nk, dispatcher, tick, state, presences);
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
  return internalMatchLeave(ctx, logger, nk, dispatcher, tick, state, presences);
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
  return internalMatchLoop(ctx, logger, nk, dispatcher, tick, state, messages);
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
  return internalMatchTerminate(ctx, logger, nk, dispatcher, tick, state, graceSeconds);
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
  return internalMatchSignal(ctx, logger, nk, dispatcher, tick, state, data);
}

function rpcCreateMatchRoom(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, payload: string): string {
  return internalRpcCreateMatchRoom(ctx, logger, nk, payload);
}

function rpcJoinMatchRoom(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, payload: string): string {
  return internalRpcJoinMatchRoom(ctx, logger, nk, payload);
}

function rpcFindMatch(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, payload: string): string {
  return internalRpcFindMatch(ctx, logger, nk, payload);
}

function rpcSubmitMove(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, payload: string): string {
  return internalRpcSubmitMove(ctx, logger, nk, payload);
}

function rpcGetMatchState(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, payload: string): string {
  return internalRpcGetMatchState(ctx, logger, nk, payload);
}

function rpcRematchRequest(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, payload: string): string {
  return internalRpcRematchRequest(ctx, logger, nk, payload);
}

function rpcSetUsername(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, payload: string): string {
  return internalRpcSetUsername(ctx, logger, nk, payload);
}

function rpcGetLeaderboard(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, payload: string): string {
  return internalRpcGetLeaderboard(ctx, logger, nk, payload);
}

function rpcGetMatchHistory(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, payload: string): string {
  return internalRpcGetMatchHistory(ctx, logger, nk, payload);
}

const runtimeGlobal = globalThis as unknown as Record<string, unknown>;
runtimeGlobal.matchInit = matchInit;
runtimeGlobal.matchJoinAttempt = matchJoinAttempt;
runtimeGlobal.matchJoin = matchJoin;
runtimeGlobal.matchLeave = matchLeave;
runtimeGlobal.matchLoop = matchLoop;
runtimeGlobal.matchTerminate = matchTerminate;
runtimeGlobal.matchSignal = matchSignal;
runtimeGlobal.rpcCreateMatchRoom = rpcCreateMatchRoom;
runtimeGlobal.rpcJoinMatchRoom = rpcJoinMatchRoom;
runtimeGlobal.rpcFindMatch = rpcFindMatch;
runtimeGlobal.rpcSubmitMove = rpcSubmitMove;
runtimeGlobal.rpcGetMatchState = rpcGetMatchState;
runtimeGlobal.rpcRematchRequest = rpcRematchRequest;
runtimeGlobal.rpcSetUsername = rpcSetUsername;
runtimeGlobal.rpcGetLeaderboard = rpcGetLeaderboard;
runtimeGlobal.rpcGetMatchHistory = rpcGetMatchHistory;

function InitModule(
  _ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  initializer: nkruntime.Initializer,
): void {
  ensureRuntimeSchema(nk, logger);

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

runtimeGlobal.InitModule = InitModule;

export {
  matchInit,
  matchJoinAttempt,
  matchJoin,
  matchLeave,
  matchLoop,
  matchTerminate,
  matchSignal,
  rpcCreateMatchRoom,
  rpcJoinMatchRoom,
  rpcFindMatch,
  rpcSubmitMove,
  rpcGetMatchState,
  rpcRematchRequest,
  rpcSetUsername,
  rpcGetLeaderboard,
  rpcGetMatchHistory,
  InitModule,
};