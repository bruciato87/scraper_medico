import { test } from 'node:test';
import assert from 'node:assert';

test('Notification and email formatting', async (t) => {
  await t.test('should generate a beautiful HTML table for GP availability', async () => {
    const { generateHtmlTable } = await import('../lib/notifier.js');

    const mockMedici = [
      { firstName: 'Mario', lastName: 'Rossi', scope: 'Melegnano', address: 'Via Roma 1', spots: 5, isNew: true },
      { firstName: 'Giuseppe', lastName: 'Verdi', scope: 'Cerro al Lambro', address: 'Via Milano 2', spots: 0, isNew: false }
    ];

    const html = generateHtmlTable(mockMedici);

    assert.ok(html.includes('Mario Rossi'));
    assert.ok(html.includes('Giuseppe Verdi'));
    assert.ok(html.includes('Via Roma 1'));
    assert.ok(html.includes('Posti disponibili: 5'));
    assert.ok(html.includes('NUOVO'));
  });

  await t.test('should generate standard subject lines', async () => {
    const { getSubject } = await import('../lib/notifier.js');

    const subjectNew = getSubject('new_gp');
    const subjectExpired = getSubject('session_expired');

    assert.strictEqual(subjectNew, '[FSE] Nuovo Medico Disponibile!');
    assert.strictEqual(subjectExpired, '[FSE] Sessione Scaduta - Richiesto Login Manuale');
  });
});
