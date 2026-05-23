import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'fs/promises';
import path from 'path';

const sessionPath = path.resolve('auth_state.json');

test('Session persistence and validation', async (t) => {
  // Clean up any test artifacts beforehand
  try {
    await fs.unlink(sessionPath);
  } catch {}

  await t.test('should save and load session state correctly', async () => {
    const { saveSession, loadSession, hasSession } = await import('../lib/session.js');

    assert.strictEqual(await hasSession(), false);

    const mockState = {
      cookies: [{ name: 'session_id', value: 'xyz123', domain: 'regione.lombardia.it', path: '/' }],
      origins: [{ origin: 'https://regione.lombardia.it', localStorage: [{ name: 'user_id', value: '456' }] }]
    };

    await saveSession(mockState);
    assert.strictEqual(await hasSession(), true);

    const loaded = await loadSession();
    assert.deepStrictEqual(loaded, mockState);

    // Clean up
    await fs.unlink(sessionPath);
  });

  await t.test('should check cookie validity correctly', async () => {
    const { isSessionValid } = await import('../lib/session.js');

    // Valid cookies list
    const validState = {
      cookies: [
        { name: 'PA_SESSION', value: 'active', expires: (Date.now() / 1000) + 3600 },
        { name: 'another_cookie', value: 'val' }
      ]
    };
    assert.ok(isSessionValid(validState));

    // Expired cookies list
    const expiredState = {
      cookies: [
        { name: 'PA_SESSION', value: 'active', expires: (Date.now() / 1000) - 3600 }
      ]
    };
    assert.strictEqual(isSessionValid(expiredState), false);
  });
});
