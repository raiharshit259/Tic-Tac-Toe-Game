import { GlassPanel } from "./GlassPanel";
import type { LeaderboardEntry } from "../lib/sharedTypes";

interface LeaderboardPanelProps {
  rows: LeaderboardEntry[];
  loading: boolean;
}

export function LeaderboardPanel({ rows, loading }: LeaderboardPanelProps) {
  return (
    <GlassPanel className="p-5 space-y-4">
      <h2 className="text-sm uppercase tracking-[0.18em] text-muted-foreground">Global Leaderboard</h2>
      {loading ? <p className="text-sm text-muted-foreground">Loading...</p> : null}
      <div className="space-y-2">
        {rows.length === 0 && !loading ? <p className="text-sm text-muted-foreground">No matches yet.</p> : null}
        {rows.map((row) => (
          <div
            key={`${row.username}-${row.rank}`}
            className="grid grid-cols-[32px_1fr_auto] items-center rounded-xl border border-border/70 bg-background/55 px-3 py-2"
          >
            <p className="text-xs font-bold text-muted-foreground">#{row.rank}</p>
            <p className="font-medium text-sm truncate">{row.username}</p>
            <p className="text-xs text-muted-foreground">W {row.wins} / L {row.losses}</p>
          </div>
        ))}
      </div>
    </GlassPanel>
  );
}
