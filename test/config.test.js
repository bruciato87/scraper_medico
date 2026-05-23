import { test } from 'node:test';
import assert from 'node:assert';

test('Configuration validation and loading', async (t) => {
  await t.test('should load environment variables correctly', async () => {
    // Set mock env variables
    process.env.RESEND_API_KEY = 're_123456';
    process.env.EMAIL_TO = 'to@test.com';
    process.env.CHECK_INTERVAL_MINUTES = '20';

    // Import the config module dynamically so process.env changes take effect
    const { config } = await import('../lib/config.js');

    assert.strictEqual(config.RESEND_API_KEY, 're_123456');
    assert.strictEqual(config.EMAIL_TO, 'to@test.com');
    assert.strictEqual(config.CHECK_INTERVAL_MINUTES, 20);
  });
});
