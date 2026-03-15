const STORAGE_KEY = 'nerdy_client_id';

function generateId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 10);
  return `cli_${ts}_${rand}`;
}

let cached: string | null = null;

export function getClientId(): string {
  if (cached) return cached;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      cached = stored;
      return stored;
    }
  } catch {
    // localStorage unavailable (SSR, incognito restrictions, etc.)
  }

  const id = generateId();
  cached = id;

  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // persist failure is non-fatal
  }

  return id;
}
