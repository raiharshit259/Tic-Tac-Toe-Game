import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ncc from "@vercel/ncc";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, "..");
const entry = resolve(projectRoot, "src/main.ts");
const outDir = resolve(projectRoot, "build");
const outFile = resolve(outDir, "main.js");

const result = await ncc(entry, {
  minify: false,
  sourceMap: false,
  transpileOnly: false,
  target: "es2018",
});

await mkdir(outDir, { recursive: true });
const runtimeShim =
  "var module = { exports: {} }; var exports = module.exports; var __dirname = '.'; var __filename = 'main.js';\n";
let bundledCode = result.code;
bundledCode = bundledCode.replaceAll("__nccwpck_require__.ab = __dirname + \"/\";", "__nccwpck_require__.ab = \"./\";");
bundledCode = bundledCode.replace(/\b__dirname\b/g, "\".\"");
bundledCode = bundledCode.replace(/\b__filename\b/g, "\"main.js\"");

const nakamaFacade = `
var __nakamaRuntime = module.exports || {};

function __nakamaInvoke(name, args) {
  var fn = __nakamaRuntime[name];
  if (typeof fn !== "function") {
    throw new Error("Runtime export missing: " + name);
  }
  return fn.apply(null, args);
}

function matchInit(ctx, logger, nk, params) { return __nakamaInvoke("matchInit", arguments); }
function matchJoinAttempt(ctx, logger, nk, dispatcher, tick, state, presence) { return __nakamaInvoke("matchJoinAttempt", arguments); }
function matchJoin(ctx, logger, nk, dispatcher, tick, state, presences) { return __nakamaInvoke("matchJoin", arguments); }
function matchLeave(ctx, logger, nk, dispatcher, tick, state, presences) { return __nakamaInvoke("matchLeave", arguments); }
function matchLoop(ctx, logger, nk, dispatcher, tick, state, messages) { return __nakamaInvoke("matchLoop", arguments); }
function matchTerminate(ctx, logger, nk, dispatcher, tick, state, graceSeconds) { return __nakamaInvoke("matchTerminate", arguments); }
function matchSignal(ctx, logger, nk, dispatcher, tick, state, data) { return __nakamaInvoke("matchSignal", arguments); }

function rpcCreateMatchRoom(ctx, logger, nk, payload) { return __nakamaInvoke("rpcCreateMatchRoom", arguments); }
function rpcJoinMatchRoom(ctx, logger, nk, payload) { return __nakamaInvoke("rpcJoinMatchRoom", arguments); }
function rpcFindMatch(ctx, logger, nk, payload) { return __nakamaInvoke("rpcFindMatch", arguments); }
function rpcSubmitMove(ctx, logger, nk, payload) { return __nakamaInvoke("rpcSubmitMove", arguments); }
function rpcGetMatchState(ctx, logger, nk, payload) { return __nakamaInvoke("rpcGetMatchState", arguments); }
function rpcRematchRequest(ctx, logger, nk, payload) { return __nakamaInvoke("rpcRematchRequest", arguments); }
function rpcSetUsername(ctx, logger, nk, payload) { return __nakamaInvoke("rpcSetUsername", arguments); }
function rpcGetLeaderboard(ctx, logger, nk, payload) { return __nakamaInvoke("rpcGetLeaderboard", arguments); }
function rpcGetMatchHistory(ctx, logger, nk, payload) { return __nakamaInvoke("rpcGetMatchHistory", arguments); }

function InitModule(ctx, logger, nk, initializer) {
  initializer.registerMatch("tic_tac_toe", {
    matchInit: matchInit,
    matchJoinAttempt: matchJoinAttempt,
    matchJoin: matchJoin,
    matchLeave: matchLeave,
    matchLoop: matchLoop,
    matchTerminate: matchTerminate,
    matchSignal: matchSignal,
  });

  initializer.registerRpc("create_match_room", rpcCreateMatchRoom);
  initializer.registerRpc("join_match_room", rpcJoinMatchRoom);
  initializer.registerRpc("find_match", rpcFindMatch);
  initializer.registerRpc("submit_move", rpcSubmitMove);
  initializer.registerRpc("get_match_state", rpcGetMatchState);
  initializer.registerRpc("rematch_request", rpcRematchRequest);
  initializer.registerRpc("set_username", rpcSetUsername);
  initializer.registerRpc("get_leaderboard", rpcGetLeaderboard);
  initializer.registerRpc("get_match_history", rpcGetMatchHistory);

  logger.info("Tic-tac-toe authoritative module loaded.");
}
`;

await writeFile(outFile, runtimeShim + bundledCode + "\n" + nakamaFacade, "utf8");
