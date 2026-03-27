import type { MatchState, PlayerSlot } from "../types/matchTypes";

export function findPlayerByUserId(state: MatchState, userId: string): PlayerSlot | null {
  if (state.players.X && state.players.X.userId === userId) {
    return state.players.X;
  }
  if (state.players.O && state.players.O.userId === userId) {
    return state.players.O;
  }
  return null;
}

export function persistProfile(nk: nkruntime.Nakama, userId: string, username: string): void {
  nk.sqlExec(
    "INSERT INTO user_profiles (user_id, display_name) VALUES ($1::uuid, $2) ON CONFLICT (user_id) DO UPDATE SET display_name = EXCLUDED.display_name, updated_at = NOW()",
    [userId, username],
  );
}

function resolveDisplayName(nk: nkruntime.Nakama, userId: string, fallback: string): string {
  const rows = nk.sqlQuery(
    "SELECT COALESCE(up.display_name, u.username, $2) AS username FROM users u LEFT JOIN user_profiles up ON up.user_id = u.id WHERE u.id = $1::uuid LIMIT 1",
    [userId, fallback],
  );

  if (rows.length === 0) {
    return fallback;
  }

  const value = String(rows[0].username || "").trim();
  return value || fallback;
}

export function resolveUsernameFromAccount(nk: nkruntime.Nakama, userId: string, fallback: string): string {
  try {
    const nkAny = nk as unknown as {
      accountGetId?: (id: string) => { user?: { username?: string } };
    };

    const account = nkAny.accountGetId ? nkAny.accountGetId(userId) : null;
    const accountUsername = String(account?.user?.username || "").trim();
    if (accountUsername) {
      return accountUsername;
    }
  } catch (_error) {
    // Fall through to profile/sql lookup below.
  }

  return resolveDisplayName(nk, userId, fallback);
}

export function syncAccountUsername(
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  userId: string,
  username: string,
): void {
  try {
    const nkAny = nk as unknown as {
      accountUpdateId?: (
        u: string,
        uName?: string | null,
        displayName?: string | null,
        avatarUrl?: string | null,
        langTag?: string | null,
        location?: string | null,
        timezone?: string | null,
        metadata?: Record<string, unknown> | null,
      ) => void;
    };

    if (nkAny.accountUpdateId) {
      nkAny.accountUpdateId(userId, username, username, null, null, null, null, null);
    }
  } catch (error) {
    logger.warn("rpc=set_username accountUpdateId failed user=%q error=%q", userId, String(error));
  }
}
