import { encodeSimulate, type ModelLink } from "./modelProtocol";

// Browsers can't open raw TCP sockets, so the web build only logs what the
// native app would send to the controller. It never receives Reset.
const modelLink: ModelLink = {
  sendSimulate: (levels) => console.log("[model]", JSON.stringify(encodeSimulate(levels))),
  onReset: () => () => {},
};

export default modelLink;
