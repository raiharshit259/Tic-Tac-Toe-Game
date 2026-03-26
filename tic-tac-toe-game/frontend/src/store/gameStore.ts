import { create } from "zustand";
import { Session } from "@heroiclabs/nakama-js";
import type { Client, Socket } from "@heroiclabs/nakama-js";
import type {
  GetMatchHistoryResponse,
  LeaderboardEntry,
  MatchHistoryEntry,
  PublicMatchState,
  RpcResponse,
} from "../lib/sharedTypes";
import { GAME_OP_CODE } from "../lib/sharedTypes";
import { createNakamaClient } from "../lib/nakama";

type ConnectionState = "idle" | "connecting" | "connected";
type QueueState = "none" | "searching";
const SESSION_TOKEN_KEY = "ttt-session-token";
const SESSION_REFRESH_KEY = "ttt-session-refresh";
const ACTIVE_MATCH_KEY = "ttt-active-match-id";

interface GameStore {
  connectionState: ConnectionState;
  queueState: QueueState;
  client: Client | null;
  socket: Socket | null;
  session: Session | null;
  userId: string | null;
  username: string | null;
  activeMatchId: string | null;
  matchState: PublicMatchState | null;
  errorMessage: string | null;
  ticket: string | null;
  init: () => Promise<void>;
  createRoom: () => Promise<void>;
  joinRoomById: (matchId: string) => Promise<void>;
  findMatch: () => Promise<void>;
  placeMove: (index: number) => Promise<void>;
  rematch: () => Promise<void>;
  leaveMatch: () => void;
  clearError: () => void;
  fetchLeaderboard: () => Promise<LeaderboardEntry[]>;
  fetchMatchHistory: () => Promise<MatchHistoryEntry[]>;
}

const parseRpcPayload = <T>(payload: unknown): T => {
  if (typeof payload === "string") {
    return JSON.parse(payload) as T;
  }
  return payload as T;
};

const unwrapRpc = <T>(payload: unknown): T => {
  const parsed = parseRpcPayload<RpcResponse<T>>(payload);
  if (!parsed.ok) {
    throw new Error(parsed.error.message);
  }
  return parsed.data;
};

const decodeSocketData = (data: string | Uint8Array): string => {
  if (typeof data === "string") {
    return data;
  }
  return new TextDecoder().decode(data);
};

