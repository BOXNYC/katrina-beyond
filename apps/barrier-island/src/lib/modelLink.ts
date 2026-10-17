import { encode, type ModelLink, type ModelMessage } from "./modelProtocol";

// Where the model listens. Set EXPO_PUBLIC_MODEL_HOST / EXPO_PUBLIC_MODEL_PORT
// (e.g. in .env) to point at it.
const HOST = process.env.EXPO_PUBLIC_MODEL_HOST ?? "192.168.1.50";
const PORT = Number(process.env.EXPO_PUBLIC_MODEL_PORT ?? 9000);
const RETRY_MS = 3000;

type Tcp = typeof import("react-native-tcp-socket").default;

// Expo Go doesn't include this native module and throws when it is loaded. In
// that case (or any build without it) messages are only logged.
let TcpSocket: Tcp | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  TcpSocket = require("react-native-tcp-socket").default as Tcp;
} catch {
  console.warn("[model] TCP unavailable (Expo Go?). Use a development build; logging only.");
}

let socket: ReturnType<Tcp["createConnection"]> | null = null;
let connected = false;
let retry: ReturnType<typeof setTimeout> | null = null;
/** Latest value per option, replayed on (re)connect so the model catches up. */
const lastOptions = new Map<string, ModelMessage>();

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
      for (const m of lastOptions.values()) s.write(encode(m));
    });
  } catch (e) {
    // The native side is missing (Expo Go): give up and just log.
    console.warn("[model] TCP unavailable; logging only.", e);
    TcpSocket = null;
    return;
  }
  socket = s;
  const drop = () => {
    connected = false;
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

function send(m: ModelMessage) {
  console.log("[model]", encode(m).trimEnd());
  if (m.command === "set") lastOptions.set(m.option, m);
  if (m.command === "simulate") {
    // The simulate message carries every option, so it supersedes the replay.
    for (const [option, level] of Object.entries(m.options)) {
      lastOptions.set(option, { command: "set", option: option as never, level });
    }
  }
  connect();
  // Not connected yet: the message is dropped, and options are replayed on connect.
  if (connected && socket) socket.write(encode(m));
}

const modelLink: ModelLink = {
  sendOption: (option, level) => send({ command: "set", option, level }),
  sendSimulate: (severity, options) => send({ command: "simulate", severity, options }),
};

connect();

export default modelLink;
