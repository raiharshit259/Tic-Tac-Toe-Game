import { Client } from "@heroiclabs/nakama-js";

const USERNAME_STORAGE_KEY = "ttt-username";

function getDeviceId(): string {
  const storageKey = "ttt-device-id";
  const existing = localStorage.getItem(storageKey);
  if (existing) {
    return existing;
  }

  const generated = `device-${crypto.randomUUID()}`;
  localStorage.setItem(storageKey, generated);
  return generated;
}

export function getStoredUsername(): string | null {
  const value = String(localStorage.getItem(USERNAME_STORAGE_KEY) || "").trim();
  return value || null;
}

export function persistUsername(username: string): void {
  localStorage.setItem(USERNAME_STORAGE_KEY, username.trim());
}

export function createNakamaClient() {
  const host = import.meta.env.VITE_NAKAMA_HOST ?? "127.0.0.1";
  const port = import.meta.env.VITE_NAKAMA_PORT ?? "7350";
  const serverKey = import.meta.env.VITE_SERVER_KEY ?? import.meta.env.VITE_NAKAMA_SERVER_KEY ?? "your_server_key_here";
  const useSSL = (import.meta.env.VITE_NAKAMA_SSL ?? "false") === "true";
  const deviceId = getDeviceId();

  const client = new Client(serverKey, host, port, useSSL);

  return {
    client,
    deviceId,
    // Keep authentication username internal and deterministic to avoid collisions
    // with user-facing names selected later through set_username RPC.
    username: `u-${deviceId.replace("device-", "").slice(0, 12)}`,
  };
}
