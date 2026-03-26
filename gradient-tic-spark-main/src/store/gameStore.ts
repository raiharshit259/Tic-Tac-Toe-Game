import { create } from "zustand";

export type Mark = "X" | "O" | null;
export type GameStatus = "idle" | "matchmaking" | "playing" | "finished";
export type GameResult = "win" | "lose" | "draw" | null;

interface Player {
  name: string;
  avatar: string;
  rank?: number;
}

interface GameState {
  board: Mark[];
  currentTurn: Mark;
  status: GameStatus;
  result: GameResult;
  winningLine: number[] | null;
  playerMark: Mark;
  player: Player;
  opponent: Player | null;
  timer: number;
  moveBoard: (index: number) => void;
  startMatchmaking: () => void;
  foundOpponent: (opponent: Player) => void;
  resetGame: () => void;
  cancelMatchmaking: () => void;
  playAgain: () => void;
  exitGame: () => void;
}

const WINNING_COMBOS = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

function checkWinner(board: Mark[]): { winner: Mark; line: number[] | null } {
  for (const combo of WINNING_COMBOS) {
    const [a, b, c] = combo;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { winner: board[a], line: combo };
    }
  }
  return { winner: null, line: null };
}

const MOCK_OPPONENTS: Player[] = [
  { name: "Aria Chen", avatar: "AC", rank: 12 },
  { name: "Marcus Webb", avatar: "MW", rank: 34 },
  { name: "Lena Kowalski", avatar: "LK", rank: 7 },
  { name: "Jay Patel", avatar: "JP", rank: 21 },
];

export const useGameStore = create<GameState>((set, get) => ({
  board: Array(9).fill(null),
  currentTurn: "X",
  status: "idle",
  result: null,
  winningLine: null,
  playerMark: "X",
  player: { name: "You", avatar: "YO", rank: 15 },
  opponent: null,
  timer: 30,

  moveBoard: (index: number) => {
    const { board, currentTurn, status, playerMark } = get();
    if (status !== "playing" || board[index] || currentTurn !== playerMark) return;

    const newBoard = [...board];
    newBoard[index] = currentTurn;
    const { winner, line } = checkWinner(newBoard);
    const isDraw = !winner && newBoard.every(Boolean);

    if (winner) {
      set({
        board: newBoard,
        winningLine: line,
        status: "finished",
        result: winner === playerMark ? "win" : "lose",
      });
      return;
    }

    if (isDraw) {
      set({ board: newBoard, status: "finished", result: "draw" });
      return;
    }

    set({ board: newBoard, currentTurn: currentTurn === "X" ? "O" : "X" });

    // Simulate opponent move after delay
    setTimeout(() => {
      const state = get();
      if (state.status !== "playing") return;
      const empty = state.board.map((v, i) => (v === null ? i : -1)).filter((i) => i !== -1);
      if (empty.length === 0) return;
      const opponentMove = empty[Math.floor(Math.random() * empty.length)];
      const nb = [...state.board];
      nb[opponentMove] = state.currentTurn;
      const res = checkWinner(nb);
      const draw = !res.winner && nb.every(Boolean);
      if (res.winner) {
        set({
          board: nb,
          winningLine: res.line,
          status: "finished",
          result: res.winner === state.playerMark ? "win" : "lose",
        });
      } else if (draw) {
        set({ board: nb, status: "finished", result: "draw" });
      } else {
        set({ board: nb, currentTurn: state.currentTurn === "X" ? "O" : "X" });
      }
    }, 600 + Math.random() * 800);
  },

  startMatchmaking: () => {
    set({ status: "matchmaking" });
    setTimeout(() => {
      const opp = MOCK_OPPONENTS[Math.floor(Math.random() * MOCK_OPPONENTS.length)];
      get().foundOpponent(opp);
    }, 2000 + Math.random() * 1500);
  },

  foundOpponent: (opponent) => {
    set({
      opponent,
      status: "playing",
      board: Array(9).fill(null),
      currentTurn: "X",
      playerMark: "X",
      result: null,
      winningLine: null,
      timer: 30,
    });
  },

  resetGame: () => {
    set({
      board: Array(9).fill(null),
      currentTurn: "X",
      status: "idle",
      result: null,
      winningLine: null,
      opponent: null,
      timer: 30,
    });
  },

  cancelMatchmaking: () => set({ status: "idle" }),

  playAgain: () => {
    const { opponent } = get();
    set({
      board: Array(9).fill(null),
      currentTurn: "X",
      status: "playing",
      result: null,
      winningLine: null,
      timer: 30,
      playerMark: get().playerMark === "X" ? "O" : "X",
    });
    if (get().playerMark !== "X") {
      // opponent goes first
      setTimeout(() => {
        const state = get();
        if (state.status !== "playing") return;
        const empty = state.board.map((v, i) => (v === null ? i : -1)).filter((i) => i !== -1);
        const move = empty[Math.floor(Math.random() * empty.length)];
        const nb = [...state.board];
        nb[move] = "X";
        set({ board: nb, currentTurn: "O" });
      }, 500);
    }
  },

  exitGame: () => {
    set({
      board: Array(9).fill(null),
      currentTurn: "X",
      status: "idle",
      result: null,
      winningLine: null,
      opponent: null,
      timer: 30,
    });
  },
}));
