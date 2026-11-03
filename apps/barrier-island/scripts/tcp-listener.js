// Stand-in for the exhibit display: prints what Barrier Island sends over TCP.
//
//   node scripts/tcp-listener.js [port]     (default port 9000; Ctrl+C to stop)
//
// The app sends `Sim,<island>,<landbridge>,<ridge>,<levee>\r` (see
// src/lib/modelProtocol.ts). Type `r` + Enter here to send `Reset\r` back, as the
// show controller does when the simulation is done. Listens on every network
// interface so a phone on the same Wi-Fi can reach it.
const net = require("net");

const port = Number(process.argv[2] ?? 9000);

const clients = new Set();
process.stdin.on("data", (d) => {
  if (d.toString().trim().toLowerCase() !== "r") return;
  for (const c of clients) c.write("Reset\r");
  console.log(`SENT "Reset\\r" to ${clients.size} client(s)`);
});

net
  .createServer((socket) => {
    const who = socket.remoteAddress;
    clients.add(socket);
    console.log(`CONNECTED ${who}`);
    socket.on("data", (d) => console.log(`DATA ${JSON.stringify(d.toString())}`));
    socket.on("close", () => clients.delete(socket) && console.log(`CLOSED ${who}`));
    socket.on("error", (e) => console.log(`ERROR ${who} ${e.message}`));
  })
  .listen(port, "0.0.0.0", () => console.log(`listening on ${port}`));
