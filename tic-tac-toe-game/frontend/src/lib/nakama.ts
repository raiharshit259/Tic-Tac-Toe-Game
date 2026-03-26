import { Client } from "@heroiclabs/nakama-js";

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

function getUsername(): string {
  const storageKey = "ttt-username";
  const existing = localStorage.getItem(storageKey);
  if (existing) {
    return existing;
  }

  const generated = `Player-${Math.floor(Math.random() * 9000 + 1000)}`;
  localStorage.setItem(storageKey, generated);
  return generated;
}

export function createNakamaClient() {
  const host = import.meta.env.VITE_NAKAMA_HOST ?? "127.0.0.1";
  const port = import.meta.env.VITE_NAKAMA_PORT ?? "7350";
  const serverKey = import.meta.env.VITE_SERVER_KEY ?? import.meta.env.VITE_NAKAMA_SERVER_KEY ?? "your_server_key_here";
  const useSSL = (import.meta.env.VITE_NAKAMA_SSL ?? "false") === "true";

  const client = new Client(serverKey, host, port, useSSL);

  return {
    client,
    deviceId: getDeviceId(),
    username: getUsername(),
  };
}
