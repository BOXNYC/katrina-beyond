# Testing TCP on my Mac locally

Use your Mac as a stand-in for the exhibit display. The app sends its messages
(`set` and `simulate`, one JSON object per line) over TCP, and a small listener
on your Mac prints them. Use this to check the connection on the iOS simulator
or on a real iPhone/iPad before the real display is available.

Same markers as [DISTRIBUTION.md](DISTRIBUTION.md): 🧑 **MANUAL** = you do it,
🤖 **ASK CLAUDE** = paste the prompt into Claude Code from this repo.

---

## Starting

### 1. 🧑 MANUAL: Find your Mac's address
The phone or iPad must be on the **same Wi-Fi network** as your Mac (not
cellular, and not a guest network).
```
ipconfig getifaddr en0
```
Your Mac's address can change when it joins a different network or renews its
lease, so check it each time. The simulator doesn't need it: it uses `127.0.0.1`.

### 2. 🧑 MANUAL: Start the listener
In a terminal at the repo root:
```
node apps/barrier-island/scripts/tcp-listener.js
```
It prints `listening on 9000` and then one line per event:
`CONNECTED <address>`, `DATA "<message>"`, `CLOSED <address>`. Leave this
terminal open. Use another port with `node apps/barrier-island/scripts/tcp-listener.js 9100`
(then set the app's port to match).

> 🤖 Or ask: "Start a TCP listener on my Mac for barrier-island and tell me the
> IP to use." Claude runs it in the background and reads the log for you.

### 3. Point the app at the listener

**On the iOS simulator.** The host is read when Metro bundles the app, so set
it when you start the app:
```
EXPO_PUBLIC_MODEL_HOST=127.0.0.1 EXPO_PUBLIC_MODEL_PORT=9000 npx expo run:ios
```
Run this from `apps/barrier-island`. If Metro is already running, stop it first
(see Stopping): a Metro that was started without these variables keeps serving
the old address.

**On a real device (ad hoc build).** The host and port are baked into the build,
so set them in `eas.json` (the `adhoc` profile → `env`), commit, and build again:
> 🤖 "Set the barrier-island display host to `<your Mac's IP>` and port `9000`
> in eas.json."

Then follow [DISTRIBUTION.md, Section 4](DISTRIBUTION.md#4-build-the-app).

### 4. 🧑 MANUAL: Test
1. Open the app. The listener should print `CONNECTED`. On a device, tap **Allow**
   when iOS shows the **Local Network** prompt. If you missed it: **Settings →
   Privacy & Security → Local Network → Barrier Island → On**.
2. Tap **Touch to begin**, toggle a switch, and tap **Simulate**.
3. Each action prints a `DATA` line within a second, for example
   `{"command":"set","option":"levee","level":2}`.

The app connects at launch and retries every 3 seconds, so it connects within
a few seconds of the listener starting, in either order. If the connection
drops, it reconnects and re-sends the latest level of each option.

---

## Stopping

### 1. 🧑 MANUAL: Stop the listener
Press **Ctrl+C** in the terminal where it's running. If Claude started it:
```
pkill -f scripts/tcp-listener.js
```

### 2. 🧑 MANUAL: Stop Metro and the simulator app
Press **Ctrl+C** in the terminal running `expo run:ios` or `expo start`, or:
```
pkill -f "expo start"; pkill -f "expo run:ios"
xcrun simctl terminate booted org.louisianastatemuseum.barrierisland
```

### 3. 🧑 MANUAL: Confirm nothing is still running
```
lsof -nP -iTCP:9000 -sTCP:LISTEN
lsof -nP -iTCP:8081 -sTCP:LISTEN
```
Both should print nothing.

**The app on your phone or iPad keeps working.** A standalone build doesn't need
anything on your Mac. It just retries the connection every 3 seconds and fails
quietly until a display is reachable.

**Before the museum build:** `eas.json` still points to your Mac. Replace the host
with the display's real IP and port ([DISTRIBUTION.md, 2.4](DISTRIBUTION.md#24--ask-claude-set-the-displays-address))
and build again.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Nothing ever prints on the listener | The app has the wrong host, or the phone isn't on your Mac's network | Check your Mac's address (step 1) and that the build used it. A simulator started with Metro already running may be using an old host. |
| Simulator shows `[model]` lines in the console but the listener is silent | Metro was started without `EXPO_PUBLIC_MODEL_HOST` | Stop Metro and restart it with the variables (step 3) |
| Phone connects, then nothing after a while | Local Network permission denied, or the Mac slept | Turn the permission on; keep the Mac awake while testing |
| Metro doesn't pick up code changes | It was started with `CI=1`, which turns off file watching | Restart it without `CI=1` |
| "Open debugger to view warnings" bar covers the bottom of the app (simulator) | The app can't reach the listener and logs a warning every 3 seconds | Start the listener. Dismiss the bar with its **X**; clicking the bar opens DevTools. |
