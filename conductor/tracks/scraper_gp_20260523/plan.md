# Implementation Plan - GP Availability Scraper

## Phase 1: Project Scaffolding & Setup
- [ ] Task: Set up core configuration files and folder structures
    - [ ] Create `.gitignore` to exclude `.env`, `auth_state.json`, `medici_snapshot.json`, and `node_modules`
    - [ ] Create `package.json` with ESM enabled (`"type": "module"`) and scripts configured (`start`, `check-once`, `test`)
    - [ ] Create `.env.example` precompiled with standard SMTP and notification variables
- [ ] Task: Install dependencies and browser binaries
    - [ ] Install production dependencies: `playwright`, `nodemailer`, `dotenv`
    - [ ] Install Playwright Chromium browser binaries using the Playwright CLI
- [ ] Task: Conductor - User Manual Verification 'Phase 1: Project Scaffolding & Setup' (Protocol in workflow.md)

## Phase 2: Configuration & Notification Modules
- [ ] Task: Write Tests for configuration and notification modules (Red Phase)
    - [ ] Create test file `test/config.test.js` to verify environment validation and default settings
    - [ ] Create test file `test/notifier.test.js` to verify email generation structure and SMTP triggers
- [ ] Task: Implement configuration and notification modules (Green Phase)
    - [ ] Create `lib/config.js` to load and validate environment parameters
    - [ ] Create `lib/notifier.js` to generate premium HTML tables and send emails via Nodemailer
    - [ ] Run tests and verify they pass with high coverage
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Configuration & Notification Modules' (Protocol in workflow.md)

## Phase 3: Session Persistence & Delta Detection Modules
- [ ] Task: Write Tests for session persistence and historical comparison (Red Phase)
    - [ ] Create test file `test/session.test.js` to verify JSON read/write of state and expiration detections
    - [ ] Create test file `test/comparer.test.js` to verify comparison logic between current and baseline snapshots
- [ ] Task: Implement session persistence and historical comparison (Green Phase)
    - [ ] Create `lib/session.js` to read/write `auth_state.json` and validate cookies/storage
    - [ ] Create `lib/comparer.js` to load/save `medici_snapshot.json` and isolate new GPs or freed slots
    - [ ] Run tests and verify they pass with high coverage
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Session Persistence & Delta Detection Modules' (Protocol in workflow.md)

## Phase 4: Scraper Core, Orchestration & Main Loop
- [ ] Task: Implement Playwright browser automation
    - [ ] Create `lib/scraper.js` containing Playwright workflows:
        - [ ] Login Mode: Navigate to FSE homepage, wait for manual CIE login, save context to `auth_state.json`, and close
        - [ ] Scraping Mode: Load context, directly navigate to GP Choice, input/filter "Melegnano" and "Cerro al Lambro", and scrape available physicians
- [ ] Task: Implement Orchestrator and Main Loop
    - [ ] Create `index.js` as the main script entry point
    - [ ] Orchestrate the cycle:
        - [ ] Check if `auth_state.json` exists. If not, trigger Login Mode
        - [ ] Run verification scraper: extract data, run delta check, trigger alert email if changes found, update snapshot
        - [ ] Implement error handling: if session is expired, send alert email and await user action; if network failure, log and retry in 15 mins
        - [ ] Setup infinite 15-minute interval or cron-based loop
- [ ] Task: Conductor - User Manual Verification 'Phase 4: Scraper Core, Orchestration & Main Loop' (Protocol in workflow.md)
