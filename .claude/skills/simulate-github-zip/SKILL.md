---
name: simulate-github-zip
description: Delete git-ignored files (node_modules, .next, .turbo, etc.) so the monorepo matches a fresh GitHub zip download, to test the launchers from a clean state.
disable-model-invocation: true
---

# Simulate the GitHub zip

Reset the monorepo to the state the client gets when they download the zip from GitHub, so the launchers (`LAUNCH_ELECTRIC_GRID.bat` / `MACOS_LAUNCH_ELECTRIC_GRID.command`) can be tested from scratch.

Only files covered by `.gitignore` are removed. Never delete `.gitignore` files, `pnpm-lock.yaml` or any source files.

## Steps

1. From the monorepo root (the folder containing `pnpm-workspace.yaml`), run:

```bash
# Stop anything already serving on port 3000, otherwise the launcher skips install and build
lsof -ti:3000 | xargs kill 2>/dev/null

# Remove everything git ignores
rm -rf node_modules apps/*/node_modules \
       .turbo apps/*/.turbo \
       apps/katrina-beyond/.next \
       apps/katrina-beyond/next-env.d.ts \
       apps/katrina-beyond/tsconfig.tsbuildinfo \
       apps/barrier-island/.expo \
       katrina-beyond-server.log
find . -name .DS_Store -delete
```

2. Confirm nothing is left behind: `ls -a . apps/katrina-beyond` should show no `node_modules`, `.next` or `.turbo`, and `pnpm-lock.yaml` should still exist.

3. Tell the user to double-click `MACOS_LAUNCH_ELECTRIC_GRID.command`. It should install dependencies, build, start the server and open Chrome fullscreen at `/electric-grid`.

## Notes

- The Mac already has Node and pnpm, so this does not exercise the "install Node/pnpm" path. To test that, run the launcher from a shell without them on the PATH.
- If the list of git-ignored paths changes (check each `.gitignore`), update the `rm` command here.
