import { motion } from "framer-motion";

export const OrbitLoader = () => (
  <div className="relative w-16 h-16 flex items-center justify-center">
    <motion.div
      className="absolute w-3 h-3 rounded-full bg-primary"
      animate={{ rotate: 360 }}
      transition={{ duration: 1.8, repeat: Infinity, ease: "linear" }}
      style={{ transformOrigin: "32px 32px", x: -24 }}
    />
    <motion.div
      className="absolute w-2.5 h-2.5 rounded-full bg-game-o"
      animate={{ rotate: -360 }}
      transition={{ duration: 2.4, repeat: Infinity, ease: "linear" }}
      style={{ transformOrigin: "32px 32px", x: -18 }}
    />
    <div className="w-2 h-2 rounded-full bg-muted-foreground/40" />
  </div>
);
