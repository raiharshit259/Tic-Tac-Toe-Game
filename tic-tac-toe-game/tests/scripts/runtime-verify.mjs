import { Client } from "@heroiclabs/nakama-js";
import WebSocket from "ws";

global.WebSocket = WebSocket;

const host = process.env.NAKAMA_HOST || "127.0.0.1";
const port = process.env.NAKAMA_PORT || "7350";
const serverKey = process.env.NAKAMA_SERVER_KEY || "your_server_key_here";
const ssl = (process.env.NAKAMA_SSL || "false") === "true";
const TURN_MS = 30000;

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

function attachStateCollector(socket, bucket) {
  socket.onmatchdata = (message) => {
    if (message.op_code !== 1) {
      return;
    }

    const raw = typeof message.data === "string" ? message.data : new TextDecoder().decode(message.data);
    const parsed = JSON.parse(raw);
    bucket.push(parsed.payload);
  };
}

function latestState(states) {
  return states.length > 0 ? states[states.length - 1] : null;
}

async function main() {
  await waitForNakamaReady();

  const runId = Date.now();
  const clientA = new Client(serverKey, host, port, ssl);
  const clientB = new Client(serverKey, host, port, ssl);

  const userA = await createUser(clientA, `runtime-a-${runId}`, `runtimeA_${runId}`);
  const userB = await createUser(clientB, `runtime-b-${runId}`, `runtimeB_${runId}`);

  const jatin = `Jatin_${runId}`;
  const mohit = `Mohit_${runId}`;
  parseRpcPayload((await clientA.rpc(userA.session, "set_username", { username: jatin })).payload);
  parseRpcPayload((await clientB.rpc(userB.session, "set_username", { username: mohit })).payload);

  const findA = parseRpcPayload((await clientA.rpc(userA.session, "find_match", {})).payload);
  const findB = parseRpcPayload((await clientB.rpc(userB.session, "find_match", {})).payload);
  assert(findA.matchId === findB.matchId, "Matchmaking did not return same matchId.");

  const matchId = findA.matchId;
  const statesA = [];
  const statesB = [];
  attachStateCollector(userA.socket, statesA);
  attachStateCollector(userB.socket, statesB);

  await userA.socket.joinMatch(matchId);
  await userB.socket.joinMatch(matchId);
  await sleep(1200);

  const nowA = latestState(statesA);
  const nowB = latestState(statesB);
  assert(nowA && nowB, "No state updates received on one or both clients.");
  assert(nowA.phase === "playing" && nowB.phase === "playing", "Game did not start after both clients joined.");

  const names = nowA.players.map((p) => p.username);
  assert(names.includes(jatin) && names.includes(mohit), "Real usernames are not present in authoritative state.");

  const timerDelta = Math.abs((nowA.moveRemainingMs || 0) - (nowB.moveRemainingMs || 0));
  assert(timerDelta < 1200, `Timer desync too large at start: ${timerDelta}ms`);

  const maxWait = TURN_MS + 15000;
  const started = Date.now();
  while (Date.now() - started < maxWait) {
    const a = latestState(statesA);
    const b = latestState(statesB);
    if (a && b && a.phase === "finished" && b.phase === "finished") {
      assert(a.winner === b.winner, "Winner mismatch between clients on timeout.");
      assert(a.winner === "O", `Expected timeout winner O when X turn expires, got ${a.winner}`);
      break;
    }
    await sleep(500);
  }

  const finalA = latestState(statesA);
  const finalB = latestState(statesB);
  assert(finalA?.phase === "finished" && finalB?.phase === "finished", "Timeout did not finish match on both clients.");

  const leaderboard = parseRpcPayload((await clientA.rpc(userA.session, "get_leaderboard", { limit: 100 })).payload);
  assert(Array.isArray(leaderboard) && leaderboard.length > 0, "Leaderboard endpoint returned no rows.");

  const historyA = parseRpcPayload((await clientA.rpc(userA.session, "get_match_history", { limit: 10 })).payload).rows;
  const historyB = parseRpcPayload((await clientB.rpc(userB.session, "get_match_history", { limit: 10 })).payload).rows;
  assert(historyA.some((row) => row.matchId === matchId), "Player A history missing runtime match.");
  assert(historyB.some((row) => row.matchId === matchId), "Player B history missing runtime match.");

  await userA.socket.disconnect(false);
  await userB.socket.disconnect(false);
  console.log("RUNTIME VERIFY PASS: matchmaking, usernames, timer sync, timeout, leaderboard endpoint, history persistence.");
}

main().catch((error) => {
  console.error("RUNTIME VERIFY FAIL:", error?.message || String(error));
  process.exit(1);
});
