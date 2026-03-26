import { motion } from "framer-motion";
import { LeaderboardRow } from "@/components/game/LeaderboardRow";
import { ArrowLeft } from "lucide-react";

const leaderboardData = [
  { rank: 1, name: "Aria Chen", avatar: "AC", wins: 142, losses: 23, streak: 12 },
  { rank: 2, name: "Marcus Webb", avatar: "MW", wins: 128, losses: 31, streak: 8 },
  { rank: 3, name: "Lena Kowalski", avatar: "LK", wins: 119, losses: 28, streak: 5 },
  { rank: 4, name: "Jay Patel", avatar: "JP", wins: 97, losses: 41, streak: 3 },
  { rank: 5, name: "Sophie Tanaka", avatar: "ST", wins: 89, losses: 44, streak: 2 },
  { rank: 6, name: "Diego Morales", avatar: "DM", wins: 76, losses: 52, streak: 1 },
  { rank: 7, name: "Nina Okafor", avatar: "NO", wins: 71, losses: 49, streak: 4 },
  { rank: 8, name: "Elias Roth", avatar: "ER", wins: 64, losses: 58, streak: 0 },
];

interface LeaderboardScreenProps {
  onBack: () => void;
}

export const LeaderboardScreen = ({ onBack }: LeaderboardScreenProps) => (
  <div className="min-h-screen flex flex-col items-center px-4 py-10 bg-mesh">
    <motion.div
      className="w-full max-w-md"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="flex items-center justify-between mb-6">
        <motion.button
          onClick={onBack}
          className="w-9 h-9 rounded-xl glass-card flex items-center justify-center"
          whileHover={{ scale: 1.08, boxShadow: "0 4px 12px -4px hsl(var(--foreground) / 0.1)" }}
          whileTap={{ scale: 0.92 }}
        >
          <ArrowLeft size={14} />
        </motion.button>
        <h2 className="text-lg font-bold tracking-tight">Leaderboard</h2>
        <div className="w-9" />
      </div>

      <div className="space-y-1.5">
        {leaderboardData.map((player, i) => (
          <LeaderboardRow key={player.rank} {...player} index={i} />
        ))}
      </div>
    </motion.div>
  </div>
);
