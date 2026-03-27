import type { RpcErrorResponse } from "../types/matchTypes";

export function parsePayload<T>(payload: string): T {
  return JSON.parse(payload) as T;
}

export function parseRpcRequest<T>(rawPayload: string): T {
  if (!rawPayload || rawPayload === "{}") {
    return {} as T;
  }
  return JSON.parse(rawPayload) as T;
}

export function normalizeMatchId(raw: string | undefined): string {
  return String(raw || "").trim();
}

export function rpcFail(code: string, message: string): string {
  const body: RpcErrorResponse = {
    ok: false,
    error: { code, message },
  };
  return JSON.stringify(body);
}

function uint8ToUtf8(bytes: Uint8Array): string {
  if (typeof TextDecoder !== "undefined") {
    return new TextDecoder("utf-8").decode(bytes);
  }

  let out = "";
  for (let i = 0; i < bytes.length; i += 1) {
    out += String.fromCharCode(bytes[i]);
  }
  return out;
}

export function decodeStateJsonValue(value: unknown): string | null {
  if (typeof value === "string") {
    return value;
  }

  if (value instanceof ArrayBuffer) {
    return uint8ToUtf8(new Uint8Array(value));
  }

  if (ArrayBuffer.isView(value)) {
    const view = value as ArrayBufferView;
    const start = view.byteOffset;
    const end = view.byteOffset + view.byteLength;
    return uint8ToUtf8(new Uint8Array(view.buffer.slice(start, end)));
  }

  if (Array.isArray(value)) {
    return uint8ToUtf8(new Uint8Array(value as number[]));
  }

  if (value && typeof value === "object") {
    const maybeData = (value as { data?: unknown }).data;
    if (Array.isArray(maybeData)) {
      return uint8ToUtf8(new Uint8Array(maybeData as number[]));
    }
    return JSON.stringify(value);
  }

  return null;
}

export function sanitizeUsername(username: string | undefined): string {
  return String(username || "").trim().slice(0, 24);
}
