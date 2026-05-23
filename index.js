import { config } from './lib/config.js';
import { hasSession, loadSession, isSessionValid } from './lib/session.js';
import { runManualLogin, scrapeGPAvailability } from './lib/scraper.js';
import { getChangesAndUpdateSnapshot } from './lib/comparer.js';
import { sendEmail } from './lib/notifier.js';

// Format current date-time for logs
function getTimestamp() {
  return new Date().toLocaleString('it-IT', { timeZone: 'Europe/Rome' });
}

let isScraperRunning = false;
let sessionExpiredAlertSent = false;

async function runCycle() {
  if (isScraperRunning) {
    console.log(`[${getTimestamp()}] [INFO] Il ciclo precedente è ancora in corso. Salto questo turno.`);
    return;
  }

  isScraperRunning = true;
  console.log(`\n--- [${getTimestamp()}] AVVIO VERIFICA DISPONIBILITÀ MEDICI ---`);

  try {
    const sessionExists = await hasSession();

    if (!sessionExists) {
      console.log(`[${getTimestamp()}] [INFO] File auth_state.json non trovato.`);
      const success = await runManualLogin();
      if (!success) {
        throw new Error('manual_login_failed');
      }
      // Session has been created, run the scraper immediately
      console.log(`[${getTimestamp()}] [INFO] Login manuale completato con successo. Avvio scansione...`);
    }

    // Attempt to scrape GP availability
    const doctors = await scrapeGPAvailability();
    
    // Reset the alert state since the session was verified as valid
    sessionExpiredAlertSent = false;

    console.log(`[${getTimestamp()}] [SUCCESS] Estratti ${doctors.length} medici totali.`);

    // Check for changes against the baseline snapshot
    const changes = await getChangesAndUpdateSnapshot(doctors);
    const forceEmail = process.env.FORCE_EMAIL === 'true';

    if (changes.length > 0 || forceEmail) {
      if (changes.length > 0) {
        console.log(`[${getTimestamp()}] [SUCCESS] Rilevati ${changes.length} medici con novità/posti liberi!`);
        changes.forEach((m) => {
          const type = m.isNew ? 'NUOVO MEDICO' : 'POSTI LIBERATI';
          console.log(` -> [${type}] ${m.firstName} ${m.lastName} - Comune: ${m.scope} - Posti: ${m.spots} - Via: ${m.address}`);
        });
      } else {
        console.log(`[${getTimestamp()}] [INFO] Nessun cambio di disponibilità rilevato, ma invio e-mail forzato (FORCE_EMAIL=true).`);
      }

      // Send alert email
      console.log(`[${getTimestamp()}] [INFO] Invio notifica e-mail in corso...`);
      const emailData = changes.length > 0 ? changes : [{
        firstName: 'Nessun medico',
        lastName: 'disponibile al momento',
        scope: 'Stato scansione',
        address: 'Scansione completata con successo',
        spots: 0,
        isNew: false
      }];
      await sendEmail('new_gp', emailData);
    } else {
      console.log(`[${getTimestamp()}] [INFO] Nessun cambio di disponibilità rilevato rispetto all'ultimo snapshot.`);
    }

  } catch (error) {
    if (error.message === 'session_expired') {
      console.error(`[${getTimestamp()}] [ERROR] Sessione scaduta o non più valida.`);
      
      if (!sessionExpiredAlertSent) {
        console.log(`[${getTimestamp()}] [INFO] Invio notifica e-mail di sessione scaduta...`);
        await sendEmail('session_expired');
        sessionExpiredAlertSent = true;
      }

      console.log(`[${getTimestamp()}] [ACTION REQUIRED] Richiesto nuovo login manuale.`);
      const success = await runManualLogin();
      if (success) {
        sessionExpiredAlertSent = false;
        console.log(`[${getTimestamp()}] [SUCCESS] Nuova sessione registrata. Il monitoraggio riprenderà al prossimo ciclo.`);
      }
    } else if (error.message === 'manual_login_failed') {
      console.error(`[${getTimestamp()}] [FATAL] Impossibile procedere senza sessione valida.`);
    } else {
      // General error (network timeout, FSE portal temporary down, etc.)
      console.error(`[${getTimestamp()}] [ERROR] Errore durante il ciclo di verifica:`, error.message);
      console.log(`[${getTimestamp()}] [INFO] Lo script rimarrà in esecuzione e riproverà al prossimo ciclo (tra ${config.CHECK_INTERVAL_MINUTES} minuti).`);
    }
  } finally {
    isScraperRunning = false;
    console.log(`--- [${getTimestamp()}] FINE VERIFICA DISPONIBILITÀ ---`);
  }
}

// Main execution entrypoint
async function main() {
  const checkOnce = process.env.CHECK_ONCE === 'true';

  if (checkOnce) {
    console.log('[INFO] Esecuzione in modalità diagnostica singola (CHECK_ONCE=true).');
    await runCycle();
    process.exit(0);
  } else {
    console.log(`[INFO] Avvio dello Scraper Medico in loop continuo.`);
    console.log(`[INFO] Intervallo di verifica impostato a: ogni ${config.CHECK_INTERVAL_MINUTES} minuti.`);
    
    // Initial run
    await runCycle();

    // Schedule subsequent runs
    const intervalMs = config.CHECK_INTERVAL_MINUTES * 60 * 1000;
    setInterval(runCycle, intervalMs);
  }
}

main().catch((err) => {
  console.error('[FATAL] Errore imprevisto nello script principale:', err);
  process.exit(1);
});
