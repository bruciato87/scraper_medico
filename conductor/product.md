# Initial Concept

Local automation script in Node.js using Playwright to check GP availability for Melegnano and Cerro al Lambro every 15 minutes, with email alerts on updates or session expiry.

---

# Product Guide - Scraper Medico di Medicina Generale (FSE Lombardia)

## Visione del Prodotto
Un'applicazione di automazione locale resiliente e robusta per monitorare in tempo reale (ogni 15 minuti) la disponibilità di Medici di Medicina Generale (MMG) nei comuni di Melegnano e Cerro al Lambro sul portale del Fascicolo Sanitario Elettronico (FSE) di Regione Lombardia. L'applicazione notifica immediatamente l'utente via e-mail in caso di modifiche (nuovi medici o posti liberati), consentendo di agire tempestivamente per cambiare il proprio medico prima che i posti si esauriscano nuovamente.

## Requisiti Funzionali

### 1. Gestione Sessione ed Autenticazione (Bypass CIE/SPID)
- **Persistenza dello Stato:** Salvataggio e caricamento del contesto del browser (cookie e localStorage) nel file locale `auth_state.json`.
- **Autenticazione Iniziale / Scaduta:**
  - Se `auth_state.json` non esiste o la sessione è scaduta:
    - Apre il browser Chromium in modalità **headed** (visibile) alla pagina pubblica: `https://www.fascicolosanitario.regione.lombardia.it/web/fserl-pubblica/`.
    - Attende che l'utente esegua manualmente il login (ad es. tramite CIE / SPID).
    - Monitora la navigazione. Una volta rilevato il redirect riuscito all'area riservata di scelta/cambio del medico, salva lo stato del browser context in `auth_state.json` e chiude il browser.
- **Accesso Diretto:** Se `auth_state.json` è presente e valido, avvia il browser ed accede direttamente alla pagina di ricerca senza richiedere alcun login manuale.

### 2. Procedura di Monitoraggio Periodico (Ogni 15 Minuti)
- **Intervallo:** Esecuzione ciclica tramite un loop infinito controllato (es. `setInterval` o ciclo `while` con delay) ogni 15 minuti.
- **Navigazione e Ricerca:**
  - Naviga alla pagina di scelta del medico.
  - Compila i campi di ricerca per selezionare i comuni di **Melegnano** e **Cerro al Lambro** (gestendo opportunamente dropdown, autocompletamento o filtri presenti sulla pagina).
- **Estrazione Dati:** Estrae l'elenco dei medici visualizzati con i relativi dettagli (Nome, Cognome, Ambito, Indirizzo, Disponibilità/Posti).
- **Confronto Storico (`medici_snapshot.json`):**
  - Carica l'elenco salvato in `medici_snapshot.json`.
  - Rileva:
    - **Nuovi medici:** Medici presenti nell'elenco attuale ma non nello snapshot.
    - **Posti liberati:** Medici che precedentemente avevano posti esauriti (o non erano presenti con posti disponibili) e ora hanno posti liberi.
  - Aggiorna il file `medici_snapshot.json` con lo stato attuale dopo il confronto.

### 3. Sistema di Notifica E-mail
- **Tecnologia:** Utilizzo di `nodemailer` tramite server SMTP configurato in `.env`.
- **Notifica Nuova Disponibilità:**
  - Oggetto: `[FSE] Nuovo Medico Disponibile!`
  - Corpo (Testo e HTML): Dettagli del medico/i rilevato/i con posti disponibili.
- **Notifica Sessione Scaduta:**
  - Inviata quando lo script rileva che la sessione automatica è scaduta (es. reindirizzamento alla pagina di login, o errore di caricamento dati protetti).
  - Oggetto: `[FSE] Sessione Scaduta - Richiesto Login Manuale`
  - Corpo: Avviso all'utente di riattaccarsi al terminale per effettuare nuovamente il login manuale e rigenerare `auth_state.json`.

## Requisiti Non Funzionali e Tecnologici
- **Linguaggio/Runtime:** Node.js (JavaScript/ESM).
- **Librerie Principali:**
  - `playwright` (Chromium in modalità headed per interazione umana ed esecuzione visibile).
  - `nodemailer` (per l'invio delle e-mail di notifica).
  - `dotenv` (per la configurazione da file `.env`).
- **Resilienza e Robustezza:**
  - Gestione dei selettori CSS/XPath flessibili per evitare rotture dovute a ID dinamici.
  - Ritardi casuali (human-like delay) tra le operazioni per evitare blocchi anti-bot.
  - Gestione accurata degli errori: in caso di timeout o errore temporaneo, lo script non deve crashare ma riprovare al ciclo successivo o inviare la notifica di sessione scaduta se l'errore persiste.
- **Sicurezza:** Le credenziali e-mail SMTP non sono cablate nel codice, ma lette esclusivamente da `.env`.
