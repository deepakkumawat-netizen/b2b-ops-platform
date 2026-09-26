import type { Request } from 'express';
import { readSessionCookie, SESSION_COOKIE } from './session-cookie';

const req = (cookie?: string) => ({ headers: { cookie } }) as unknown as Request;

describe('readSessionCookie', () => {
  it('finds the session cookie among others', () => {
    expect(readSessionCookie(req(`theme=dark; ${SESSION_COOKIE}=abc.def.ghi; other=1`))).toBe('abc.def.ghi');
  });

  it('returns null when absent', () => {
    expect(readSessionCookie(req('theme=dark'))).toBeNull();
    expect(readSessionCookie(req(undefined))).toBeNull();
  });
});
