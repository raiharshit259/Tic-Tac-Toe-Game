import { Client } from "@heroiclabs/nakama-js";
import WebSocket from "ws";

global.WebSocket = WebSocket;

const host = process.env.NAKAMA_HOST || "127.0.0.1";
const port = process.env.NAKAMA_PORT || "7350";
const serverKey = process.env.NAKAMA_SERVER_KEY || "your_server_key_here";
const ssl = (process.env.NAKAMA_SSL || "false") === "true";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForNakamaReady(timeoutMs = 120000) {
  const started = Date.now();
  const endpoint = `http${ssl ? "s" : ""}://${host}:${port}/`;

  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(endpoint);
      if (response.status > 0) {
        return;
      }
    } catch (_error) {
      // Retry until timeout.
    }

    await sleep(1500);
  }

  throw new Error(`Nakama not reachable at ${endpoint} within ${timeoutMs}ms`);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function parseRpcPayload(payload) {
  const parsed = typeof payload === "string" ? JSON.parse(payload) : payload;
  if (!parsed || parsed.ok !== true) {
    const code = parsed?.error?.code || "RPC_ERROR";
    const message = parsed?.error?.message || JSON.stringify(parsed);
    throw new Error(`${code}: ${message}`);
  }
  return parsed.data;
}

async function createUser(client, deviceId, username) {
  const session = await client.authenticateDevice(deviceId, true, username);
  const socket = client.createSocket(ssl, false);
  await socket.connect(session, true);
  return { session, socket };
}

async function getState(client, session, matchId) {
  const resp = await client.rpc(session, "get_match_state", { matchId });
  return parseRpcPayload(resp.payload).state;
}

async function createRoom(client, session) {
  const created = await client.rpc(session, "create_match_room", {});
  return parseRpcPayload(created.payload).matchId;
}

async function main() {
  await waitForNakamaReady();

  const runId = Date.now();
  const clients = Array.from({ length: 5 }).map(() => new Client(serverKey, host, port, ssl));

  const users = await Promise.all([
    createUser(clients[0], `sys-a-${runId}`, `SYS_A_${runId}`),
    createUser(clients[1], `sys-b-${runId}`, `SYS_B_${runId}`),
    createUser(clients[2], `sys-c-${runId}`, `SYS_C_${runId}`),
    createUser(clients[3], `sys-d-${runId}`, `SYS_D_${runId}`),
    createUser(clients[4], `sys-e-${runId}`, `SYS_E_${runId}`),
  ]);

  const room1 = await createRoom(clients[0], users[0].session);
  const room2 = await createRoom(clients[2], users[2].session);
  assert(room1 !== room2, "Concurrent rooms must have distinct match IDs.");

  const room1BJoin = parseRpcPayload((await clients[1].rpc(users[1].session, "join_match_room", { matchId: room1 })).payload).matchId;
  const room2DJoin = parseRpcPayload((await clients[3].rpc(users[3].session, "join_match_room", { matchId: room2 })).payload).matchId;

  await users[0].socket.joinMatch(room1);
  await users[1].socket.joinMatch(room1BJoin);
  await users[2].socket.joinMatch(room2);
  await users[3].socket.joinMatch(room2DJoin);

  await sleep(700);

  const state1 = await getState(clients[0], users[0].session, room1);
  const state2 = await getState(clients[2], users[2].session, room2);
  assert(state1.phase === "playing", "Room 1 should be in playing phase.");
  assert(state2.phase === "playing", "Room 2 should be in playing phase.");

  parseRpcPayload((await clients[0].rpc(users[0].session, "submit_move", { matchId: room1, index: 0 })).payload);
  await sleep(300);

  const room1After = await getState(clients[0], users[0].session, room1);
  const room2After = await getState(clients[2], users[2].session, room2);
  assert(room1After.board[0] !== null, "Room 1 move was not applied.");
  assert(room2After.board.every((cell) => cell === null), "Room 2 state changed unexpectedly from Room 1 move.");

  const invalidCode = "INVALID123";
  const invalidJoin = parseRpcPayload((await clients[4].rpc(users[4].session, "join_match_room", { matchId: invalidCode })).payload).matchId;
  let invalidHandled = false;
  try {
    await users[4].socket.joinMatch(invalidJoin);
  } catch (_error) {
    invalidHandled = true;
  }

  if (!invalidHandled) {
    try {
      await getState(clients[4], users[4].session, invalidJoin);
    } catch (_error) {
      invalidHandled = true;
    }
  }

  assert(invalidHandled, "Invalid room code should be handled with an error.");

  await Promise.all(users.map((u) => u.socket.disconnect(false)));
  console.log("SYSTEM CHECK PASS: concurrent rooms isolated and invalid room IDs handled.");
}

main().catch((error) => {
  console.error("SYSTEM CHECK FAIL:", error?.message || String(error));
  process.exit(1);
});
