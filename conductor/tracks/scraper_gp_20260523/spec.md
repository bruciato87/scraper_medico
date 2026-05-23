# Specification - GP Availability Scraper (FSE Lombardia)

## 1. Overview
Automated local Node.js script using Playwright and Nodemailer to regularly monitor GP (General Practitioner / Medico di Medicina Generale) availability for the municipalities of Melegnano and Cerro al Lambro on the "Fascicolo Sanitario Elettronico" (FSE) portal of Regione Lombardia. The script persists authentication context to bypass CIE/SPID, extracts available GPs, checks for updates against a local baseline snapshot, and sends rich HTML email notifications on new availabilities or session expiry.

## 2. Functional Requirements

### 2.1 Session & State Management
- **Persistence:** Save and load cookies/localStorage in a local file named `auth_state.json`.
- **First Run or Expired Session:**
  - Open Chromium in **headed** (visible) mode to the FSE portal public homepage: `https://www.fascicolosanitario.regione.lombardia.it/web/fserl-pubblica/`.
  - Pause and wait for the user to perform manual login (e.g., via CIE or SPID).
  - Monitor navigation and detect successful redirection to the GP choice restricted area.
  - Automatically save the new browser context to `auth_state.json` and exit/close the browser.
- **Subsequent Runs:**
  - Launch browser using the saved context in `auth_state.json`.
  - Navigate directly to the GP choice page.
  - If redirected to a login/expired page, log the event, trigger the "Session Expired" email alert, and wait for the user to execute manual login again.

### 2.2 Scraper & Verification Cycle
- **Scheduler:** Run checking loop every 15 minutes.
- **Form Interacting:**
  - Select or enter "Melegnano" and "Cerro al Lambro" in the search filters (handling dropdown selection, text input autocompletion, or dynamic filters).
- **Data Extraction:**
  - Extract list of GPs containing: First Name, Last Name, Scope/Ambito, Address, and Available Spots/Posti.

### 2.3 Delta Detection & Snapshots
- **Baseline Storage:** Compare extracted GPs against the local history stored in `medici_snapshot.json`.
- **First Run Behavior:** If `medici_snapshot.json` doesn't exist, save the current GPs as the initial baseline silently without sending a notification.
- **Delta Rules:** Trigger email alert if:
  - A GP is detected that was not in `medici_snapshot.json`.
  - A GP previously marked as full (`Posti disponibili: 0` or similar) now has available spots (`Posti disponibili > 0`).

### 2.4 Notification System
- **SMTP Settings:** Read configuration from a local `.env` file (supporting `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASS`, and `EMAIL_TO`).
- **Alert Types:**
  - **New GP / Spots Alert:**
    - Subject: `[FSE] Nuovo Medico Disponibile!`
    - Format: Sleek HTML table with the details of the available GPs, highlighting new entries.
  - **Session Expired Alert:**
    - Subject: `[FSE] Sessione Scaduta - Richiesto Login Manuale`
    - Format: Informative text alerting the user to re-attach to the terminal and log in.

### 2.5 Resiliency & Bot Bypass
- **Human-like Delays:** Add random delays (1-4 seconds) and keypress delays (50-150ms) to bypass basic anti-bot blocks.
- **Error Tolerance:** Use try/catch blocks. If a transient network error occurs, do not crash; log and try again at the next 15-minute mark.

## 3. Technical Requirements & Architecture
- **Runtime:** Node.js (v18+, ES Modules).
- **Dependencies:** `playwright`, `nodemailer`, `dotenv`.
- **Local JSON Files:** `auth_state.json`, `medici_snapshot.json`.
- **Git Ignore:** Ensure `.env`, `auth_state.json`, and `medici_snapshot.json` are excluded from version control.

## 4. Acceptance Criteria
- [ ] Script successfully saves cookies and local storage to `auth_state.json` upon manual FSE login.
- [ ] On subsequent runs, if `auth_state.json` is valid, it directly scans GP availability without prompting for credentials.
- [ ] Search query correctly filters Melegnano and Cerro al Lambro.
- [ ] Comparing results with `medici_snapshot.json` correctly identifies new GPs or newly opened slots.
- [ ] Premium HTML e-mail is sent with a beautiful grid format when GP changes are detected.
- [ ] E-mail alert is sent when the session expires, notifying the user that manual login is required.
- [ ] The scraper runs in a continuous loop every 15 minutes and can be easily managed using NPM scripts (`npm start` and `npm run check-once`).
