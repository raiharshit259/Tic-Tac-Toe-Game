import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useGameStore } from "@/store/gameStore";
import { useThemeStore } from "@/store/themeStore";
import { HomeScreen } from "@/screens/HomeScreen";
import { MatchmakingScreen } from "@/screens/MatchmakingScreen";
import { GameScreen } from "@/screens/GameScreen";
import { LeaderboardScreen } from "@/screens/LeaderboardScreen";
import { ThemeToggle } from "@/components/game/ThemeToggle";

type Screen = "home" | "matchmaking" | "game" | "leaderboard";

const Index = () => {
  const { status } = useGameStore();
  const { theme } = useThemeStore();
  const [screen, setScreen] = useState<Screen>("home");

  useEffect(() => {
    if (status === "matchmaking") setScreen("matchmaking");
    else if (status === "playing" || status === "finished") setScreen("game");
    else if (status === "idle" && screen !== "leaderboard") setScreen("home");
  }, [status]);

  return (
    <div className={`${theme} transition-colors duration-500`}>
      <ThemeToggle />
      <AnimatePresence mode="wait">
        <motion.div
          key={screen}
          initial={{ opacity: 0, y: 8, filter: "blur(6px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, y: -6, filter: "blur(6px)" }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        >
          {screen === "home" && <HomeScreen onNavigate={(s) => setScreen(s as Screen)} />}
          {screen === "matchmaking" && <MatchmakingScreen />}
          {screen === "game" && <GameScreen />}
          {screen === "leaderboard" && <LeaderboardScreen onBack={() => setScreen("home")} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default Index;
