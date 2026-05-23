import fs from 'fs/promises';
import path from 'path';

const snapshotPath = path.resolve('medici_snapshot.json');

async function hasSnapshot() {
  try {
    await fs.access(snapshotPath);
    return true;
  } catch {
    return false;
  }
}

async function loadSnapshot() {
  const data = await fs.readFile(snapshotPath, 'utf-8');
  return JSON.parse(data);
}

async function saveSnapshot(data) {
  await fs.writeFile(snapshotPath, JSON.stringify(data, null, 2), 'utf-8');
}

export async function getChangesAndUpdateSnapshot(currentGPs) {
  if (!(await hasSnapshot())) {
    // First run: save baseline silently
    await saveSnapshot(currentGPs);
    return [];
  }

  const historicalGPs = await loadSnapshot();
  const changes = [];

  for (const current of currentGPs) {
    // Unique key to identify a GP: combination of first name, last name, and scope
    const match = historicalGPs.find(
      (h) =>
        h.firstName.toLowerCase() === current.firstName.toLowerCase() &&
        h.lastName.toLowerCase() === current.lastName.toLowerCase() &&
        h.scope.toLowerCase() === current.scope.toLowerCase()
    );

    if (!match) {
      // 1. Completely new GP found!
      if (current.spots > 0) {
        changes.push({ ...current, isNew: true });
      }
    } else {
      // 2. Existing GP found: check if spots became available
      const historicalSpots = match.spots || 0;
      const currentSpots = current.spots || 0;

      if (historicalSpots === 0 && currentSpots > 0) {
        changes.push({ ...current, isNew: false });
      }
    }
  }

  // Update snapshot with the current state
  await saveSnapshot(currentGPs);

  return changes;
}
