import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Board } from "./components/Board";
import { GlassPanel } from "./components/GlassPanel";
import { LeaderboardPanel } from "./components/LeaderboardPanel";
import { LobbyPanel } from "./components/LobbyPanel";
import { MatchHistoryPanel } from "./components/MatchHistoryPanel";
import { ThemeToggle } from "./components/ThemeToggle";
import { useGameStore } from "./store/gameStore";

function useThemeMode(): ["light" | "dark", () => void] {
  const [mode, setMode] = useState<"light" | "dark">(() => {
    const stored = localStorage.getItem("ttt-theme");
    if (stored === "light" || stored === "dark") {
      return stored;
    }
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  useEffect(() => {
    const html = document.documentElement;
    if (mode === "dark") {
      html.classList.add("dark");
    } else {
      html.classList.remove("dark");
    }
    localStorage.setItem("ttt-theme", mode);
  }, [mode]);

  return [mode, () => setMode((prev) => (prev === "light" ? "dark" : "light"))];
}

export default function App() {
  const {
    init,
    connectionState,
    queueState,
    matchState,
    userId,
    username,
    errorMessage,
    clearError,
    createRoom,
    findMatch,
    joinRoomById,
    placeMove,
    rematch,
    fetchLeaderboard,
    fetchMatchHistory,
  } = useGameStore();

  const [theme, toggleTheme] = useThemeMode();
  const [remainingMs, setRemainingMs] = useState<number>(0);

  useEffect(() => {
    void init();
  }, [init]);

  useEffect(() => {
    if (!matchState?.moveRemainingMs) {
      setRemainingMs(0);
      return;
    }
    setRemainingMs(matchState.moveRemainingMs);
  }, [matchState?.moveRemainingMs]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setRemainingMs((prev) => (prev > 250 ? prev - 250 : 0));
    }, 250);
    return () => window.clearInterval(timer);
  }, []);

  const leaderboardQuery = useQuery({
    queryKey: ["leaderboard", connectionState],
    queryFn: fetchLeaderboard,
    refetchInterval: 7000,
    enabled: connectionState === "connected",
  });

  const historyQuery = useQuery({
    queryKey: ["history", connectionState],
    queryFn: fetchMatchHistory,
    refetchInterval: 7000,
    enabled: connectionState === "connected",
  });

  const me = useMemo(() => {
    if (!matchState || !userId) {
      return null;
    }
    return matchState.players.find((player) => player.userId === userId) ?? null;
  }, [matchState, userId]);

  const turnLabel = matchState
    ? matchState.phase === "waiting"
      ? "Waiting for second player"
      : matchState.phase === "finished"
        ? matchState.winner === "draw"
          ? "Draw"
          : `${matchState.winner} wins`
        : me?.mark === matchState.turn
          ? "Your turn"
          : "Opponent turn"
    : "No active match";

  return (
    <main className="min-h-screen mesh-bg px-4 py-6 sm:px-6">
      <div className="mx-auto w-full max-w-6xl space-y-5">
        <motion.header
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Nakama Authoritative</p>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Tic-Tac-Toe Arena</h1>
          </div>
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
        </motion.header>

        {errorMessage ? (
          <GlassPanel className="p-4 border-red-400/30">
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm">{errorMessage}</p>
              <button className="text-xs text-muted-foreground" onClick={clearError}>
                Dismiss
              </button>
            </div>
          </GlassPanel>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-[280px_1fr_320px]">
          <div className="space-y-4">
            <LobbyPanel
              queueState={queueState}
              onCreate={() => void createRoom()}
              onAutoMatch={() => void findMatch()}
              onJoin={(id) => void joinRoomById(id)}
            />
            <MatchHistoryPanel rows={historyQuery.data ?? []} loading={historyQuery.isLoading} userId={userId} />
          </div>

          <GlassPanel className="p-5 flex flex-col items-center justify-between gap-5">
            <div className="w-full flex items-center justify-between text-sm">
              <p className="font-semibold">{username ?? "Connecting..."}</p>
              <p className="text-muted-foreground">{connectionState}</p>
            </div>

            {matchState ? (
              <>
                <Board state={matchState} userId={userId} onMove={(index) => void placeMove(index)} />
                <div className="w-full space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <p className="font-semibold">{turnLabel}</p>
                    <p className="text-muted-foreground">{Math.ceil(remainingMs / 1000)}s</p>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
                    <motion.div
                      className="h-full bg-primary"
                      animate={{ width: `${Math.max(0, Math.min(100, (remainingMs / 30000) * 100))}%` }}
                      transition={{ duration: 0.2 }}
                    />
                  </div>
                  {matchState.phase === "finished" ? (
                    <button
                      onClick={() => void rematch()}
                      className="w-full rounded-xl bg-primary py-2.5 text-black font-semibold"
                    >
                      Request Rematch
                    </button>
                  ) : null}
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-20">Create or join a room to start playing.</p>
            )}
          </GlassPanel>

          <LeaderboardPanel rows={leaderboardQuery.data ?? []} loading={leaderboardQuery.isLoading} />
        </div>
      </div>
    </main>
  );
}
