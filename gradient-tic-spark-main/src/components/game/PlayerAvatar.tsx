import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface PlayerAvatarProps {
  initials: string;
  active?: boolean;
  mark?: "X" | "O";
  size?: "sm" | "md" | "lg";
}

const sizeMap = {
  sm: "w-8 h-8 text-[10px]",
  md: "w-9 h-9 text-xs",
  lg: "w-12 h-12 text-sm",
};

export const PlayerAvatar = ({ initials, active, mark, size = "md" }: PlayerAvatarProps) => (
  <div className="relative">
    {/* Glow ring when active */}
    {active && (
      <motion.div
        className={cn(
          "absolute -inset-1 rounded-full",
          mark === "X" ? "bg-game-x/20" : "bg-game-o/20"
        )}
        animate={{ scale: [1, 1.2, 1], opacity: [0.4, 0.15, 0.4] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      />
    )}
    <motion.div
      className={cn(
        "rounded-full flex items-center justify-center font-semibold relative z-10 border",
        sizeMap[size],
        mark === "X"
          ? "bg-game-x/10 text-game-x border-game-x/20"
          : mark === "O"
          ? "bg-game-o/10 text-game-o border-game-o/20"
          : "bg-muted text-muted-foreground border-border",
        active && "ring-2 ring-offset-1 ring-offset-background",
        active && mark === "X" && "ring-game-x/50",
        active && mark === "O" && "ring-game-o/50"
      )}
      animate={active ? { scale: [1, 1.04, 1] } : { scale: 1 }}
      transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
    >
      {initials}
    </motion.div>
  </div>
);
