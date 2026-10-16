#!/bin/bash
# Change directory to where this script is located
cd "$(dirname "$0")" || exit 1
ROOT_DIR="$(pwd)"

PORT=3000
APP_DIR="$ROOT_DIR/apps/katrina-beyond"
PNPM_VERSION=12.8.1
URL="http://localhost:$PORT/electric-grid"

port_listening() {
    lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1
}

fail() {
    echo "$1"
    read -r -p "Press Enter to close..."
    exit 1
}

launch() {
    # Make sure Chrome is installed
    if [ ! -d "/Applications/Google Chrome.app" ] && [ ! -d "$HOME/Applications/Google Chrome.app" ]; then
        if command -v brew >/dev/null 2>&1; then
            echo "Google Chrome not found. Installing..."
            brew install --cask google-chrome
        fi
    fi

    # Launch Chrome in full-screen app mode, or the default browser as a fallback
    if [ -d "/Applications/Google Chrome.app" ] || [ -d "$HOME/Applications/Google Chrome.app" ]; then
        open -na "Google Chrome" --args --kiosk --app="$URL"
    else
        echo "Could not install Chrome. Opening the default browser instead."
        open "$URL"
    fi
    exit 0
}

# Check whether something is already listening on the port
if port_listening; then
    echo "Server already running on port $PORT."
    launch
fi

# ---- Prerequisites: Node.js and pnpm ----

if ! command -v node >/dev/null 2>&1; then
    command -v brew >/dev/null 2>&1 || fail "Node.js not found. Please install Node.js LTS from https://nodejs.org and run this again."
    echo "Node.js not found. Installing Node.js..."
    brew install node || fail "Node.js installation failed."
fi

if ! command -v pnpm >/dev/null 2>&1; then
    echo "pnpm not found. Installing pnpm $PNPM_VERSION..."
    npm install -g "pnpm@$PNPM_VERSION" || fail "pnpm installation failed."
    hash -r
    command -v pnpm >/dev/null 2>&1 || fail "pnpm was installed but is not on the PATH."
fi

# ---- Dependencies and build ----

# Install dependencies if they haven't been installed yet
# Only the website and what it depends on are installed
if [ ! -d "$ROOT_DIR/node_modules" ] || [ ! -d "$APP_DIR/node_modules" ]; then
    echo "node_modules not found. Installing dependencies..."
    (cd "$ROOT_DIR" && pnpm install --filter 'katrina-beyond...') || fail "Dependency installation failed."
fi

# Build once if there is no production build yet
if [ ! -f "$APP_DIR/.next/BUILD_ID" ]; then
    echo "No production build found. Building..."
    (cd "$APP_DIR" && pnpm build) || fail "Build failed."
fi

# Start the Next.js server in the background, logging to a file
echo "Starting server..."
(cd "$APP_DIR" && nohup pnpm start -p "$PORT" >"$ROOT_DIR/katrina-beyond-server.log" 2>&1 &)

# Wait up to 60 seconds for the server to start listening
for _ in $(seq 1 60); do
    sleep 1
    if port_listening; then
        launch
    fi
done

fail "Server failed to start within 60 seconds. See katrina-beyond-server.log."
