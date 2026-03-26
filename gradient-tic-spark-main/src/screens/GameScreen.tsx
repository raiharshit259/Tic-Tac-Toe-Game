import { motion } from "framer-motion";
import { useGameStore } from "@/store/gameStore";
import { GameBoard } from "@/components/game/GameBoard";
import { PlayerAvatar } from "@/components/game/PlayerAvatar";
import { ResultModal } from "@/components/game/ResultModal";
import { CountdownTimer } from "@/components/game/CountdownTimer";

export const GameScreen = () => {
  const { player, opponent, currentTurn, playerMark, status } = useGameStore();
  const isPlayerTurn = currentTurn === playerMark;
  const opponentMark = playerMark === "X" ? "O" : "X";

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-6 bg-mesh relative overflow-hidden">
      {/* Ambient background glow that shifts with turn */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        key={String(isPlayerTurn)}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
      >
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full blur-3xl"
          style={{
            background: isPlayerTurn
              ? "radial-gradient(circle, hsl(var(--game-x) / 0.05) 0%, transparent 70%)"
              : "radial-gradient(circle, hsl(var(--game-o) / 0.05) 0%, transparent 70%)",
          }}
        />
      </motion.div>

      {/* Top bar with players */}
      <motion.div
        className="w-full max-w-sm flex items-center justify-between mb-6 relative z-10"
        initial={{ opacity: 0, y: -14, filter: "blur(6px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* Player */}
        <motion.div
          className="flex items-center gap-2.5"
          animate={{ opacity: isPlayerTurn ? 1 : 0.5 }}
          transition={{ duration: 0.3 }}
        >
          <PlayerAvatar
            initials={player.avatar}
            mark={playerMark ?? undefined}
            active={isPlayerTurn}
            size="md"
          />
          <div>
            <p className="text-xs font-semibold leading-tight">{player.name}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{playerMark}</p>
          </div>
        </motion.div>

        {/* Center: turn indicator + timer */}
        <div className="flex flex-col items-center gap-1">
          <motion.div
            className="px-3 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider"
            key={String(isPlayerTurn)}
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 28 }}
            style={{
              backgroundColor: isPlayerTurn ? "hsl(var(--primary) / 0.12)" : "hsl(var(--secondary))",
              color: isPlayerTurn ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))",
            }}
          >
            {isPlayerTurn ? "Your turn" : "Waiting…"}
          </motion.div>
          <CountdownTimer total={30} active={status === "playing"} isPlayerTurn={isPlayerTurn} />
        </div>

        {/* Opponent */}
        <motion.div
          className="flex items-center gap-2.5"
          animate={{ opacity: !isPlayerTurn ? 1 : 0.5 }}
          transition={{ duration: 0.3 }}
        >
          <div className="text-right">
            <p className="text-xs font-semibold leading-tight">{opponent?.name ?? "Opponent"}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{opponentMark}</p>
          </div>
          <PlayerAvatar
            initials={opponent?.avatar ?? "??"}
            mark={opponentMark}
            active={!isPlayerTurn}
            size="md"
          />
        </motion.div>
      </motion.div>

      {/* Game board */}
      <GameBoard />

      <motion.p
        className="mt-6 text-[10px] text-muted-foreground/40 uppercase tracking-widest"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
      >
        Tap to place
      </motion.p>

      <ResultModal />
    </div>
  );
};
