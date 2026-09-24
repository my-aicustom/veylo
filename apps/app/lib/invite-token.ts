import { createHmac, timingSafeEqual } from 'node:crypto';

const DEFAULT_TTL_SECONDS = 8 * 60 * 60;

function secret() {
  return process.env.VEYLO_INVITE_SECRET?.trim() || '';
}

export function inviteProtectionEnabled() {
  return secret().length >= 32;
}

function signature(roomName: string, expiresAt: number) {
  return createHmac('sha256', secret())
    .update(`${roomName}.${expiresAt}`)
    .digest('base64url');
}

export function createInviteToken(roomName: string, ttlSeconds = DEFAULT_TTL_SECONDS) {
  if (!inviteProtectionEnabled()) return null;
  const expiresAt = Math.floor(Date.now() / 1000) + Math.max(60, Math.min(ttlSeconds, 24 * 60 * 60));
  return {
    token: `${expiresAt}.${signature(roomName, expiresAt)}`,
    expiresAt,
  };
}

export function verifyInviteToken(roomName: string, token: unknown) {
  if (!inviteProtectionEnabled()) return { valid: true, reason: 'disabled' as const };
  if (typeof token !== 'string' || !token) return { valid: false, reason: 'missing' as const };

  const [expiresRaw, suppliedSignature, extra] = token.split('.');
  if (!expiresRaw || !suppliedSignature || extra) return { valid: false, reason: 'malformed' as const };

  const expiresAt = Number(expiresRaw);
  if (!Number.isInteger(expiresAt)) return { valid: false, reason: 'malformed' as const };
  if (expiresAt <= Math.floor(Date.now() / 1000)) return { valid: false, reason: 'expired' as const };

  const expected = signature(roomName, expiresAt);
  const supplied = Buffer.from(suppliedSignature);
  const expectedBuffer = Buffer.from(expected);
  if (supplied.length !== expectedBuffer.length) return { valid: false, reason: 'invalid' as const };

  return timingSafeEqual(supplied, expectedBuffer)
    ? { valid: true, reason: 'ok' as const }
    : { valid: false, reason: 'invalid' as const };
}
