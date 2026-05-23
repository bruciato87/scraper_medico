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
  // Check expiration ONLY for critical session cookies (like PA_SESSION, JSESSIONID)
  // Ensure we only mark positive timestamps (> 0) as expired (session cookies have expires: -1)
  const criticalCookies = ['PA_SESSION', 'PHPSESSID', 'JSESSIONID'];
  const hasExpiredCriticalCookie = state.cookies.some(
    (c) => criticalCookies.includes(c.name) && c.expires && c.expires > 0 && c.expires < now
  );

  if (hasExpiredCriticalCookie) {
    return false;
  }

  return true;
}
