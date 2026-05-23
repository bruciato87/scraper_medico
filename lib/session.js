import fs from 'fs/promises';
import path from 'path';

const sessionPath = path.resolve('auth_state.json');

export async function hasSession() {
  try {
    await fs.access(sessionPath);
    return true;
  } catch {
    return false;
  }
}

export async function saveSession(state) {
  await fs.writeFile(sessionPath, JSON.stringify(state, null, 2), 'utf-8');
}

export async function loadSession() {
  const data = await fs.readFile(sessionPath, 'utf-8');
  return JSON.parse(data);
}

export function isSessionValid(state) {
  if (!state || !state.cookies || !Array.isArray(state.cookies) || state.cookies.length === 0) {
    return false;
  }

  const now = Date.now() / 1000;
  // If any cookie has expired, we consider the session invalid/expired
  const hasExpiredCookie = state.cookies.some((c) => c.expires && c.expires < now);
  if (hasExpiredCookie) {
    return false;
  }

  return true;
}
