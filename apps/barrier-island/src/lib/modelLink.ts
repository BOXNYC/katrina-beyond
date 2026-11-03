import { encodeSimulate, RESET_COMMAND, TERMINATOR, type ModelLink } from "./modelProtocol";

// Where the model listens. Set EXPO_PUBLIC_MODEL_HOST / EXPO_PUBLIC_MODEL_PORT
// (e.g. in .env) to point at it.
const HOST = process.env.EXPO_PUBLIC_MODEL_HOST ?? "192.168.1.50";
const PORT = Number(process.env.EXPO_PUBLIC_MODEL_PORT ?? 9000);
const RETRY_MS = 3000;

type Tcp = typeof import("react-native-tcp-socket").default;

// The native module is missing on web and throws when it is loaded. In that
// case (or any build without it) messages are only logged.
let TcpSocket: Tcp | null = null;
try {
  // The package ends with `module.exports = {...}`, which replaces its own
  // `export default`, so `.default` is undefined under Metro. Fall back to the module.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require("react-native-tcp-socket");
  TcpSocket = (mod.default ?? mod) as Tcp;
} catch {
  console.warn("[model] TCP unavailable (web or no native module); logging only.");
}

let socket: ReturnType<Tcp["createConnection"]> | null = null;
let connected = false;
let retry: ReturnType<typeof setTimeout> | null = null;
const resetListeners = new Set<() => void>();
/** Incoming bytes not yet terminated by a carriage return. */
let inbox = "";

function scheduleRetry() {
  if (retry) return;
  retry = setTimeout(() => {
    retry = null;
    connect();
  }, RETRY_MS);
}

function connect() {
  if (socket || !TcpSocket) return;
  let s: ReturnType<Tcp["createConnection"]>;
  try {
    s = TcpSocket.createConnection({ host: HOST, port: PORT }, () => {
      connected = true;
      console.log(`[model] connected to ${HOST}:${PORT}`);
    });
  } catch (e) {
    // The native side is missing: give up and just log.
    console.warn("[model] TCP unavailable; logging only.", e);
    TcpSocket = null;
    return;
  }
  socket = s;
  s.on("data", (data) => {
    inbox += data.toString();
    const parts = inbox.split(TERMINATOR);
    inbox = parts.pop() ?? "";
    for (const part of parts) {
      const command = part.trim();
      console.log("[model] received", JSON.stringify(command));
      if (command === RESET_COMMAND) resetListeners.forEach((l) => l());
    }
  });
  const drop = () => {
    connected = false;
    inbox = "";
    socket = null;
    scheduleRetry();
  };
  s.on("error", (e) => {
    console.warn("[model] socket error", e);
    s.destroy();
    drop();
  });
  s.on("close", drop);
}

const modelLink: ModelLink = {
  sendSimulate: (levels) => {
    const message = encodeSimulate(levels);
    console.log("[model]", JSON.stringify(message));
    connect();
    // Not connected: the message is dropped, there is no replay.
    if (connected && socket) socket.write(message);
  },
  onReset: (listener) => {
    resetListeners.add(listener);
    return () => resetListeners.delete(listener);
  },
};

connect();

export default modelLink;
