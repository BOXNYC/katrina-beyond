import { encode, type ModelLink, type ModelMessage } from "./modelProtocol";

// Browsers can't open raw TCP sockets, so the web build only logs what the
// native app would send to the model.
const send = (m: ModelMessage) => console.log("[model]", encode(m).trimEnd());

const modelLink: ModelLink = {
  sendOption: (option, level) => send({ command: "set", option, level }),
  sendSimulate: (severity, options) => send({ command: "simulate", severity, options }),
};

export default modelLink;
