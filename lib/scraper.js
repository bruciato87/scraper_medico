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
/**
 * Dumps the controls and content of all frames on the page for debugging purposes.
 */
export async function dumpFrameControls(page) {
  console.log(`\n--- [DEBUG] DUMP DI TUTTI I FRAME E DEI CONTROLLI ---`);
  console.log(`[DEBUG] Numero di frame totali rilevati: ${page.frames().length}`);
  
  for (const [index, frame] of page.frames().entries()) {
    console.log(`\nFrame ${index}: URL="${frame.url()}" Name="${frame.name()}"`);
    try {
      const info = await frame.evaluate(() => {
        const controls = Array.from(document.querySelectorAll('input, select, button, textarea, a')).map(el => {
          return {
            tag: el.tagName,
            type: el.type || '',
            id: el.id || '',
            name: el.name || '',
            placeholder: el.placeholder || '',
            text: (el.innerText || el.textContent || '').trim().substring(0, 50),
            aria: el.getAttribute('aria-label') || '',
            class: el.className || ''
          };
        });
        return {
          title: document.title,
          bodyLength: document.body.innerText.length,
          snippet: document.body.innerText.substring(0, 300),
          controls: controls
        };
      });

      console.log(`  Titolo: "${info.title}"`);
      console.log(`  Lunghezza testo body: ${info.bodyLength}`);
      console.log(`  Snippet testo: "${info.snippet.replace(/\s+/g, ' ')}"`);
      console.log(`  Controlli trovati (${info.controls.length}):`);
      if (info.controls.length > 0) {
        info.controls.forEach((c) => {
          console.log(`    - <${c.tag}> [id="${c.id}" name="${c.name}" placeholder="${c.placeholder}" text="${c.text}" aria="${c.aria}" type="${c.type}" class="${c.class}"]`);
        });
      }
    } catch (e) {
      console.log(`  [ERRORE] Impossibile valutare il frame: ${e.message}`);
    }
  }
  console.log(`--- [DEBUG] FINE DUMP FRAME ---\n`);
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
          
          // Dump controls for debug
          await dumpFrameControls(page);

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

          // Dump controls for debug
          await dumpFrameControls(page);

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
    const inputSelectors = [
      'select#comune',
      '#nomeMedico',
      '#cognomeMedico',
      'input[placeholder*="comune"i]',
      'input[placeholder*="Comune"i]',
      'input[aria-label*="comune"i]',
      'input[id*="comune"i]'
    ];

    // Find the active frame containing the Comune input
    let targetFrame = null;
    
    // 1. Try to find it on the current page immediately (e.g. if we are already on the GP page)
    for (const sel of inputSelectors) {
      try {
        if (await page.locator(sel).first().isVisible()) {
          targetFrame = page;
          break;
        }
      } catch {}
    }

    if (!targetFrame) {
      for (const frame of page.frames()) {
        for (const sel of inputSelectors) {
          try {
            if (await frame.locator(sel).first().isVisible()) {
              targetFrame = frame;
              console.log(`[INFO] Rilevato form all'interno dell'iframe: ${frame.url()}`);
              break;
            }
          } catch {}
        }
        if (targetFrame) break;
      }
    }

    const alreadyOnGPPage = !!targetFrame;

    if (alreadyOnGPPage) {
      console.log('[INFO] Il browser è già sulla pagina di Cambio Medico. Salto la navigazione iniziale.');
    } else {
      console.log('[INFO] Caricamento della pagina Cambio Medico...');
      await page.goto('https://www.fascicolosanitario.regione.lombardia.it/web/areaprivata/cambio-medico', {
        waitUntil: 'domcontentloaded',
        timeout: 60000
      });

      // Wait up to 20 seconds for the form to render (either in main page or in an iframe)
      console.log('[INFO] Attesa rendering del form di Cambio Medico (main page o iframe)...');
      let found = false;
      for (let i = 0; i < 20; i++) {
        // Check main frame
        for (const sel of inputSelectors) {
          try {
            if (await page.locator(sel).first().isVisible()) {
              targetFrame = page;
              found = true;
              break;
            }
          } catch {}
        }
        if (found) break;

        // Check subframes
        for (const frame of page.frames()) {
          for (const sel of inputSelectors) {
            try {
              if (await frame.locator(sel).first().isVisible()) {
                targetFrame = frame;
                console.log(`[INFO] Form rilevato nell'iframe: ${frame.url()}`);
                found = true;
                break;
              }
            } catch {}
          }
          if (found) break;
        }

        if (found) break;
        await delay(1000);
      }

      if (!targetFrame) {
        // Check if we got redirected to the login/public page
        const currentUrl = page.url();
        if (currentUrl.includes('login') || currentUrl.includes('fserl-pubblica/')) {
          console.log('[WARNING] Reindirizzamento rilevato. La sessione è scaduta.');
          throw new Error('session_expired');
        } else {
          console.log('[WARNING] Form di ricerca non trovato.');
          throw new Error('session_expired');
        }
      }
    }

    const extractedDoctors = [];
    const municipalities = ['Melegnano', 'Cerro al Lambro'];

    for (let idx = 0; idx < municipalities.length; idx++) {
      const city = municipalities[idx];
      console.log(`[INFO] Avvio ricerca per il comune di: ${city}`);
      
      // For subsequent cities, reload the Cambio Medico page to reset the form clean!
      if (idx > 0) {
        console.log('[INFO] Ricaricamento della form di ricerca per il prossimo comune...');
        await page.goto('https://www.fascicolosanitario.regione.lombardia.it/web/areaprivata/cambio-medico', {
          waitUntil: 'domcontentloaded',
          timeout: 60000
        });
        
        // Relocate the targetFrame after navigation
        targetFrame = null;
        for (const sel of inputSelectors) {
          try {
            if (await page.locator(sel).first().isVisible()) {
              targetFrame = page;
              break;
            }
          } catch {}
        }
        if (!targetFrame) {
          for (const frame of page.frames()) {
            for (const sel of inputSelectors) {
              try {
                if (await frame.locator(sel).first().isVisible()) {
                  targetFrame = frame;
                  break;
                }
              } catch {}
            }
            if (targetFrame) break;
          }
        }
        
        if (!targetFrame) {
          throw new Error('session_expired');
        }
      }

      const selectElement = targetFrame.locator('select#comune').first();
      if (!(await selectElement.isVisible())) {
        console.warn('[WARNING] Dropdown comune non visibile, provo ad attendere...');
        await delay(3000);
      }

      // Read dropdown options to perform safe case-insensitive match
      const options = await selectElement.evaluate((el) => {
        return Array.from(el.options).map(opt => ({
          value: opt.value,
          text: opt.text.trim()
        }));
      });

      const matchedOpt = options.find(
        (o) => o.text.toUpperCase() === city.toUpperCase() || o.text.toUpperCase().includes(city.toUpperCase())
      );

      if (matchedOpt) {
        console.log(`[INFO] Seleziono l'opzione "${matchedOpt.text}" per il comune di ${city}`);
        await selectElement.selectOption(matchedOpt.value);
      } else {
        console.warn(`[WARNING] Opzione non trovata nel dropdown per ${city}. Provo valore diretto.`);
        await selectElement.selectOption({ label: city.toUpperCase() });
      }

      await delay(1500);

      // Click the Avanti button
      const searchBtn = targetFrame.locator('#buttonFormRicercaComune, button:has-text("Avanti")').first();
      await searchBtn.click();

      console.log('[INFO] Attesa caricamento risultati...');
      await delay(5000);

      const doctorsInCity = await targetFrame.evaluate((currentCity) => {
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

    // Go back to the form page at the end of the scrape so the browser window remains on the form for the next interval
    try {
      console.log('[INFO] Ripristino pagina Cambio Medico per il prossimo intervallo...');
      await page.goto('https://www.fascicolosanitario.regione.lombardia.it/web/areaprivata/cambio-medico', {
        waitUntil: 'domcontentloaded',
        timeout: 60000
      });
    } catch {}

    return extractedDoctors;
  } catch (err) {
    console.error('[ERROR] Errore durante il monitoraggio dei medici:', err.message);
    throw err;
  }
}
