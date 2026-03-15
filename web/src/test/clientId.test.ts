import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('getClientId', () => {
  beforeEach(() => {
    vi.resetModules();
    const store: Record<string, string> = {};
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => { store[key] = value; },
      removeItem: (key: string) => { delete store[key]; },
      clear: () => { for (const k of Object.keys(store)) delete store[k]; },
    });
  });

  it('returns a string starting with "cli_"', async () => {
    const { getClientId } = await import('../api/clientId.ts');
    expect(getClientId()).toMatch(/^cli_/);
  });

  it('persists to localStorage', async () => {
    const { getClientId } = await import('../api/clientId.ts');
    const id = getClientId();
    expect(localStorage.getItem('nerdy_client_id')).toBe(id);
  });

  it('returns consistent value within same module load', async () => {
    const { getClientId } = await import('../api/clientId.ts');
    const a = getClientId();
    const b = getClientId();
    expect(a).toBe(b);
  });
});
