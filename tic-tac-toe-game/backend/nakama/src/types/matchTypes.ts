export type CellValue = "X" | "O" | null;
export type MatchPhase = "waiting" | "playing" | "finished";
export type Winner = "X" | "O" | "draw" | null;

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
  readyForRematch: boolean;
  isBot?: boolean;
}

export interface MatchState {
  matchId: string;
  board: CellValue[];
  turn: "X" | "O";
  phase: MatchPhase;
  winner: Winner;
  winLine: number[];
  moves: MoveRecord[];
  players: Record<"X" | "O", PlayerSlot | null>;
  moveDeadlineTick: number | null;
  allowBotFallback: boolean;
  botFallbackTimeoutSeconds: number;
  waitingStartedTick: number | null;
  botMoveAtTick: number | null;
}

export interface MoveMessage {
  index: number;
}

export interface RpcErrorResponse {
  ok: false;
  error: {
    code: string;
    message: string;
  };
}

export const GAME_OP_CODE = {
  STATE: 1,
  MOVE: 2,
  ERROR: 3,
  PLAY_AGAIN: 4,
} as const;

export const WIN_LINES: number[][] = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

export const MAX_HISTORY_ROWS = 50;

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    return fallback;
  }
  return Math.floor(value);
}

function readRuntimePositiveInt(name: string, fallback: number): number {
  try {
    if (typeof process === "undefined") {
      return fallback;
    }
    return parsePositiveInt(process.env?.[name], fallback);
  } catch (_error) {
    return fallback;
  }
}

export const isTestMode = (): boolean => {
  try {
    return (
      (typeof process !== "undefined" && process.env?.NODE_ENV === "test") ||
      (typeof process !== "undefined" && process.env?.NAKAMA_TEST_MODE === "true")
    );
  } catch (_error) {
    return false;
  }
};

export const TICK_RATE = 2;
export const TURN_SECONDS = isTestMode() ? 3 : 30;
export const BOT_FALLBACK_TIMEOUT_SECONDS = readRuntimePositiveInt("NAKAMA_BOT_MATCH_TIMEOUT_SECONDS", 30);
export const BOT_MOVE_DELAY_TICKS = readRuntimePositiveInt("NAKAMA_BOT_MOVE_DELAY_TICKS", 1);
export const BOT_FALLBACK_TIMEOUT_MIN_SECONDS = 3;
export const BOT_USER_ID = "00000000-0000-0000-0000-000000000001";
export const BOT_USERNAME = "Nakama Bot";
