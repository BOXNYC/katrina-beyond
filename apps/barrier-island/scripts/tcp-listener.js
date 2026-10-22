// Stand-in for the exhibit display: prints what Barrier Island sends over TCP.
//
//   node scripts/tcp-listener.js [port]     (default port 9000; Ctrl+C to stop)
//
// Messages are newline-delimited JSON (see src/lib/modelProtocol.ts). Listens on
// every network interface so a phone on the same Wi-Fi can reach it.
const net = require("net");

const port = Number(process.argv[2] ?? 9000);

net
  .createServer((socket) => {
    const who = socket.remoteAddress;
    console.log(`CONNECTED ${who}`);
    socket.on("data", (d) => console.log(`DATA ${JSON.stringify(d.toString())}`));
    socket.on("close", () => console.log(`CLOSED ${who}`));
    socket.on("error", (e) => console.log(`ERROR ${who} ${e.message}`));
  })
  .listen(port, "0.0.0.0", () => console.log(`listening on ${port}`));
