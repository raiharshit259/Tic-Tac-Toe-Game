CREATE TABLE IF NOT EXISTS user_profiles (
  user_id UUID PRIMARY KEY,
  display_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS leaderboard_stats (
  user_id UUID PRIMARY KEY,
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  draws INTEGER NOT NULL DEFAULT 0,
  win_streak INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS active_matches (
  match_id TEXT PRIMARY KEY,
  player1_id UUID,
  player2_id UUID,
  phase TEXT NOT NULL,
  state_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS match_history (
  id BIGSERIAL PRIMARY KEY,
  match_id TEXT UNIQUE NOT NULL,
  player1_id UUID NOT NULL,
  player2_id UUID NOT NULL,
  winner_id UUID,
  moves JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_match_history_player1_created
  ON match_history (player1_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_match_history_player2_created
  ON match_history (player2_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_match_history_winner
  ON match_history (winner_id);

CREATE INDEX IF NOT EXISTS idx_leaderboard_stats_wins
  ON leaderboard_stats (wins DESC, win_streak DESC);

CREATE INDEX IF NOT EXISTS idx_active_matches_phase_updated
  ON active_matches (phase, updated_at DESC);
