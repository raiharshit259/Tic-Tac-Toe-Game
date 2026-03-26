export type CellValue = "X" | "O" | null;

export type MatchPhase = "waiting" | "playing" | "finished";

export interface MoveRecord {
  index: number;
  mark: "X" | "O";
  userId: string;
  tick: number;
}

export interface PlayerSlot {
  userId: string;
  username: string;
  sessionId: string;
  mark: "X" | "O";
  connected: boolean;
}

export interface PublicMatchState {
  matchId: string;
  board: CellValue[];
  turn: "X" | "O";
  phase: MatchPhase;
  winner: "X" | "O" | "draw" | null;
  winLine: number[];
  moveRemainingMs: number | null;
  moves: MoveRecord[];
  players: Array<{
    userId: string;
    username: string;
    mark: "X" | "O";
    connected: boolean;
  }>;
}

export interface MatchStateEnvelope {
  type: "STATE";
  payload: PublicMatchState;
}

export interface MatchErrorEnvelope {
  type: "ERROR";
  payload: {
    code: string;
    message: string;
  };
}

export interface ClientMoveMessage {
  index: number;
}

export interface RpcOk<T> {
  ok: true;
  data: T;
}

export interface RpcError {
  ok: false;
  error: {
    code: string;
    message: string;
  };
}

export type RpcResponse<T> = RpcOk<T> | RpcError;

export interface CreateMatchRoomRequest {
  preferredMark?: "X" | "O";
}

export interface CreateMatchRoomResponse {
  matchId: string;
}

export interface JoinMatchRoomRequest {
  matchId: string;
}

export interface JoinMatchRoomResponse {
  matchId: string;
}

export interface FindMatchRequest {
  region?: string;
}

export interface FindMatchResponse {
  matchId: string;
}

export interface SubmitMoveRequest {
  matchId: string;
  index: number;
}

export interface SubmitMoveResponse {
  state: PublicMatchState;
}

export interface GetMatchStateRequest {
  matchId: string;
}

export interface GetMatchStateResponse {
  state: PublicMatchState;
}

export interface RematchRequest {
  matchId: string;
}

export interface RematchResponse {
  state: PublicMatchState;
}

export interface GetLeaderboardRequest {
  limit?: number;
}

export interface CreateMatchResponse {
  matchId: string;
}

export interface JoinMatchResponse {
  matchId: string;
}

export interface LeaderboardEntry {
  userId?: string;
  username: string;
  wins: number;
  losses: number;
  draws: number;
  winStreak?: number;
  score: number;
  rank: number;
}

export interface MatchHistoryEntry {
  matchId: string;
  player1Id: string;
  player2Id: string;
  winnerId: string | null;
  moves: MoveRecord[];
  createdAt: string;
}

export interface GetMatchHistoryRequest {
  limit?: number;
}

export interface GetMatchHistoryResponse {
  rows: MatchHistoryEntry[];
}

export const GAME_OP_CODE = {
  STATE: 1,
  MOVE: 2,
  ERROR: 3,
  PLAY_AGAIN: 4,
} as const;

export const GAME_CONSTANTS = {
  BOARD_SIZE: 9,
  TURN_SECONDS: 30,
  TICK_RATE: 2,
  LEADERBOARD_ID: "tic_tac_toe_ranked",
} as const;
