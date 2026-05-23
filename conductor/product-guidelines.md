# Product Guidelines - Scraper Medico di Medicina Generale (FSE Lombardia)

## Principi di Sviluppo ed Esperienza Utente

### 1. Trasparenza dell'Automazione e Log (Automation UX)
- Lo script viene eseguito localmente in modalità headed. Deve fornire un feedback visivo e testuale immediato a console per ogni azione svolta.
- Ogni operazione deve essere tracciata con un timestamp leggibile. Esempi di log a console:
  - `[2026-05-23 11:45:00] [INFO] Avvio del ciclo di verifica.`
  - `[2026-05-23 11:45:02] [INFO] Sessione trovata in auth_state.json. Tentativo di caricamento context...`
  - `[2026-05-23 11:45:05] [INFO] Navigazione alla pagina di scelta del medico riuscita.`
  - `[2026-05-23 11:45:10] [SUCCESS] Scansione Melegnano completata: 3 medici trovati.`

### 2. Comportamento Umano e Controllo Anti-Bot (Anti-Bot & Human-like)
- Utilizzare ritardi casuali realistici (da 1 a 4 secondi) per simulare l'attesa di un utente reale prima di fare click o selezionare opzioni.
- Utilizzare l'inserimento dei caratteri simulato (es. digitazione tastiera con delay casuale tra 50ms e 150ms per tasto) per i campi di testo dei comuni.
- Muovere il mouse o fare click in elementi stabili per simulare l'attenzione dell'utente.

### 3. Resilienza dei Selettori (Locator Resilience)
- Evitare selettori fragili (es. classi CSS autogenerate come `.sc-xyz123` o selettori XPath assoluti lunghissimi).
- Favorire localizzatori semantici stabili come:
  - `page.getByRole('button', { name: 'Accedi' })`
  - `page.getByLabel('Comune')`
  - Testi o attributi `data-*` se disponibili.
  - Selettori basati sulla struttura gerarchica stabile del DOM (es. righe di tabella contenenti specifiche colonne).

### 4. Tolleranza agli Errori e Prevenzione dello Spam (Error Resilience & Spam Prevention)
- In caso di timeout di rete o errori temporanei di caricamento pagina: lo script non deve crashare (utilizzare blocchi `try...catch` a livello di ciclo). Loggare l'errore e ritentare al ciclo successivo (15 minuti dopo).
- In caso di **Scadenza Sessione**:
  - Rilevare se la navigazione viene reindirizzata al login o se mancano i permessi.
  - Inviare l'email di avviso `[FSE] Sessione Scaduta - Richiesto Login Manuale`.
  - Sospendere i cicli automatici di verifica (o attendere passivamente il ripristino manuale dell'utente) per **evitare di inviare email di errore ogni 15 minuti**. Lo script deve riprendere solo dopo che l'utente ha completato con successo il login manuale e rigenerate `auth_state.json`.

### 5. Linee Guida di Sicurezza e Riservatezza (Security & Privacy)
- File sensibili come `.env` (contenente password SMTP), `auth_state.json` (contenente i cookie di sessione personali dell FSE) e `medici_snapshot.json` (storico locale) **devono** essere ignorati da Git tramite `.gitignore`.
- Lo stato della sessione (`auth_state.json`) deve essere trattato come una chiave d'accesso personale.
