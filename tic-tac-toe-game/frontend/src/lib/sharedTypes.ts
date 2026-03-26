export type CellValue = "X" | "O" | null;

export type MatchPhase = "waiting" | "playing" | "finished";

export interface MoveRecord {
  index: number;
  mark: "X" | "O";
  userId: string;
  tick: number;
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

export interface GetMatchHistoryResponse {
  rows: MatchHistoryEntry[];
}

export const GAME_OP_CODE = {
  STATE: 1,
  MOVE: 2,
  ERROR: 3,
  PLAY_AGAIN: 4,
} as const;
