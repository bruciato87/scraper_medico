import nodemailer from 'nodemailer';
import { config } from './config.js';

export function getSubject(type) {
  if (type === 'new_gp') {
    return '[FSE] Nuovo Medico Disponibile!';
  } else if (type === 'session_expired') {
    return '[FSE] Sessione Scaduta - Richiesto Login Manuale';
  }
  return '[FSE] Aggiornamento Disponibilità Medici';
}

export function generateHtmlTable(medici) {
  const rows = medici
    .map((m) => {
      const statusBadge = m.isNew
        ? '<span style="background-color: #2ec4b6; color: white; padding: 4px 8px; border-radius: 4px; font-weight: bold; font-size: 11px;">NUOVO</span>'
        : m.spots > 0
        ? '<span style="background-color: #e76f51; color: white; padding: 4px 8px; border-radius: 4px; font-weight: bold; font-size: 11px;">POSTI LIBERATI</span>'
        : '<span style="background-color: #e0e0e0; color: #666; padding: 4px 8px; border-radius: 4px; font-size: 11px;">COMPLETO</span>';

      const spotsStyle = m.spots > 0 ? 'color: #e76f51; font-weight: bold;' : 'color: #666;';

      return `
        <tr style="border-bottom: 1px solid #eee;">
          <td style="padding: 12px; font-weight: 600; color: #1d3557;">${m.firstName} ${m.lastName}</td>
          <td style="padding: 12px; color: #457b9d;">${m.scope}</td>
          <td style="padding: 12px; color: #666; font-size: 13px;">${m.address}</td>
          <td style="padding: 12px; ${spotsStyle}">Posti disponibili: ${m.spots}</td>
          <td style="padding: 12px; text-align: center;">${statusBadge}</td>
        </tr>
      `;
    })
    .join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Aggiornamento Medici</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f6f9; margin: 0; padding: 20px; -webkit-font-smoothing: antialiased;">
      <div style="max-width: 800px; margin: 0 auto; background: #ffffff; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); overflow: hidden; border: 1px solid #e1e8ed;">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #1d3557 0%, #457b9d 100%); padding: 30px; text-align: center; color: white;">
          <h1 style="margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">Fascicolo Sanitario Elettronico</h1>
          <p style="margin: 5px 0 0 0; font-size: 15px; color: #a8dadc;">Nuovi Medici di Medicina Generale Disponibili</p>
        </div>
        
        <!-- Content -->
        <div style="padding: 30px;">
          <p style="font-size: 16px; color: #2b2d42; line-height: 1.6; margin-top: 0;">
            Salve,<br>
            Il sistema di monitoraggio automatico ha rilevato nuovi medici disponibili o posti liberi nei comuni di <strong>Melegnano</strong> e <strong>Cerro al Lambro</strong>.
          </p>
          
          <table style="width: 100%; border-collapse: collapse; margin-top: 20px; border: 1px solid #eef2f3; text-align: left;">
            <thead>
              <tr style="background-color: #f8f9fa; border-bottom: 2px solid #eef2f3;">
                <th style="padding: 12px; font-weight: 700; color: #1d3557;">Medico</th>
                <th style="padding: 12px; font-weight: 700; color: #1d3557;">Comune / Ambito</th>
                <th style="padding: 12px; font-weight: 700; color: #1d3557;">Indirizzo</th>
                <th style="padding: 12px; font-weight: 700; color: #1d3557;">Posti</th>
                <th style="padding: 12px; font-weight: 700; color: #1d3557; text-align: center;">Stato</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
          
          <div style="margin-top: 30px; padding: 20px; background-color: #f1faee; border-radius: 8px; border-left: 4px solid #457b9d;">
            <p style="margin: 0; font-size: 14px; color: #1d3557; font-weight: bold;">Cosa fare adesso?</p>
            <p style="margin: 5px 0 0 0; font-size: 14px; color: #457b9d; line-height: 1.5;">
              Accedi immediatamente al portale <a href="https://www.fascicolosanitario.regione.lombardia.it/" target="_blank" style="color: #e63946; font-weight: bold; text-decoration: underline;">FSE Lombardia</a> per effettuare il cambio del medico prima che i posti si esauriscano nuovamente!
            </p>
          </div>
        </div>
        
        <!-- Footer -->
        <div style="background-color: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #eef2f3;">
          <p style="margin: 0; font-size: 12px; color: #8d99ae;">Questa è una notifica automatica locale inviata dallo Scraper Medico.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

export async function sendEmail(type, data = null) {
  if (!config.EMAIL_USER || !config.EMAIL_PASS) {
    console.log(`[INFO] SMTP credentials not set. Skipping email send for type: ${type}`);
    return false;
  }

  const transporter = nodemailer.createTransport({
    host: config.EMAIL_HOST,
    port: config.EMAIL_PORT,
    secure: config.EMAIL_PORT === 465, // True for 465, false for other ports
    auth: {
      user: config.EMAIL_USER,
      pass: config.EMAIL_PASS
    }
  });

  const subject = getSubject(type);
  let html = '';
  let text = '';

  if (type === 'new_gp' && Array.isArray(data)) {
    html = generateHtmlTable(data);
    text = `Nuovi Medici Disponibili:\n\n` + data.map(m => `- ${m.firstName} ${m.lastName} (${m.scope}) - Posti: ${m.spots} - ${m.address}`).join('\n');
  } else if (type === 'session_expired') {
    text = `La sessione dello Scraper Medico è scaduta ed è richiesto il login manuale tramite CIE/SPID al terminale.\n\nCollegati al terminale per rigenerare il file auth_state.json.`;
    html = `
      <div style="font-family: sans-serif; padding: 20px; max-width: 600px; margin: 0 auto; border: 1px solid #e63946; border-radius: 8px; background-color: #fff1f2;">
        <h2 style="color: #e63946; margin-top: 0;">[FSE] Sessione Scaduta - Richiesto Login Manuale</h2>
        <p style="color: #333; line-height: 1.6;">
          Il monitoraggio automatico dei medici è stato <strong>sospeso</strong> perché la sessione del browser è scaduta o non è più valida.
        </p>
        <p style="color: #333; line-height: 1.6;">
          È necessario ricollegarsi al terminale di controllo e completare nuovamente l'autenticazione manuale per rigenerare il file <code>auth_state.json</code>.
        </p>
        <div style="margin-top: 20px; padding: 15px; background-color: #ffe4e6; border-radius: 6px; font-weight: bold; color: #be123c;">
          Azione richiesta: Esegui di nuovo lo script in modalità headed per effettuare l'accesso manuale.
        </div>
      </div>
    `;
  } else {
    text = 'Aggiornamento dal sistema di monitoraggio.';
    html = `<p>${text}</p>`;
  }

  try {
    const info = await transporter.sendMail({
      from: `"FSE Scraper" <${config.EMAIL_USER}>`,
      to: config.EMAIL_TO,
      subject: subject,
      text: text,
      html: html
    });
    console.log(`[SUCCESS] Email inviata con successo: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error(`[ERROR] Invio email fallito:`, error);
    return false;
  }
}
