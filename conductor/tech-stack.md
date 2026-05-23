# Technology Stack - Scraper Medico (FSE Lombardia)

## Core Runtime & Language
- **Node.js (v18+)**: Runtime robusto e moderno per script lato server ed automazione locale.
- **JavaScript (ES Modules / ESM)**: Uso della sintassi moderna (`import`/`export`) per importare nativamente i moduli, garantendo pulizia e modularità.

## Librerie Principali (Dependencies)
- **`playwright`**: Framework leader per l'automazione del browser. Utilizzato con il browser Chromium integrato in modalità visibile (`headed: true`) per consentire il login manuale tramite CIE/SPID e l'interazione visiva locale.
- **`nodemailer`**: Libreria per l'invio delle e-mail di notifica in modo efficiente via SMTP, con supporto per HTML avanzato.
- **`dotenv`**: Per caricare le credenziali SMTP ed e-mail da un file locale `.env` non tracciato su Git.

## Memorizzazione Dati (Storage)
- **JSON nativo (File locali)**:
  - `auth_state.json`: Per persistere i cookie ed il localStorage del browser context, bypassando il login CIE/SPID tra un avvio e l'altro.
  - `medici_snapshot.json`: Per salvare la lista dei medici precedentemente scansionati e confrontare i dati per rilevare cambiamenti di disponibilità.

## Strumenti di Sviluppo (Development Tools)
- **Git**: Per il controllo di versione.
- **npm / package.json**: Per la gestione delle dipendenze e l'avvio facilitato dello script (es. `npm start`).
