---
name: barrier-island-tcp-stop
description: Stop the Barrier Island TCP test listener, Metro, and the simulator app, and confirm nothing is left running.
disable-model-invocation: true
---

# Stop the Barrier Island TCP test

Shuts down everything `barrier-island-tcp-start` and the simulator test started. The app already installed on a phone or iPad is untouched: it keeps working and just retries its connection every 3 seconds.

## Steps

1. Stop the listener, Metro, and the simulator app:

```bash
pkill -f "scripts/tcp-listener.js"
pkill -f "expo start"
pkill -f "expo run:ios"
xcrun simctl terminate booted org.louisianastatemuseum.barrierisland 2>/dev/null
```

`pkill -f "expo start"` stops any Expo dev server on this Mac, including one the user started in their own terminal. That's the point of this skill, but say so in the summary.

2. Confirm nothing is still running. Each of these should print nothing:

```bash
lsof -nP -iTCP:9000 -sTCP:LISTEN
lsof -nP -iTCP:8081 -sTCP:LISTEN
pgrep -fl "tcp-listener.js|expo start|expo run:ios"
```

If the listener used a different port, check that port too.

3. Report what was stopped. Leave the log file in place (`${TMPDIR:-/tmp}/barrier-island-tcp-listener.log`) in case they want to read it. Remind the user that `eas.json` may still point at the Mac and needs the display's real IP before the museum build.
