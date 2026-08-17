.PHONY: help start start-fast fast drivers stop preview check \
        electron electron-deps electron-build electron-run electron-clean

# Default target is help
help:
	@echo "Available make targets:"
	@echo "  make start      - Start dev server on port 4000 (runs lint, typecheck, unit tests)"
	@echo "  make start-fast - Start dev server on port 4000 bypassing health checks"
	@echo "  make fast       - Rebuild driver bundle + start dev server on port 4000 (fastest)"
	@echo "  make drivers    - Rebuild the driver bundle only"
	@echo "  make stop       - Stop the running dev server on port 4000"
	@echo "  make preview    - Build the app and serve it via Vite preview on port 4000"
	@echo "  make check      - Run ESLint, typecheck, and unit tests"
	@echo ""
	@echo "Optional desktop shell (never touches the web build):"
	@echo "  make electron       - Install deps if needed, build, and launch the desktop app"
	@echo "  make electron-deps  - Install Electron into electron/ (~100 MB, one time)"
	@echo "  make electron-build - Build UI assets to packages/ui/dist-electron"
	@echo "  make electron-run   - Launch the desktop app from the last electron build"
	@echo "  make electron-clean - Remove dist-electron/ and electron/node_modules/"

# Start the dev server on port 4000 with health checks
start:
	bash scripts/start-http.sh 4000

# Start the dev server on port 4000 bypassing health checks
start-fast:
	SKIP_HEALTH_CHECKS=1 bash scripts/start-http.sh 4000

# Rebuild the driver bundle only (packages/ui/src/drivers-bundle.json), ~0.6s
drivers:
	node scripts/bundle-drivers.mjs

.PHONY: start-4000
start-4000:
	SKIP_HEALTH_CHECKS=1 npm_config_ignore_scripts=true bash scripts/start-http.sh 4000

# FASTEST: rebuild the driver bundle + serve it on 4000.
# No lint, no typecheck, no unit tests, no DQ check.
# npm_config_ignore_scripts stops `npm run dev` firing the predev hook (bundle + lint),
# so the bundle above is the only pre-step.
fast: drivers start-4000

# Stop the dev server on port 4000
stop:
	bash scripts/stop-http.sh 4000

# Build the app and serve it via Vite preview on port 4000
preview:
	npm run build
	bash scripts/preview-4000.sh

# Run ESLint, Typecheck, and Unit tests
check:
	npm run check

# ── Optional desktop shell ───────────────────────────────────────────────────
# The web app is the product; this is a spike you can build or ignore. It is isolated on
# three axes so it cannot break the web version: electron/ sits outside the npm workspace
# (root `npm install` never fetches Electron), the ELECTRON env var is read by
# vite.config.js only when set, and its assets go to packages/ui/dist-electron rather than
# the web build's packages/ui/dist.

# Electron's binary is ~100 MB, so it is fetched on demand rather than by root install.
electron/node_modules:
	npm install --prefix electron

electron-deps: electron/node_modules

# Same UI, same engine, same driver bundle as the web build — only base/outDir/SW differ.
electron-build: drivers
	ELECTRON=1 npm run build

electron-run: electron-deps
	npm start --prefix electron

electron: electron-deps electron-build electron-run

electron-clean:
	rm -rf packages/ui/dist-electron electron/node_modules
