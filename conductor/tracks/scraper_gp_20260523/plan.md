# Implementation Plan - GP Availability Scraper

## Phase 1: Project Scaffolding & Setup
- [x] Task: Set up core configuration files and folder structures
    - [x] Create `.gitignore` to exclude `.env`, `auth_state.json`, `medici_snapshot.json`, and `node_modules`
    - [x] Create `package.json` with ESM enabled (`"type": "module"`) and scripts configured (`start`, `check-once`, `test`)
    - [x] Create `.env.example` precompiled with standard SMTP and notification variables
- [x] Task: Install dependencies and browser binaries
    - [x] Install production dependencies: `playwright`, `nodemailer`, `dotenv`
    - [x] Install Playwright Chromium browser binaries using the Playwright CLI
- [x] Task: Conductor - User Manual Verification 'Phase 1: Project Scaffolding & Setup' (Protocol in workflow.md) (a648d44)

## Phase 2: Configuration & Notification Modules
- [x] Task: Write Tests for configuration and notification modules (Red Phase)
    - [x] Create test file `test/config.test.js` to verify environment validation and default settings
    - [x] Create test file `test/notifier.test.js` to verify email generation structure and SMTP triggers
- [x] Task: Implement configuration and notification modules (Green Phase)
    - [x] Create `lib/config.js` to load and validate environment parameters
    - [x] Create `lib/notifier.js` to generate premium HTML tables and send emails via Nodemailer
    - [x] Run tests and verify they pass with high coverage
- [x] Task: Conductor - User Manual Verification 'Phase 2: Configuration & Notification Modules' (Protocol in workflow.md) (75ea62f)

## Phase 3: Session Persistence & Delta Detection Modules
- [x] Task: Write Tests for session persistence and historical comparison (Red Phase)
    - [x] Create test file `test/session.test.js` to verify JSON read/write of state and expiration detections
    - [x] Create test file `test/comparer.test.js` to verify comparison logic between current and baseline snapshots
- [x] Task: Implement session persistence and historical comparison (Green Phase)
    - [x] Create `lib/session.js` to read/write `auth_state.json` and validate cookies/storage
    - [x] Create `lib/comparer.js` to load/save `medici_snapshot.json` and isolate new GPs or freed slots
    - [x] Run tests and verify they pass with high coverage
- [x] Task: Conductor - User Manual Verification 'Phase 3: Session Persistence & Delta Detection Modules' (Protocol in workflow.md) (8617a9c)

## Phase 4: Scraper Core, Orchestration & Main Loop
- [x] Task: Implement Playwright browser automation
    - [x] Create `lib/scraper.js` containing Playwright workflows:
        - [x] Login Mode: Navigate to FSE homepage, wait for manual CIE login, save context to `auth_state.json`, and close
        - [x] Scraping Mode: Load context, directly navigate to GP Choice, input/filter "Melegnano" and "Cerro al Lambro", and scrape available physicians
- [x] Task: Implement Orchestrator and Main Loop
    - [x] Create `index.js` as the main script entry point
    - [x] Orchestrate the cycle:
        - [x] Check if `auth_state.json` exists. If not, trigger Login Mode
        - [x] Run verification scraper: extract data, run delta check, trigger alert email if changes found, update snapshot
        - [x] Implement error handling: if session is expired, send alert email and await user action; if network failure, log and retry in 15 mins
        - [x] Setup infinite 15-minute interval or cron-based loop
- [x] Task: Conductor - User Manual Verification 'Phase 4: Scraper Core, Orchestration & Main Loop' (Protocol in workflow.md) (8022da9)
