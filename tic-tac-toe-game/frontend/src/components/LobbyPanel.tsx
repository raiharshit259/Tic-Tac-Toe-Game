import { motion } from "framer-motion";
import { GlassPanel } from "./GlassPanel";

interface LobbyPanelProps {
  queueState: "none" | "searching";
  onCreate: () => void;
  onAutoMatch: () => void;
  onJoin: (matchId: string) => void;
}

export function LobbyPanel({ queueState, onCreate, onAutoMatch, onJoin }: LobbyPanelProps) {
  return (
    <GlassPanel className="p-5 space-y-4">
      <h2 className="text-sm uppercase tracking-[0.18em] text-muted-foreground">Multiplayer Lobby</h2>
      <div className="grid gap-2">
        <motion.button
          whileTap={{ scale: 0.98 }}
          whileHover={{ scale: 1.02 }}
          className="rounded-xl bg-primary text-black font-semibold py-2.5"
          onClick={onCreate}
        >
          Create Room
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.98 }}
          whileHover={{ scale: 1.02 }}
          className="rounded-xl bg-secondary text-foreground font-semibold py-2.5"
          onClick={onAutoMatch}
          disabled={queueState === "searching"}
        >
          {queueState === "searching" ? "Searching..." : "Auto Matchmaking"}
        </motion.button>
      </div>
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          const matchId = String(formData.get("matchId") || "").trim();
          if (matchId.length > 0) {
            onJoin(matchId);
            event.currentTarget.reset();
          }
        }}
      >
        <input
          name="matchId"
          placeholder="Paste match id"
          className="w-full rounded-xl border border-border bg-background/65 px-3 py-2 text-sm outline-none focus:border-primary"
        />
        <button type="submit" className="rounded-xl bg-secondary px-3 text-sm font-semibold">
          Join
        </button>
      </form>
    </GlassPanel>
  );
}
