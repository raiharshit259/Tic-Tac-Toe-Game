import { motion } from "framer-motion";
import { useGameStore } from "@/store/gameStore";
import { GlassCard } from "@/components/game/GlassCard";

const menuItems = [
  { label: "Play Online", action: "play", icon: "⚡", desc: "Find an opponent instantly" },
  { label: "Leaderboard", action: "leaderboard", icon: "🏆", desc: "See top players" },
];

interface HomeScreenProps {
  onNavigate: (screen: string) => void;
}

export const HomeScreen = ({ onNavigate }: HomeScreenProps) => {
  const { startMatchmaking } = useGameStore();

  const handleAction = (action: string) => {
    if (action === "play") {
      startMatchmaking();
      onNavigate("matchmaking");
    } else {
      onNavigate(action);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-mesh relative overflow-hidden">
      {/* Background orbs */}
      {[
        { size: "w-40 h-40", pos: "top-10 left-[10%]", color: "bg-primary/8", dur: 7, delay: 0 },
        { size: "w-56 h-56", pos: "bottom-20 right-[5%]", color: "bg-game-o/6", dur: 9, delay: 1 },
        { size: "w-28 h-28", pos: "top-[40%] right-[25%]", color: "bg-primary/4", dur: 6, delay: 2 },
      ].map((orb, i) => (
        <motion.div
          key={i}
          className={`absolute ${orb.pos} ${orb.size} rounded-full ${orb.color} blur-2xl`}
          animate={{ y: [-10, 10, -10], x: [-5, 5, -5], scale: [1, 1.08, 1] }}
          transition={{ duration: orb.dur, repeat: Infinity, ease: "easeInOut", delay: orb.delay }}
        />
      ))}

      {/* Dot grid */}
      <motion.div
        className="absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage: `radial-gradient(circle, hsl(var(--foreground)) 1px, transparent 1px)`,
          backgroundSize: "32px 32px",
        }}
        animate={{ y: [0, -32] }}
        transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
      />

      {/* Floating X / O */}
      <motion.svg viewBox="0 0 64 64" className="absolute top-[18%] right-[14%] w-10 h-10 opacity-[0.07]"
        animate={{ rotate: 360, y: [-8, 8, -8] }}
        transition={{ rotate: { duration: 24, repeat: Infinity, ease: "linear" }, y: { duration: 5, repeat: Infinity, ease: "easeInOut" } }}
      >
        <line x1="18" y1="18" x2="46" y2="46" stroke="hsl(var(--game-x))" strokeWidth="5" strokeLinecap="round" />
        <line x1="46" y1="18" x2="18" y2="46" stroke="hsl(var(--game-x))" strokeWidth="5" strokeLinecap="round" />
      </motion.svg>
      <motion.svg viewBox="0 0 64 64" className="absolute bottom-[22%] left-[12%] w-8 h-8 opacity-[0.07]"
        animate={{ rotate: -360, y: [6, -6, 6] }}
        transition={{ rotate: { duration: 30, repeat: Infinity, ease: "linear" }, y: { duration: 6, repeat: Infinity, ease: "easeInOut" } }}
      >
        <circle cx="32" cy="32" r="16" fill="none" stroke="hsl(var(--game-o))" strokeWidth="5" strokeLinecap="round" />
      </motion.svg>

      {/* Title */}
      <motion.div
        className="text-center space-y-2 mb-10 relative z-10"
        initial={{ opacity: 0, y: 16, filter: "blur(8px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      >
        <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tighter text-balance leading-[0.9]">
          {["T","i","c"].map((c, i) => (
            <motion.span key={`a${i}`} className="text-gradient-primary inline-block"
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.04, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            >{c}</motion.span>
          ))}
          {["T","a","c"].map((c, i) => (
            <motion.span key={`b${i}`} className="text-foreground inline-block"
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.22 + i * 0.04, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            >{c}</motion.span>
          ))}
          {["T","o","e"].map((c, i) => (
            <motion.span key={`c${i}`} className="text-game-o inline-block"
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.34 + i * 0.04, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            >{c}</motion.span>
          ))}
        </h1>
        <motion.p className="text-muted-foreground text-xs sm:text-sm"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.55 }}
        >
          Real-time multiplayer, beautifully crafted
        </motion.p>
      </motion.div>

      {/* Menu cards */}
      <div className="space-y-2.5 w-full max-w-xs relative z-10">
        {menuItems.map((item, i) => (
          <motion.div
            key={item.action}
            initial={{ opacity: 0, x: -16, filter: "blur(6px)" }}
            animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
            transition={{ delay: 0.45 + i * 0.1, duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          >
            <GlassCard
              className="flex items-center gap-3.5 py-4 px-5 cursor-pointer select-none group overflow-hidden relative"
              whileHover={{ scale: 1.02, y: -1, boxShadow: "0 8px 24px -8px hsl(var(--primary) / 0.15)", transition: { duration: 0.2, ease: "easeOut" } }}
              whileTap={{ scale: 0.97 }}
              onClick={() => handleAction(item.action)}
            >
              <motion.span className="text-lg relative z-10"
                whileHover={{ rotate: [0, -8, 8, 0], scale: 1.15 }}
                transition={{ duration: 0.35 }}
              >
                {item.icon}
              </motion.span>
              <div className="relative z-10">
                <span className="font-semibold text-sm block">{item.label}</span>
                <span className="text-[11px] text-muted-foreground">{item.desc}</span>
              </div>
            </GlassCard>
          </motion.div>
        ))}
      </div>

      {/* Footer */}
      <motion.div className="mt-12 flex items-center gap-2 text-[10px] text-muted-foreground/40 uppercase tracking-widest"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 }}
      >
        <motion.span className="w-1 h-1 rounded-full bg-primary/50"
          animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2.5, repeat: Infinity }}
        />
        <span>WebSocket-ready</span>
        <span>·</span>
        <span>Framer Motion</span>
      </motion.div>
    </div>
  );
};
