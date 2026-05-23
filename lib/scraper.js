import { chromium } from 'playwright';
import { saveSession, loadSession, isSessionValid } from './session.js';

// Random human-like delay helper
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms + Math.random() * 1000));

// Global active browser state to keep the same window open and authenticated
let activeBrowser = null;
let activeContext = null;
let activePage = null;

/**
 * Returns the active page, launching the browser if not already open or connected.
 */
export async function getActivePage() {
  if (activeBrowser && activePage && activeBrowser.isConnected()) {
    return activePage;
  }

  console.log('[INFO] Avvio di un nuovo browser Chromium stealth...');
  const stateExists = await hasSession();

  activeBrowser = await chromium.launch({ headless: false });
  
  const contextOptions = {
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    locale: 'it-IT',
    timezoneId: 'Europe/Rome'
  };

  if (stateExists) {
    const state = await loadSession();
    contextOptions.storageState = { cookies: state.cookies, origins: state.origins };
  }

  activeContext = await activeBrowser.newContext(contextOptions);

  // Restore sessionStorage if exists
  if (stateExists) {
    const state = await loadSession();
    if (state.sessionStorage) {
      await activeContext.addInitScript((storages) => {
        window.addEventListener('DOMContentLoaded', () => {
          try {
            const currentUrl = window.location.href;
            const match = storages.find(
              (s) => currentUrl.startsWith(s.url) || s.url.includes(window.location.hostname)
            );
            if (match && match.storage) {
              for (const [key, val] of Object.entries(match.storage)) {
                window.sessionStorage.setItem(key, val);
              }
            }
          } catch (e) {}
        });
      }, state.sessionStorage);
    }
  }

  // Hide automation signatures (webdriver override)
  await activeContext.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined
    });
  });

  activePage = await activeContext.newPage();
  return activePage;
}

/**
 * Closes the active browser if open.
 */
export async function closeActiveBrowser() {
  if (activeBrowser) {
    try {
      await activeBrowser.close();
    } catch {}
    activeBrowser = null;
    activeContext = null;
    activePage = null;
  }
}

/**
 * Helper to check if session exists.
 */
async function hasSession() {
  try {
    const state = await loadSession();
    return !!state;
  } catch {
    return false;
  }
}

/**
 * Opens browser for the user to manually log in.
 * Keeps the browser open after successful login!
 */
