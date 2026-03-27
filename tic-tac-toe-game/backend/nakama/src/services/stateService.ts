import { cloneEmptyBoard } from "../match/gameLogic";
import { GAME_OP_CODE, TICK_RATE, type MatchState } from "../types/matchTypes";

export function buildPublicState(state: MatchState, tick: number): string {
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

export function broadcastState(dispatcher: nkruntime.MatchDispatcher, state: MatchState, tick: number): void {
  dispatcher.broadcastMessage(GAME_OP_CODE.STATE, buildPublicState(state, tick), null, null, true);
}

export function sendError(
  dispatcher: nkruntime.MatchDispatcher,
  presence: nkruntime.Presence,
  code: string,
  message: string,
): void {
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

export function persistActiveMatch(nk: nkruntime.Nakama, state: MatchState, tick: number): void {
  const xUser = state.players.X ? state.players.X.userId : null;
  const oUser = state.players.O ? state.players.O.userId : null;
  nk.sqlExec(
    "INSERT INTO active_matches (match_id, player1_id, player2_id, phase, state_json, created_at, updated_at) VALUES ($1, $2::uuid, $3::uuid, $4, $5::jsonb, NOW(), NOW()) ON CONFLICT (match_id) DO UPDATE SET player1_id = EXCLUDED.player1_id, player2_id = EXCLUDED.player2_id, phase = EXCLUDED.phase, state_json = EXCLUDED.state_json, updated_at = NOW()",
    [state.matchId, xUser, oUser, state.phase, buildPublicState(state, tick)],
  );
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

export function upsertWaitingMatchStub(nk: nkruntime.Nakama, matchId: string): void {
  nk.sqlExec(
    "INSERT INTO active_matches (match_id, player1_id, player2_id, phase, state_json, created_at, updated_at) VALUES ($1, NULL, NULL, 'waiting', $2::jsonb, NOW(), NOW()) ON CONFLICT (match_id) DO UPDATE SET phase = 'waiting', state_json = EXCLUDED.state_json, updated_at = NOW()",
    [matchId, buildPlaceholderState(matchId)],
  );
}
