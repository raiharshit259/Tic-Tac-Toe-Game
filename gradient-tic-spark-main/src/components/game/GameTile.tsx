import { motion, useMotionValue, useTransform } from "framer-motion";
import { cn } from "@/lib/utils";
import type { Mark } from "@/store/gameStore";
import { useState } from "react";

interface GameTileProps {
  value: Mark;
  onClick: () => void;
  isWinning: boolean;
  disabled: boolean;
  index: number;
}

const XMark = () => (
  <motion.svg
    viewBox="0 0 64 64"
    className="w-7 h-7 sm:w-8 sm:h-8"
    initial={{ scale: 0, rotate: -90, filter: "blur(6px)" }}
    animate={{ scale: 1, rotate: 0, filter: "blur(0px)" }}
    transition={{ type: "spring", stiffness: 300, damping: 18 }}
  >
    <motion.line
      x1="18" y1="18" x2="46" y2="46"
      stroke="hsl(var(--game-x))" strokeWidth="5" strokeLinecap="round"
      initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
    />
    <motion.line
      x1="46" y1="18" x2="18" y2="46"
      stroke="hsl(var(--game-x))" strokeWidth="5" strokeLinecap="round"
      initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
      transition={{ duration: 0.25, delay: 0.08, ease: "easeOut" }}
    />
  </motion.svg>
);

const OMark = () => (
  <motion.svg
    viewBox="0 0 64 64"
    className="w-7 h-7 sm:w-8 sm:h-8"
    initial={{ scale: 0, filter: "blur(6px)" }}
    animate={{ scale: 1, filter: "blur(0px)" }}
    transition={{ type: "spring", stiffness: 300, damping: 18 }}
  >
    <motion.circle
      cx="32" cy="32" r="16"
      fill="none" stroke="hsl(var(--game-o))" strokeWidth="5" strokeLinecap="round"
      initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
    />
  </motion.svg>
);

export const GameTile = ({ value, onClick, isWinning, disabled, index }: GameTileProps) => {
  const [ripple, setRipple] = useState(false);
  const [shake, setShake] = useState(false);

  const handleClick = () => {
    if (value) {
      // Invalid move → shake
      setShake(true);
      setTimeout(() => setShake(false), 400);
      return;
    }
    if (disabled) return;
    setRipple(true);
    setTimeout(() => setRipple(false), 350);
    onClick();
  };

  return (
    <motion.button
      onClick={handleClick}
      className={cn(
        "aspect-square rounded-xl flex items-center justify-center relative overflow-hidden",
        "bg-surface-raised border border-border transition-[border-color,box-shadow] duration-200",
        !value && !disabled && "cursor-pointer hover:border-primary/20",
        value && "cursor-default",
        isWinning && "glow-win border-game-win/40"
      )}
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{
        opacity: 1,
        scale: 1,
        x: shake ? [0, -4, 4, -3, 3, 0] : 0,
        ...(isWinning ? { scale: [1, 1.05, 1] } : {}),
      }}
      transition={
        shake
          ? { x: { duration: 0.35, ease: "easeInOut" } }
          : isWinning
          ? { scale: { duration: 0.5, repeat: 3, ease: "easeInOut" }, opacity: { duration: 0.25, delay: index * 0.04 } }
          : { duration: 0.35, delay: index * 0.04, ease: [0.16, 1, 0.3, 1] }
      }
      whileHover={!value && !disabled ? { scale: 1.05, boxShadow: "0 0 12px -3px hsl(var(--primary) / 0.2)" } : {}}
      whileTap={!value && !disabled ? { scale: 0.93 } : {}}
    >
      {ripple && (
        <motion.div
          className="absolute inset-0 rounded-xl bg-primary/8"
          initial={{ scale: 0, opacity: 0.5 }}
          animate={{ scale: 2.5, opacity: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
        />
      )}
      {value === "X" && <XMark />}
      {value === "O" && <OMark />}
    </motion.button>
  );
};
