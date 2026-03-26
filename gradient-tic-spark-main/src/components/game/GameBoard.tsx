import { motion } from "framer-motion";
import { GameTile } from "./GameTile";
import { useGameStore } from "@/store/gameStore";

export const GameBoard = () => {
  const { board, moveBoard, winningLine, currentTurn, playerMark, status } = useGameStore();
  const disabled = status !== "playing" || currentTurn !== playerMark;

  return (
    <motion.div
      className="relative"
      initial={{ scale: 0.88, opacity: 0, rotate: -2 }}
      animate={{ scale: 1, opacity: 1, rotate: 0 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Subtle glow behind board */}
      <motion.div
        className="absolute -inset-6 rounded-3xl blur-2xl pointer-events-none"
        style={{ background: "radial-gradient(circle, hsl(var(--primary) / 0.08) 0%, transparent 70%)" }}
        animate={{ opacity: [0.15, 0.3, 0.15] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      />

      <div className="grid grid-cols-3 gap-1.5 sm:gap-2 w-[220px] sm:w-[260px] mx-auto relative z-10 glass-card p-3 sm:p-4">
        {board.map((cell, i) => (
          <GameTile
            key={i}
            index={i}
            value={cell}
            onClick={() => moveBoard(i)}
            isWinning={winningLine?.includes(i) ?? false}
            disabled={disabled}
          />
        ))}
      </div>
    </motion.div>
  );
};
