import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useGameStore } from "@/store/gameStore";
import { GlassCard } from "./GlassCard";

const resultConfig = {
  win: { title: "Victory!", emoji: "🏆", color: "text-game-win" },
  lose: { title: "Defeated", emoji: "😤", color: "text-game-o" },
  draw: { title: "Draw", emoji: "🤝", color: "text-muted-foreground" },
};

interface Particle {
  id: number;
  x: number;
  y: number;
  color: string;
  size: number;
  angle: number;
  speed: number;
}

const ConfettiParticle = ({ particle }: { particle: Particle }) => (
  <motion.div
    className="absolute rounded-sm"
    style={{
      width: particle.size,
      height: particle.size * 0.6,
      backgroundColor: particle.color,
      left: "50%",
      top: "50%",
    }}
    initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: 0 }}
    animate={{
      x: Math.cos(particle.angle) * particle.speed * 120,
      y: Math.sin(particle.angle) * particle.speed * 120 + 60,
      opacity: [1, 1, 0],
      rotate: Math.random() * 720 - 360,
      scale: [0, 1, 0.5],
    }}
    transition={{ duration: 1.2 + Math.random() * 0.5, ease: "easeOut" }}
  />
);

export const ResultModal = () => {
  const { status, result, playAgain, exitGame } = useGameStore();
  const show = status === "finished" && result;

  const confetti = useMemo(() => {
    if (result !== "win") return [];
    const colors = [
      "hsl(48, 96%, 53%)",
      "hsl(172, 66%, 50%)",
      "hsl(340, 65%, 58%)",
      "hsl(220, 14%, 92%)",
      "hsl(25, 95%, 53%)",
    ];
    return Array.from({ length: 40 }, (_, i) => ({
      id: i,
      x: 0,
      y: 0,
      color: colors[i % colors.length],
      size: 6 + Math.random() * 6,
      angle: (Math.PI * 2 * i) / 40 + Math.random() * 0.5,
      speed: 0.5 + Math.random() * 1.5,
    }));
  }, [result]);

  return (
    <AnimatePresence>
      {show && result && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-md px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <GlassCard
            className="max-w-sm w-full text-center space-y-6 relative overflow-hidden"
            glow={result === "win"}
            initial={{ scale: 0.7, opacity: 0, y: 30, filter: "blur(10px)" }}
            animate={{ scale: 1, opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ scale: 0.9, opacity: 0, y: -10 }}
            transition={{ type: "spring", stiffness: 300, damping: 24 }}
          >
            {/* Confetti burst on win */}
            {result === "win" && confetti.map((p) => (
              <ConfettiParticle key={p.id} particle={p} />
            ))}

            {/* Animated ring behind emoji */}
            {result === "win" && (
              <motion.div
                className="absolute left-1/2 top-6 -translate-x-1/2 w-20 h-20 rounded-full"
                style={{ border: "2px solid hsl(var(--game-win) / 0.3)" }}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: [0, 2, 2.5], opacity: [0.8, 0.3, 0] }}
                transition={{ duration: 1.2, ease: "easeOut" }}
              />
            )}

            <motion.div
              className="text-6xl relative z-10"
              initial={{ scale: 0, rotate: -30 }}
              animate={{ scale: [0, 1.3, 1], rotate: [0, 10, 0] }}
              transition={{ delay: 0.15, duration: 0.6, ease: [0.34, 1.56, 0.64, 1] }}
            >
              {resultConfig[result].emoji}
            </motion.div>

            <motion.h2
              className={`text-3xl font-bold tracking-tight relative z-10 ${resultConfig[result].color}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.4 }}
            >
              {resultConfig[result].title}
            </motion.h2>

            <motion.div
              className="flex gap-3 justify-center relative z-10"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45, duration: 0.4 }}
            >
              <motion.button
                onClick={playAgain}
                className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium text-sm"
                whileHover={{ scale: 1.06, boxShadow: "0 4px 20px -4px hsl(var(--primary) / 0.4)" }}
                whileTap={{ scale: 0.94 }}
              >
                Play Again
              </motion.button>
              <motion.button
                onClick={exitGame}
                className="px-6 py-2.5 rounded-xl bg-secondary text-secondary-foreground font-medium text-sm"
                whileHover={{ scale: 1.06 }}
                whileTap={{ scale: 0.94 }}
              >
                Exit
              </motion.button>
            </motion.div>
          </GlassCard>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
