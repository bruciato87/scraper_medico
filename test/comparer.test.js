import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'fs/promises';
import path from 'path';

const snapshotPath = path.resolve('medici_snapshot.json');

test('Comparison and snapshot baseline logic', async (t) => {
  // Clean up
  try {
    await fs.unlink(snapshotPath);
  } catch {}

  const currentGPs = [
    { firstName: 'Mario', lastName: 'Rossi', scope: 'Melegnano', address: 'Via Roma 1', spots: 0 },
    { firstName: 'Luigi', lastName: 'Bianchi', scope: 'Cerro al Lambro', address: 'Via Verdi 2', spots: 5 }
  ];

  await t.test('should baseline silently on first run (no historical snapshot)', async () => {
    const { getChangesAndUpdateSnapshot } = await import('../lib/comparer.js');

    const changes = await getChangesAndUpdateSnapshot(currentGPs);
    assert.deepStrictEqual(changes, []); // Silent baseline on first run

    // Verify snapshot file exists
    const exists = await fs.access(snapshotPath).then(() => true).catch(() => false);
    assert.ok(exists);

    // Clean up
    await fs.unlink(snapshotPath);
  });

  await t.test('should detect new GPs or opened spots in subsequent runs', async () => {
    const { getChangesAndUpdateSnapshot } = await import('../lib/comparer.js');

    // Create baseline snapshot
    await fs.writeFile(snapshotPath, JSON.stringify(currentGPs, null, 2));

    const updatedGPs = [
      // 1. Mario Rossi goes from 0 to 2 spots (Opened spots!)
      { firstName: 'Mario', lastName: 'Rossi', scope: 'Melegnano', address: 'Via Roma 1', spots: 2 },
      // 2. Luigi Bianchi remains unchanged
      { firstName: 'Luigi', lastName: 'Bianchi', scope: 'Cerro al Lambro', address: 'Via Verdi 2', spots: 5 },
      // 3. Giuseppe Verdi is a completely new doctor with spots (New GP!)
      { firstName: 'Giuseppe', lastName: 'Verdi', scope: 'Melegnano', address: 'Via Dante 3', spots: 10 }
    ];

    const changes = await getChangesAndUpdateSnapshot(updatedGPs);

    assert.strictEqual(changes.length, 2);
    
    const rossiChange = changes.find(c => c.lastName === 'Rossi');
    assert.ok(rossiChange);
    assert.strictEqual(rossiChange.spots, 2);
    assert.strictEqual(rossiChange.isNew, false); // Just opened spots

    const verdiChange = changes.find(c => c.lastName === 'Verdi');
    assert.ok(verdiChange);
    assert.strictEqual(verdiChange.spots, 10);
    assert.strictEqual(verdiChange.isNew, true); // Totally new GP

    // Clean up
    await fs.unlink(snapshotPath);
  });
});
