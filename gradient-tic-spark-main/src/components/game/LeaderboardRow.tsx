import { motion } from "framer-motion";
import { PlayerAvatar } from "./PlayerAvatar";

interface LeaderboardRowProps {
  rank: number;
  name: string;
  avatar: string;
  wins: number;
  losses: number;
  streak: number;
  index: number;
}

const rankBadge = (rank: number) => {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return `#${rank}`;
};

export const LeaderboardRow = ({ rank, name, avatar, wins, losses, streak, index }: LeaderboardRowProps) => (
  <motion.div
    className="glass-card p-3 sm:p-3.5 flex items-center gap-3"
    initial={{ opacity: 0, x: -12, filter: "blur(4px)" }}
    animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
    transition={{ delay: index * 0.06, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
    whileHover={{ scale: 1.015, y: -1, boxShadow: "0 6px 16px -6px hsl(var(--foreground) / 0.08)", transition: { duration: 0.15 } }}
  >
    <span className="w-7 text-center font-bold text-xs tabular-nums">{rankBadge(rank)}</span>
    <PlayerAvatar initials={avatar} size="sm" />
    <span className="font-medium text-sm flex-1 truncate">{name}</span>
    <div className="flex gap-3 text-[10px] text-muted-foreground tabular-nums">
      <span className="text-game-x">{wins}W</span>
      <span className="text-game-o">{losses}L</span>
      <span>🔥{streak}</span>
    </div>
  </motion.div>
);
