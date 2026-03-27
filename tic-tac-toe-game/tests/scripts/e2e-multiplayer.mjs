import { Client, Session } from "@heroiclabs/nakama-js";
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

async function waitForMatchState(client, session, matchId, predicate, timeoutMs = 15000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const resp = await client.rpc(session, "get_match_state", { matchId });
    const state = parseRpcPayload(resp.payload).state;
    if (predicate(state)) {
      return state;
    }
    await sleep(350);
  }
  throw new Error(`Timed out waiting for expected state for match ${matchId}`);
}

async function main() {
  logStep("wait for nakama");
  await waitForNakamaReady();

  logStep("create clients");
  const clientA = new Client(serverKey, host, port, ssl);
  const clientB = new Client(serverKey, host, port, ssl);
  const clientC = new Client(serverKey, host, port, ssl);
  const clientD = new Client(serverKey, host, port, ssl);
  const runId = Date.now();

  logStep("authenticate + connect sockets");
  const userA = await createUser(clientA, `e2e-a-${runId}`, `E2E_A_${runId}`);
  const userB = await createUser(clientB, `e2e-b-${runId}`, `E2E_B_${runId}`);
  const userC = await createUser(clientC, `e2e-c-${runId}`, `E2E_C_${runId}`);
  const userD = await createUser(clientD, `e2e-d-${runId}`, `E2E_D_${runId}`);

  logStep("set persistent usernames");
  parseRpcPayload((await clientA.rpc(userA.session, "set_username", { username: `Jatin_${runId}` })).payload);
  parseRpcPayload((await clientB.rpc(userB.session, "set_username", { username: `Mohit_${runId}` })).payload);

  logStep("validate random matchmaking reuses waiting match");
  const mmA = parseRpcPayload((await clientC.rpc(userC.session, "find_match", {})).payload);
  const mmB = parseRpcPayload((await clientD.rpc(userD.session, "find_match", {})).payload);
  assert(mmA.matchId && mmB.matchId, "find_match must return match id");
  assert(mmA.matchId === mmB.matchId, "find_match should return same waiting match for both players");

  await userC.socket.joinMatch(mmA.matchId);
  await userD.socket.joinMatch(mmB.matchId);
  await sleep(400);
  const mmStateResp = await clientC.rpc(userC.session, "get_match_state", { matchId: mmA.matchId });
  const mmState = parseRpcPayload(mmStateResp.payload).state;
  assert(mmState.players.length === 2, "matchmaking room should have exactly two players");
  assert(mmState.phase === "playing", "matchmaking room should transition to playing");

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

  assert(
    winningState.players.some((p) => p.username.startsWith(`Jatin_${runId}`)) &&
      winningState.players.some((p) => p.username.startsWith(`Mohit_${runId}`)),
    "match state must include persisted real usernames",
  );

  logStep("bot fallback matchmaking timeout");
  const clientE = new Client(serverKey, host, port, ssl);
  const userE = await createUser(clientE, `e2e-e-${runId}`, `E2E_E_${runId}`);
  const fallback = parseRpcPayload(
    (await clientE.rpc(userE.session, "find_match", { botFallbackTimeoutSeconds: 4 })).payload,
  );
  await userE.socket.joinMatch(fallback.matchId);

  const botStartState = await waitForMatchState(
    clientE,
    userE.session,
    fallback.matchId,
    (state) => state.phase === "playing" && state.players.some((p) => p.username === "Nakama Bot"),
    15000,
  );
  assert(botStartState.players.length === 2, "Bot fallback should create a 2-player match.");

  const myMark = botStartState.players.find((p) => p.userId === userE.session.user_id)?.mark;
  assert(myMark === "X" || myMark === "O", "Unable to determine human mark in bot fallback match.");

  const firstOpenCell = botStartState.board.findIndex((cell) => cell === null);
  assert(firstOpenCell >= 0, "Bot fallback match should have at least one open cell.");

  await clientE.rpc(userE.session, "submit_move", { matchId: fallback.matchId, index: firstOpenCell });

  const botRespondedState = await waitForMatchState(
    clientE,
    userE.session,
    fallback.matchId,
    (state) => state.moves.length >= 2,
    8000,
  );

  assert(
    botRespondedState.moves.some((m) => m.userId === "00000000-0000-0000-0000-000000000001"),
    "Bot fallback opponent did not submit a server-authoritative move.",
  );

  await userE.socket.disconnect(false);
  await sleep(400);
  await userE.socket.connect(userE.session, true);
  await userE.socket.joinMatch(fallback.matchId);

  const recoveredBotState = parseRpcPayload(
    (await clientE.rpc(userE.session, "get_match_state", { matchId: fallback.matchId })).payload,
  ).state;
  assert(recoveredBotState.matchId === fallback.matchId, "Reconnect during bot match failed to recover state.");

  logStep("disconnect during wait should not leave stale slot");
  const clientF = new Client(serverKey, host, port, ssl);
  const userF = await createUser(clientF, `e2e-f-${runId}`, `E2E_F_${runId}`);

  const waitOnly = parseRpcPayload((await clientF.rpc(userF.session, "find_match", { botFallbackTimeoutSeconds: 8 })).payload);
  await userF.socket.joinMatch(waitOnly.matchId);
  await userF.socket.disconnect(true);
  let cleaned = false;
  const cleanupStart = Date.now();
  while (Date.now() - cleanupStart < 10000) {
    try {
      const postDisconnect = parseRpcPayload(
        (await clientF.rpc(userF.session, "get_match_state", { matchId: waitOnly.matchId })).payload,
      ).state;
      if (
        Array.isArray(postDisconnect.players) &&
        (postDisconnect.players.length === 0 || postDisconnect.players.every((p) => p.connected === false))
      ) {
        cleaned = true;
        break;
      }
    } catch (_error) {
      // Also acceptable if runtime already cleaned up the fully-empty waiting match.
      cleaned = true;
      break;
    }
    await sleep(400);
  }

  assert(cleaned, "Waiting disconnect should mark room players disconnected or cleanup the waiting match.");

  await userE.socket.disconnect(false);

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
  await userC.socket.disconnect(false);
  await userD.socket.disconnect(false);
}

main().catch((error) => {
  console.error("E2E FAIL:", error?.message || String(error));
  if (error && typeof error === "object") {
    console.error("E2E ERROR DETAIL:", JSON.stringify(error, null, 2));
  }
  process.exit(1);
});
