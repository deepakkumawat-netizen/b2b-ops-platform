import type { CookieOptions, Request, Response } from 'express';

// The staff JWT lives in an httpOnly cookie rather than localStorage, so an
// XSS bug can't read and exfiltrate it. SameSite=Strict is the CSRF defence:
// the browser never attaches it to a request started from another site. The
// frontend is served from this same origin (and proxied in dev), so Strict
// costs nothing.
export const SESSION_COOKIE = 'b2bops_session';

function baseOptions(req: Request): CookieOptions {
  // req.secure honours X-Forwarded-Proto because main.ts sets trust proxy —
  // true on Render (https), false on http://localhost in dev.
  return { httpOnly: true, sameSite: 'strict', secure: req.secure, path: '/api' };
}

export function setSessionCookie(req: Request, res: Response, token: string, expiresAtSeconds?: number): void {
  const maxAge = expiresAtSeconds ? Math.max(0, expiresAtSeconds * 1000 - Date.now()) : undefined;
  res.cookie(SESSION_COOKIE, token, { ...baseOptions(req), maxAge });
}

export function clearSessionCookie(req: Request, res: Response): void {
  res.clearCookie(SESSION_COOKIE, baseOptions(req));
}

/** Minimal Cookie-header parser — avoids pulling in cookie-parser for one cookie. */
export function readSessionCookie(req: Request): string | null {
  const header = req.headers?.cookie;
  if (!header) return null;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === SESSION_COOKIE) {
      return decodeURIComponent(part.slice(eq + 1).trim());
    }
  }
  return null;
}
