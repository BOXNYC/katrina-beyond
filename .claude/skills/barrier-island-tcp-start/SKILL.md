---
name: barrier-island-tcp-start
description: Start the local TCP listener that stands in for the Barrier Island exhibit display, and report the Mac's IP to put in the app. Use to test the app's TCP connection on the iOS simulator or a real device.
---

# Start the Barrier Island TCP test listener

Starts `apps/barrier-island/scripts/tcp-listener.js` on this Mac so Barrier Island has something to connect to. Full background and troubleshooting: `apps/barrier-island/TESTING_TCP.md`.

Optional argument: a port (default `9000`). The app's port must match (`EXPO_PUBLIC_MODEL_PORT`).

## Steps

1. Find the Mac's Wi-Fi address and check the port is free:

```bash
ipconfig getifaddr en0
lsof -nP -iTCP:9000 -sTCP:LISTEN
```

If something is already listening on the port, tell the user what it is and stop. Don't kill it.

2. Start the listener in the background, logging to a file. Run it from the monorepo root:

```bash
LOG="${TMPDIR:-/tmp}/barrier-island-tcp-listener.log"
nohup node apps/barrier-island/scripts/tcp-listener.js 9000 > "$LOG" 2>&1 < /dev/null &
sleep 1; cat "$LOG"
```

It should print `listening on 9000`.

3. Tell the user:
   - The listener's address, `<Mac IP>:<port>`, and the log path, so they can run `tail -f <log>`.
   - **Simulator:** start the app with `EXPO_PUBLIC_MODEL_HOST=127.0.0.1 EXPO_PUBLIC_MODEL_PORT=<port> npx expo run:ios` from `apps/barrier-island`. Don't run Metro with `CI=1` (it turns off file watching), and make sure no older Metro is running on 8081, or the app keeps the old host.
   - **Real device:** the host is baked into the build. Set it in the `adhoc` profile of `apps/barrier-island/eas.json` (offer to do it), commit, and rebuild. The device must be on the same Wi-Fi as the Mac, and the user must tap **Allow** on the Local Network prompt.
   - Expect `CONNECTED <address>` then `DATA "<message>"` lines when they use the app.

Never commit for the user. Remind them `eas.json` must go back to the display's real IP before the museum build.
