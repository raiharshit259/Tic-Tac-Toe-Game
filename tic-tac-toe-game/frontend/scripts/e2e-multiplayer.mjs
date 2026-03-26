import { Client, Session } from "@heroiclabs/nakama-js";
import WebSocket from "ws";

global.WebSocket = WebSocket;

const host = process.env.NAKAMA_HOST || "127.0.0.1";
const port = process.env.NAKAMA_PORT || "7350";
const serverKey = process.env.NAKAMA_SERVER_KEY || "your_server_key_here";
const ssl = (process.env.NAKAMA_SSL || "false") === "true";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

function logStep(message) {
  console.log(`[E2E] ${message}`);
}

async function createUser(client, deviceId, username) {
  const session = await client.authenticateDevice(deviceId, true, username);
  const socket = client.createSocket(ssl, false);
  await socket.connect(session, true);
  return { session, socket };
}

async function waitForState(socket, timeoutMs = 10000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const onData = (message) => {
      if (message.op_code === 1) {
        const raw = typeof message.data === "string" ? message.data : new TextDecoder().decode(message.data);
        const parsed = JSON.parse(raw);
        socket.onmatchdata = null;
        resolve(parsed.payload);
      }
    };

    socket.onmatchdata = onData;

    const timer = setInterval(() => {
      if (Date.now() - started > timeoutMs) {
        clearInterval(timer);
        socket.onmatchdata = null;
        reject(new Error("Timed out waiting for state."));
      }
    }, 200);
  });
}

async function main() {
  logStep("create clients");
  const clientA = new Client(serverKey, host, port, ssl);
  const clientB = new Client(serverKey, host, port, ssl);
  const runId = Date.now();

  logStep("authenticate + connect sockets");
  const userA = await createUser(clientA, `e2e-a-${runId}`, `E2E_A_${runId}`);
  const userB = await createUser(clientB, `e2e-b-${runId}`, `E2E_B_${runId}`);

  logStep("create room");
  const created = await clientA.rpc(userA.session, "create_match_room", {});
  const room = parseRpcPayload(created.payload);
  assert(room.matchId, "create_match_room must return matchId");

  logStep("join A socket");
  await userA.socket.joinMatch(room.matchId);

  logStep("join B rpc + socket");
  const joined = await clientB.rpc(userB.session, "join_match_room", { matchId: room.matchId });
  parseRpcPayload(joined.payload);
  await userB.socket.joinMatch(room.matchId);

  await sleep(400);

  logStep("fetch initial state");
  const initialStateResp = await clientA.rpc(userA.session, "get_match_state", { matchId: room.matchId });
  const initialState = parseRpcPayload(initialStateResp.payload).state;
  assert(initialState.phase === "playing", "match should be in playing phase after both joins");

  logStep("submit scripted moves");
  const firstMove = await clientA.rpc(userA.session, "submit_move", { matchId: room.matchId, index: 0 });
  parseRpcPayload(firstMove.payload);

  let rejected = false;
  try {
    const invalidMove = await clientA.rpc(userA.session, "submit_move", { matchId: room.matchId, index: 1 });
    parseRpcPayload(invalidMove.payload);
  } catch (_err) {
    rejected = true;
  }
  assert(rejected, "out-of-turn move must be rejected");

  parseRpcPayload((await clientB.rpc(userB.session, "submit_move", { matchId: room.matchId, index: 3 })).payload);
  parseRpcPayload((await clientA.rpc(userA.session, "submit_move", { matchId: room.matchId, index: 1 })).payload);
  parseRpcPayload((await clientB.rpc(userB.session, "submit_move", { matchId: room.matchId, index: 4 })).payload);
  const winning = await clientA.rpc(userA.session, "submit_move", { matchId: room.matchId, index: 2 });
  const winningState = parseRpcPayload(winning.payload).state;

  assert(winningState.phase === "finished", "match should finish");
  assert(winningState.winner === "X", "winner should be X in scripted sequence");

  logStep("verify leaderboard + history");
  const leaderboard = await clientA.rpc(userA.session, "get_leaderboard", { limit: 10 });
  const top = parseRpcPayload(leaderboard.payload);
  assert(Array.isArray(top) && top.length > 0, "leaderboard should return rows");

  const historyA = await clientA.rpc(userA.session, "get_match_history", { limit: 5 });
  const historyRows = parseRpcPayload(historyA.payload).rows;
  assert(historyRows.length > 0, "match history should include completed game");

  logStep("rematch + reconnect");
  parseRpcPayload((await clientA.rpc(userA.session, "rematch_request", { matchId: room.matchId })).payload);
  const rematchResponse = await clientB.rpc(userB.session, "rematch_request", { matchId: room.matchId });
  const rematchState = parseRpcPayload(rematchResponse.payload).state;
  assert(rematchState.phase === "playing", "rematch should transition to playing");

  await userB.socket.disconnect(false);
  await sleep(600);
  await userB.socket.connect(userB.session, true);
  await userB.socket.joinMatch(room.matchId);

  const recovered = await clientB.rpc(userB.session, "get_match_state", { matchId: room.matchId });
  const recoveredState = parseRpcPayload(recovered.payload).state;
  assert(recoveredState.matchId === room.matchId, "recovered state should match room id");

  console.log("E2E PASS: authoritative gameplay, rejection, leaderboard, history, rematch, reconnect.");

  await userA.socket.disconnect(false);
  await userB.socket.disconnect(false);
}

main().catch((error) => {
  console.error("E2E FAIL:", error?.message || String(error));
  if (error && typeof error === "object") {
    console.error("E2E ERROR DETAIL:", JSON.stringify(error, null, 2));
  }
  process.exit(1);
});
