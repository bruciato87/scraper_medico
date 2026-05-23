import { test } from 'node:test';
import assert from 'node:assert';

test('Configuration validation and loading', async (t) => {
  await t.test('should load environment variables correctly', async () => {
    // Set mock env variables
    process.env.EMAIL_HOST = 'smtp.test.com';
    process.env.EMAIL_PORT = '465';
    process.env.EMAIL_USER = 'user@test.com';
    process.env.EMAIL_PASS = 'pass123';
    process.env.EMAIL_TO = 'to@test.com';
    process.env.CHECK_INTERVAL_MINUTES = '20';

    // Import the config module dynamically so process.env changes take effect
    const { config } = await import('../lib/config.js');

    assert.strictEqual(config.EMAIL_HOST, 'smtp.test.com');
    assert.strictEqual(config.EMAIL_PORT, 465);
    assert.strictEqual(config.EMAIL_USER, 'user@test.com');
    assert.strictEqual(config.EMAIL_PASS, 'pass123');
    assert.strictEqual(config.EMAIL_TO, 'to@test.com');
    assert.strictEqual(config.CHECK_INTERVAL_MINUTES, 20);
  });
});
