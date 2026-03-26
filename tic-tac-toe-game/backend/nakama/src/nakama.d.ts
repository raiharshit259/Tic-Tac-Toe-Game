declare namespace nkruntime {
  interface Presence {
    userId: string;
    sessionId: string;
    username: string;
  }

  interface MatchMessage {
    opCode: number;
    sender: Presence;
    data: string | Uint8Array;
  }

  interface MatchmakerResult {
    presence: Presence;
  }

  interface Context {
    matchId?: string;
    userId?: string;
  }

  interface Logger {
    info(message: string, ...args: unknown[]): void;
    warn(message: string, ...args: unknown[]): void;
    debug(message: string, ...args: unknown[]): void;
  }

  interface MatchDispatcher {
    broadcastMessage(
      opCode: number,
      data: string,
      presences: Presence[] | null,
      sender: Presence | null,
      reliable: boolean,
    ): void;
  }

  type SqlValue = string | number | boolean | null;
  type SqlRow = Record<string, unknown>;

  interface Nakama {
    matchCreate(module: string, params: Record<string, unknown>): string;
    matchSignal(matchId: string, data: string): string;
    sqlExec(query: string, params?: SqlValue[]): void;
    sqlQuery(query: string, params?: SqlValue[]): SqlRow[];
    binaryToString(data: string | Uint8Array): string;
  }

  interface Initializer {
    registerMatch(
      name: string,
      handlers: {
        matchInit: Function;
        matchJoinAttempt: Function;
        matchJoin: Function;
        matchLeave: Function;
        matchLoop: Function;
        matchTerminate: Function;
        matchSignal: Function;
      },
    ): void;
    registerRpc(name: string, fn: Function): void;
  }
}