export async function runManualLogin() {
  console.log('\n==================================================================');
  console.log('[ACTION REQUIRED] Apertura del browser per il login manuale FSE.');
  console.log('1. Esegui il login tramite CIE/SPID sul portale di Regione Lombardia.');
  console.log('2. Naviga fino alla pagina di "Scelta e Revoca del Medico".');
  console.log('3. Una volta che sei sulla pagina di ricerca dei medici, lo script');
  console.log('   rileverà la sessione oppure premi INVIO nel terminale per confermare.');
  console.log('==================================================================\n');

  // Close any existing browser window first to avoid duplicate screens
  await closeActiveBrowser();

  const page = await getActivePage();

  // Navigate to the FSE homepage
  await page.goto('https://www.fascicolosanitario.regione.lombardia.it/web/fserl-pubblica/', {
    waitUntil: 'domcontentloaded'
  });

  let sessionSaved = false;

  // Auto-detection loop
  const detectionPromise = new Promise(async (resolve) => {
    for (let i = 0; i < 300; i++) {
      if (!activeBrowser || !activeBrowser.isConnected()) break;

      try {
        const url = page.url();
        const content = await page.content();
        
        const isGPPage = url.includes('scelta-revoca') || 
                          url.includes('sceltarevoca') || 
                          content.includes('Cerca Medico') || 
                          content.includes('Scelta del medico') ||
                          content.includes('scelta/cambio');

        if (isGPPage) {
          console.log('[INFO] Rilevata pagina di Scelta/Cambio Medico! Salvataggio sessione...');
          const state = await activeContext.storageState();
          
          // Extract sessionStorage from all frames
          const sessionStorages = [];
          for (const frame of page.frames()) {
            try {
              const storage = await frame.evaluate(() => {
                const data = {};
                for (let i = 0; i < sessionStorage.length; i++) {
                  const key = sessionStorage.key(i);
                  data[key] = sessionStorage.getItem(key);
                }
                return data;
              });
              sessionStorages.push({ url: frame.url(), storage });
            } catch {}
          }
          
          const combinedState = { ...state, sessionStorage: sessionStorages };
          await saveSession(combinedState);
          sessionSaved = true;
          resolve();
          break;
        }
      } catch (e) {}
      await new Promise(r => setTimeout(r, 1000));
    }
  });

  // Terminal Enter fallback
  const terminalPromise = new Promise((resolve) => {
    process.stdin.once('data', async () => {
      if (!sessionSaved && activeBrowser && activeBrowser.isConnected()) {
        console.log('[INFO] Salvataggio sessione forzato dall\'utente...');
        try {
          const state = await activeContext.storageState();
          
          const sessionStorages = [];
          for (const frame of page.frames()) {
            try {
              const storage = await frame.evaluate(() => {
                const data = {};
                for (let i = 0; i < sessionStorage.length; i++) {
                  const key = sessionStorage.key(i);
                  data[key] = sessionStorage.getItem(key);
                }
                return data;
              });
              sessionStorages.push({ url: frame.url(), storage });
            } catch {}
          }
          
          const combinedState = { ...state, sessionStorage: sessionStorages };
          await saveSession(combinedState);
          sessionSaved = true;
        } catch (err) {
          console.error('[ERROR] Impossibile salvare lo stato del browser:', err);
        }
      }
      resolve();
    });
  });

  await Promise.any([detectionPromise, terminalPromise]);

  if (sessionSaved) {
    console.log('[SUCCESS] Sessione salvata con successo in auth_state.json.');
    console.log('[INFO] La finestra rimarrà APERTA in background per eseguire la scansione.');
    return true;
  } else {
    console.log('[WARNING] Impossibile salvare la sessione. Timeout o browser chiuso.');
    await closeActiveBrowser();
    return false;
  }
}

/**
 * Navigates to the FSE choice page, inputs the municipalities, and extracts GP availability.
 */
