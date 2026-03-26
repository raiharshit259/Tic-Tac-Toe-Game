import { motion } from "framer-motion";
import type { PublicMatchState } from "../lib/sharedTypes";

interface BoardProps {
  state: PublicMatchState;
  userId: string | null;
  onMove: (index: number) => void;
}

function MarkGlyph({ value }: { value: "X" | "O" }) {
  if (value === "X") {
    return (
      <motion.svg
        viewBox="0 0 64 64"
        className="h-9 w-9"
        initial={{ scale: 0, rotate: -80, filter: "blur(6px)" }}
        animate={{ scale: 1, rotate: 0, filter: "blur(0px)" }}
        transition={{ type: "spring", stiffness: 260, damping: 18 }}
      >
        <motion.line
          x1="16"
          y1="16"
          x2="48"
          y2="48"
          stroke="hsl(var(--game-x))"
          strokeWidth="5"
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.2 }}
        />
        <motion.line
          x1="48"
          y1="16"
          x2="16"
          y2="48"
          stroke="hsl(var(--game-x))"
          strokeWidth="5"
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.2, delay: 0.06 }}
        />
      </motion.svg>
    );
  }

  return (
    <motion.svg
      viewBox="0 0 64 64"
      className="h-9 w-9"
      initial={{ scale: 0, filter: "blur(6px)" }}
      animate={{ scale: 1, filter: "blur(0px)" }}
      transition={{ type: "spring", stiffness: 260, damping: 18 }}
    >
      <motion.circle
        cx="32"
        cy="32"
        r="16"
        fill="none"
        stroke="hsl(var(--game-o))"
        strokeWidth="5"
        strokeLinecap="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.24 }}
      />
    </motion.svg>
  );
}

export function Board({ state, userId, onMove }: BoardProps) {
  const me = state.players.find((p) => p.userId === userId);
  const isMyTurn = state.phase === "playing" && !!me && me.mark === state.turn;

  return (
    <motion.div
      initial={{ scale: 0.92, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="relative"
    >
      <div className="absolute -inset-8 rounded-[2rem] bg-[radial-gradient(circle_at_center,rgba(0,186,164,0.12),transparent_60%)] blur-2xl" />
      <div className="relative grid w-[258px] grid-cols-3 gap-2 rounded-2xl border border-border/70 bg-card/75 p-3 backdrop-blur-xl sm:w-[288px]">
        {state.board.map((cell, index) => {
          const isWin = state.winLine.includes(index);
          const disabled = !isMyTurn || !!cell || state.phase !== "playing";

          return (
            <motion.button
              key={index}
              whileHover={!disabled ? { scale: 1.04 } : {}}
              whileTap={!disabled ? { scale: 0.95 } : {}}
              onClick={() => onMove(index)}
              className={[
                "aspect-square rounded-xl border border-border/70 bg-background/70",
                "flex items-center justify-center transition-all duration-200",
                isWin ? "shadow-[0_0_24px_-6px_rgba(255,194,38,0.65)] border-game-win/70" : "",
                disabled ? "cursor-default" : "cursor-pointer hover:border-primary/50",
              ].join(" ")}
            >
              {cell ? <MarkGlyph value={cell} /> : null}
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );
}
