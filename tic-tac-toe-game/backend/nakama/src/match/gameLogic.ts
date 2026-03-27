import type { CellValue, MatchState, PlayerSlot } from "../types/matchTypes";
import { TICK_RATE, TURN_SECONDS, WIN_LINES } from "../types/matchTypes";

export interface MoveResult {
  ok: boolean;
  code?: string;
  message?: string;
}

export function cloneEmptyBoard(): CellValue[] {
  return [null, null, null, null, null, null, null, null, null];
}

export function isBoardFull(board: CellValue[]): boolean {
  for (let i = 0; i < board.length; i += 1) {
    if (board[i] === null) {
      return false;
    }
  }
  return true;
}

export function detectWinner(board: CellValue[]): { winner: "X" | "O" | null; winLine: number[] } {
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

export function resetForRematch(state: MatchState, tick: number): void {
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

export function applyMove(
  logger: nkruntime.Logger,
  state: MatchState,
  player: PlayerSlot,
  index: number,
  tick: number,
  onFinish: () => void,
): MoveResult {
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
    onFinish();
    return { ok: true };
  }

  if (isBoardFull(state.board)) {
    state.phase = "finished";
    state.winner = "draw";
    state.winLine = [];
    state.moveDeadlineTick = null;
    onFinish();
    return { ok: true };
  }

  state.turn = state.turn === "X" ? "O" : "X";
  state.moveDeadlineTick = tick + TURN_SECONDS * TICK_RATE;
  return { ok: true };
}