export async function scrapeGPAvailability() {
  const page = await getActivePage();

  try {
    console.log('[INFO] Caricamento della homepage FSE...');
    await page.goto('https://www.fascicolosanitario.regione.lombardia.it/web/fserl-pubblica/', {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    await delay(4000);

    console.log('[INFO] Navigazione alla pagina di Scelta e Revoca...');
    await page.goto('https://www.fascicolosanitario.regione.lombardia.it/web/fserl-pubblica/servizi/scelta-e-revoca-del-medico', {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    // Wait for client-side JavaScript to render the form
    await delay(6000);

    // Check if we got redirected to the login/public page
    const currentUrl = page.url();
    if (currentUrl.includes('login') || currentUrl.includes('fserl-pubblica/') && !currentUrl.includes('scelta-e-revoca-del-medico')) {
      console.log('[WARNING] Reindirizzamento rilevato. La sessione è scaduta.');
      throw new Error('session_expired');
    }

    const extractedDoctors = [];
    const municipalities = ['Melegnano', 'Cerro al Lambro'];

    for (const city of municipalities) {
      console.log(`[INFO] Avvio ricerca per il comune di: ${city}`);
      
      let cityInput = null;
      const inputSelectors = [
        'input[placeholder*="comune"i]',
        'input[placeholder*="Comune"i]',
        'input[aria-label*="comune"i]',
        'input[id*="comune"i]',
        'input[name*="comune"i]',
        'label:has-text("Comune") + input',
        'input[type="text"]'
      ];

      for (const sel of inputSelectors) {
        try {
          const loc = page.locator(sel).first();
          if (await loc.isVisible()) {
            cityInput = loc;
            break;
          }
        } catch {}
      }

      if (!cityInput) {
        console.warn(`[WARNING] Impossibile trovare il campo input per il comune. Uso fallback generico.`);
        cityInput = page.locator('input').first();
      }

      await cityInput.click();
      await page.keyboard.press('Control+A');
      await page.keyboard.press('Backspace');
      await delay(1000);
      await cityInput.pressSequentially(city, { delay: 100 + Math.random() * 50 });
      await delay(2500);

      try {
        const dropdownItem = page.locator(`li:has-text("${city}"), div[role="option"]:has-text("${city}")`).first();
        if (await dropdownItem.isVisible()) {
          await dropdownItem.click();
        } else {
          await page.keyboard.press('ArrowDown');
          await delay(500);
          await page.keyboard.press('Enter');
        }
      } catch (err) {
        await page.keyboard.press('Enter');
      }

      await delay(2000);

      let searchBtn = null;
      const btnSelectors = [
        'button:has-text("Cerca")',
        'button:has-text("Filtra")',
        'button:has-text("Ricerca")',
        'input[type="submit"]',
        'button[type="submit"]',
        '.btn-primary',
        'role=button[name=/cerca/i]'
      ];

      for (const sel of btnSelectors) {
        try {
          const loc = page.locator(sel).first();
          if (await loc.isVisible()) {
            searchBtn = loc;
            break;
          }
        } catch {}
      }

      if (searchBtn) {
        await searchBtn.click();
      } else {
        await page.keyboard.press('Enter');
      }

      console.log('[INFO] Attesa caricamento risultati...');
      await delay(5000);

      const doctorsInCity = await page.evaluate((currentCity) => {
        const list = [];
        
        const rows = document.querySelectorAll('table tr, tbody tr');
        if (rows.length > 1) {
          rows.forEach((row, idx) => {
            if (idx === 0) return;
            const text = row.innerText || '';
            if (text.trim() === '') return;

            const cols = row.querySelectorAll('td');
            if (cols.length >= 3) {
              const fullName = cols[0].innerText.trim();
              const address = cols[1].innerText.trim();
              const spotsText = cols[2].innerText.trim();
              
              const spotsMatch = spotsText.match(/\d+/);
              const spots = spotsMatch ? parseInt(spotsMatch[0], 10) : 0;

              const nameParts = fullName.split(' ');
              const lastName = nameParts[0] || 'Medico';
              const firstName = nameParts.slice(1).join(' ') || '';

              list.push({
                firstName,
                lastName,
                scope: currentCity,
                address: address || 'Indirizzo non specificato',
                spots
              });
            }
          });
        }

        if (list.length === 0) {
          const cards = document.querySelectorAll('.card, .medico-card, .doctor-item, .list-item');
          cards.forEach((card) => {
            const text = card.innerText || '';
            const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
            if (lines.length >= 2) {
              const fullName = lines[0];
              const nameParts = fullName.replace(/dott\.\s*/i, '').split(' ');
              const lastName = nameParts[0] || 'Medico';
              const firstName = nameParts.slice(1).join(' ') || '';

              const addressLine = lines.find(l => l.toLowerCase().includes('via') || l.toLowerCase().includes('piazza')) || 'Indirizzo non specificato';
              
              const spotsLine = lines.find(l => l.toLowerCase().includes('posti') || l.toLowerCase().includes('disponib')) || '0';
              const spotsMatch = spotsLine.match(/\d+/);
              const spots = spotsMatch ? parseInt(spotsMatch[0], 10) : 0;

              list.push({
                firstName,
                lastName,
                scope: currentCity,
                address: addressLine,
                spots
              });
            }
          });
        }

        if (list.length === 0 && document.body.innerText.includes('Nessun medico trovato') === false) {
          if (window.location.hostname === 'localhost' || window.location.pathname.includes('blank')) {
            list.push({
              firstName: 'Test',
              lastName: `Medico-${currentCity.replace(/\s+/g, '')}`,
              scope: currentCity,
              address: 'Piazza della Repubblica 1',
              spots: Math.random() > 0.5 ? 3 : 0
            });
          }
        }

        return list;
      }, city);

      console.log(`[SUCCESS] Estratti ${doctorsInCity.length} medici per ${city}.`);
      extractedDoctors.push(...doctorsInCity);
      await delay(2000);
    }

    return extractedDoctors;
  } catch (err) {
    console.error('[ERROR] Errore durante il monitoraggio dei medici:', err.message);
    throw err;
  }
}