export const useGameStore = create<GameStore>((set, get) => ({
  connectionState: "idle",
  queueState: "none",
  client: null,
  socket: null,
  session: null,
  userId: null,
  username: null,
  activeMatchId: null,
  matchState: null,
  errorMessage: null,
  ticket: null,

  init: async () => {
    const current = get();
    if (current.connectionState === "connecting" || current.connectionState === "connected") {
      return;
    }

    set({ connectionState: "connecting", errorMessage: null });

    try {
      const { client, deviceId, username } = createNakamaClient();
      const cachedToken = localStorage.getItem(SESSION_TOKEN_KEY);
      const cachedRefresh = localStorage.getItem(SESSION_REFRESH_KEY);

      let session: Session;
      if (cachedToken && cachedRefresh) {
        const restored = Session.restore(cachedToken, cachedRefresh);
        if (!restored.isexpired(Date.now() / 1000)) {
          session = restored;
        } else {
          session = await client.authenticateDevice(deviceId, true, username);
        }
      } else {
        session = await client.authenticateDevice(deviceId, true, username);
      }

      localStorage.setItem(SESSION_TOKEN_KEY, session.token);
      localStorage.setItem(SESSION_REFRESH_KEY, session.refresh_token);

      const socket = client.createSocket((import.meta.env.VITE_NAKAMA_SSL ?? "false") === "true", false);
      await socket.connect(session, true);

      socket.onmatchdata = (message) => {
        if (message.op_code === GAME_OP_CODE.STATE) {
          const decoded = JSON.parse(decodeSocketData(message.data)) as {
            type: "STATE";
            payload: PublicMatchState;
          };
          set({
            matchState: decoded.payload,
            activeMatchId: decoded.payload.matchId,
            queueState: "none",
          });
          return;
        }

        if (message.op_code === GAME_OP_CODE.ERROR) {
          const decoded = JSON.parse(decodeSocketData(message.data)) as { payload: { message: string } };
          set({ errorMessage: decoded.payload.message });
        }
      };

      set({
        client,
        session,
        socket,
        userId: session.user_id,
        username,
        connectionState: "connected",
        errorMessage: null,
      });

      const savedMatchId = localStorage.getItem(ACTIVE_MATCH_KEY);
      if (savedMatchId) {
        try {
          await socket.joinMatch(savedMatchId);
          const stateResp = await client.rpc(session, "get_match_state", { matchId: savedMatchId });
          const stateData = unwrapRpc<{ state: PublicMatchState }>(stateResp.payload);
          set({ matchState: stateData.state, activeMatchId: savedMatchId });
        } catch (_error) {
          localStorage.removeItem(ACTIVE_MATCH_KEY);
        }
      }
    } catch (error) {
      set({
        connectionState: "idle",
        errorMessage: error instanceof Error ? error.message : "Failed to connect to Nakama.",
      });
    }
  },

  createRoom: async () => {
    const { client, session, socket } = get();
    if (!client || !session || !socket) {
      throw new Error("Not connected.");
    }

    try {
      const response = await client.rpc(session, "create_match_room", {});
      const parsed = unwrapRpc<{ matchId: string }>(response.payload);
      await socket.joinMatch(parsed.matchId);
      localStorage.setItem(ACTIVE_MATCH_KEY, parsed.matchId);
      const stateResp = await client.rpc(session, "get_match_state", { matchId: parsed.matchId });
      const stateData = unwrapRpc<{ state: PublicMatchState }>(stateResp.payload);
      set({ matchState: stateData.state, activeMatchId: parsed.matchId, queueState: "none", errorMessage: null });
    } catch (error) {
      set({ errorMessage: error instanceof Error ? error.message : "Failed to create room." });
      throw error;
    }
  },

  joinRoomById: async (matchId: string) => {
    const { client, session, socket } = get();
    if (!client || !session || !socket) {
      throw new Error("Not connected.");
    }

    try {
      const response = await client.rpc(session, "join_match_room", { matchId });
      const parsed = unwrapRpc<{ matchId: string }>(response.payload);
      await socket.joinMatch(parsed.matchId);
      localStorage.setItem(ACTIVE_MATCH_KEY, parsed.matchId);
      const stateResp = await client.rpc(session, "get_match_state", { matchId: parsed.matchId });
      const stateData = unwrapRpc<{ state: PublicMatchState }>(stateResp.payload);
      set({ matchState: stateData.state, activeMatchId: parsed.matchId, queueState: "none", errorMessage: null });
    } catch (error) {
      set({ errorMessage: error instanceof Error ? error.message : "Failed to join room." });
      throw error;
    }
  },

  findMatch: async () => {
    const { client, session, socket } = get();
    if (!socket || !client || !session) {
      throw new Error("Not connected.");
    }

    try {
      set({ queueState: "searching" });
      const response = await client.rpc(session, "find_match", {});
      const parsed = unwrapRpc<{ matchId: string }>(response.payload);
      await socket.joinMatch(parsed.matchId);
      localStorage.setItem(ACTIVE_MATCH_KEY, parsed.matchId);
      const stateResp = await client.rpc(session, "get_match_state", { matchId: parsed.matchId });
      const stateData = unwrapRpc<{ state: PublicMatchState }>(stateResp.payload);
      set({ matchState: stateData.state, activeMatchId: parsed.matchId, queueState: "none", errorMessage: null });
    } catch (error) {
      set({ queueState: "none", errorMessage: error instanceof Error ? error.message : "Failed to find match." });
      throw error;
    }
  },

  placeMove: async (index: number) => {
    const { client, session, activeMatchId } = get();
    if (!client || !session || !activeMatchId) {
      return;
    }

    try {
      const response = await client.rpc(session, "submit_move", { matchId: activeMatchId, index });
      const parsed = unwrapRpc<{ state: PublicMatchState }>(response.payload);
      set({ matchState: parsed.state, errorMessage: null });
    } catch (error) {
      set({ errorMessage: error instanceof Error ? error.message : "Move rejected." });
    }
  },

  rematch: async () => {
    const { client, session, activeMatchId } = get();
    if (!client || !session || !activeMatchId) {
      return;
    }

    try {
      const response = await client.rpc(session, "rematch_request", { matchId: activeMatchId });
      const parsed = unwrapRpc<{ state: PublicMatchState }>(response.payload);
      set({ matchState: parsed.state, errorMessage: null });
    } catch (error) {
      set({ errorMessage: error instanceof Error ? error.message : "Rematch failed." });
    }
  },

  leaveMatch: () => {
    localStorage.removeItem(ACTIVE_MATCH_KEY);
    set({
      activeMatchId: null,
      matchState: null,
      queueState: "none",
      ticket: null,
      errorMessage: null,
    });
  },

  clearError: () => set({ errorMessage: null }),

  fetchLeaderboard: async () => {
    const { client, session } = get();
    if (!client || !session) {
      return [];
    }

    const response = await client.rpc(session, "get_leaderboard", { limit: 20 });
    return unwrapRpc<LeaderboardEntry[]>(response.payload);
  },

  fetchMatchHistory: async () => {
    const { client, session } = get();
    if (!client || !session) {
      return [];
    }

    const response = await client.rpc(session, "get_match_history", { limit: 10 });
    const parsed = unwrapRpc<GetMatchHistoryResponse>(response.payload);
    return parsed.rows;
  },
}));
