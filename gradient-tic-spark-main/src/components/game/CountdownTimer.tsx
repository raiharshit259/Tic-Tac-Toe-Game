import { useEffect, useState } from "react";
import { motion } from "framer-motion";

interface CountdownTimerProps {
  total: number;
  active: boolean;
  isPlayerTurn: boolean;
}

export const CountdownTimer = ({ total, active, isPlayerTurn }: CountdownTimerProps) => {
  const [remaining, setRemaining] = useState(total);

  useEffect(() => {
    setRemaining(total);
  }, [isPlayerTurn, total]);

  useEffect(() => {
    if (!active) return;
    const interval = setInterval(() => {
      setRemaining((r) => Math.max(0, r - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [active, isPlayerTurn]);

  const progress = remaining / total;
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - progress);

  // Color transitions green → amber → red
  const getColor = () => {
    if (progress > 0.5) return "hsl(var(--primary))";
    if (progress > 0.25) return "hsl(40, 90%, 50%)";
    return "hsl(0, 72%, 51%)";
  };

  return (
    <div className="relative w-12 h-12 flex items-center justify-center">
      <svg width="48" height="48" viewBox="0 0 48 48" className="-rotate-90">
        <circle
          cx="24" cy="24" r={radius}
          fill="none" stroke="hsl(var(--border))" strokeWidth="3"
        />
        <motion.circle
          cx="24" cy="24" r={radius}
          fill="none"
          stroke={getColor()}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={circumference}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        />
      </svg>
      <span className="absolute text-xs font-bold tabular-nums text-foreground">
        {remaining}
      </span>
    </div>
  );
};
