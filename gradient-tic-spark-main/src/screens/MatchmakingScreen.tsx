import { motion } from "framer-motion";
import { useGameStore } from "@/store/gameStore";
import { GlassCard } from "@/components/game/GlassCard";
import { OrbitLoader } from "@/components/game/OrbitLoader";
import { PlayerAvatar } from "@/components/game/PlayerAvatar";

export const MatchmakingScreen = () => {
  const { cancelMatchmaking, player } = useGameStore();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-mesh relative overflow-hidden">
      {/* Pulsing radar rings */}
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="absolute w-48 h-48 rounded-full border border-primary/8 pointer-events-none"
          style={{ left: "50%", top: "50%", x: "-50%", y: "-50%" }}
          initial={{ scale: 0.4, opacity: 0 }}
          animate={{ scale: [0.4, 2.2], opacity: [0.25, 0] }}
          transition={{ duration: 3.5, repeat: Infinity, delay: i * 1, ease: "easeOut" }}
        />
      ))}

      <motion.div
        initial={{ opacity: 0, scale: 0.92, filter: "blur(8px)" }}
        animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      >
        <GlassCard className="max-w-xs w-full text-center space-y-6 relative z-10">
          <div className="flex items-center justify-center gap-6">
            <motion.div className="text-center space-y-1.5"
              initial={{ x: -16, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.4 }}
            >
              <PlayerAvatar initials={player.avatar} mark="X" size="lg" />
              <p className="text-[10px] text-muted-foreground font-medium">{player.name}</p>
            </motion.div>

            <motion.span className="text-muted-foreground/25 text-sm font-bold tracking-wider"
              animate={{ opacity: [0.15, 0.6, 0.15], scale: [0.96, 1.04, 0.96] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
            >
              VS
            </motion.span>

            <motion.div className="text-center space-y-1.5"
              initial={{ x: 16, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.4 }}
            >
              <motion.div
                className="w-12 h-12 rounded-full bg-muted/30 flex items-center justify-center border border-border/40"
                animate={{ borderColor: ["hsl(var(--border) / 0.2)", "hsl(var(--primary) / 0.25)", "hsl(var(--border) / 0.2)"] }}
                transition={{ duration: 2.5, repeat: Infinity }}
              >
                <motion.span className="text-muted-foreground/25 text-base"
                  animate={{ rotate: [0, 360] }}
                  transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
                >?</motion.span>
              </motion.div>
              <p className="text-[10px] text-muted-foreground">Searching…</p>
            </motion.div>
          </div>

          <div className="flex justify-center">
            <OrbitLoader />
          </div>

          <motion.p className="text-xs text-muted-foreground"
            animate={{ opacity: [0.35, 0.9, 0.35] }}
            transition={{ duration: 2.8, repeat: Infinity }}
          >
            Finding a worthy opponent…
          </motion.p>

          <motion.button
            onClick={cancelMatchmaking}
            className="px-5 py-2 rounded-xl bg-secondary text-secondary-foreground text-xs font-medium"
            whileHover={{ scale: 1.05, boxShadow: "0 4px 12px -4px hsl(var(--foreground) / 0.1)" }}
            whileTap={{ scale: 0.94 }}
          >
            Cancel
          </motion.button>
        </GlassCard>
      </motion.div>
    </div>
  );
};
