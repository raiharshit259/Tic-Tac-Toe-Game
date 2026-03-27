import type { MatchState, PlayerSlot } from "../types/matchTypes";

function finalizeLeaderStats(nk: nkruntime.Nakama, player: PlayerSlot, result: "win" | "loss" | "draw"): void {
  if (result === "win") {
    nk.sqlExec(
      "INSERT INTO leaderboard_stats (user_id, wins, losses, draws, win_streak, updated_at) VALUES ($1::uuid, 1, 0, 0, 1, NOW()) ON CONFLICT (user_id) DO UPDATE SET wins = leaderboard_stats.wins + 1, win_streak = leaderboard_stats.win_streak + 1, updated_at = NOW()",
      [player.userId],
    );
    return;
  }

  if (result === "loss") {
    nk.sqlExec(
      "INSERT INTO leaderboard_stats (user_id, wins, losses, draws, win_streak, updated_at) VALUES ($1::uuid, 0, 1, 0, 0, NOW()) ON CONFLICT (user_id) DO UPDATE SET losses = leaderboard_stats.losses + 1, win_streak = 0, updated_at = NOW()",
      [player.userId],
    );
    return;
  }

  nk.sqlExec(
    "INSERT INTO leaderboard_stats (user_id, wins, losses, draws, win_streak, updated_at) VALUES ($1::uuid, 0, 0, 1, 0, NOW()) ON CONFLICT (user_id) DO UPDATE SET draws = leaderboard_stats.draws + 1, win_streak = 0, updated_at = NOW()",
    [player.userId],
  );
}

export function persistFinishedMatch(nk: nkruntime.Nakama, state: MatchState): void {
  if (!state.players.X || !state.players.O || state.phase !== "finished") {
    return;
  }

  if (state.players.X.isBot || state.players.O.isBot) {
    return;
  }

  const winnerId =
    state.winner === "X"
      ? state.players.X.userId
      : state.winner === "O"
        ? state.players.O.userId
        : null;

  nk.sqlExec(
    "INSERT INTO match_history (match_id, player1_id, player2_id, winner_id, moves, created_at) VALUES ($1, $2::uuid, $3::uuid, $4::uuid, $5::jsonb, NOW()) ON CONFLICT (match_id) DO NOTHING",
    [state.matchId, state.players.X.userId, state.players.O.userId, winnerId, JSON.stringify(state.moves)],
  );

  if (state.winner === "draw") {
    finalizeLeaderStats(nk, state.players.X, "draw");
    finalizeLeaderStats(nk, state.players.O, "draw");
  } else if (state.winner === "X") {
    finalizeLeaderStats(nk, state.players.X, "win");
    finalizeLeaderStats(nk, state.players.O, "loss");
  } else if (state.winner === "O") {
    finalizeLeaderStats(nk, state.players.O, "win");
    finalizeLeaderStats(nk, state.players.X, "loss");
  }
}
