import { GlassPanel } from "./GlassPanel";
import type { MatchHistoryEntry } from "../lib/sharedTypes";

interface MatchHistoryPanelProps {
  rows: MatchHistoryEntry[];
  loading: boolean;
  userId: string | null;
}

export function MatchHistoryPanel({ rows, loading, userId }: MatchHistoryPanelProps) {
  return (
    <GlassPanel className="p-5 space-y-4">
      <h2 className="text-sm uppercase tracking-[0.18em] text-muted-foreground">Recent Matches</h2>
      {loading ? <p className="text-sm text-muted-foreground">Loading...</p> : null}
      <div className="space-y-2 max-h-[260px] overflow-auto pr-1">
        {!loading && rows.length === 0 ? <p className="text-sm text-muted-foreground">No completed games yet.</p> : null}
        {rows.map((row) => {
          const isDraw = row.winnerId === null;
          const didWin = row.winnerId === userId;
          return (
            <div
              key={row.matchId}
              className="rounded-xl border border-border/70 bg-background/55 px-3 py-2 space-y-1"
            >
              <p className="text-xs text-muted-foreground truncate">{row.matchId}</p>
              <p className="text-sm font-semibold">
                {isDraw ? "Draw" : didWin ? "Win" : "Loss"}
              </p>
              <p className="text-xs text-muted-foreground">Moves: {row.moves.length}</p>
            </div>
          );
        })}
      </div>
    </GlassPanel>
  );
}
