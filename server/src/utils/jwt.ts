/**
 * JWT authentication utilities for token creation and verification.
 */

import crypto from "node:crypto";
import jwt from "jsonwebtoken";

export interface TokenPayload {
  userId: string;
  email: string;
  role: string;
  jti?: string;
  [key: string]: unknown;
}

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? "default-access-secret";
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? "default-refresh-secret";
const ACCESS_EXPIRES = process.env.JWT_ACCESS_EXPIRES_IN ?? "15m";
const REFRESH_EXPIRES = process.env.JWT_REFRESH_EXPIRES_IN ?? "7d";

/**
 * Generates a short-lived access token (default 15 menit).
 */
export function generateAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, ACCESS_SECRET, { expiresIn: ACCESS_EXPIRES } as jwt.SignOptions);
}

/**
 * Generates a long-lived refresh token (default 7 hari) with unique jti (nonce).
 */
export function generateRefreshToken(payload: TokenPayload): string {
  const jti = crypto.randomUUID();
  return jwt.sign({ ...payload, jti }, REFRESH_SECRET, { expiresIn: REFRESH_EXPIRES } as jwt.SignOptions);
}

/**
 * Verifies dan decode access token. Throws jika token invalid/expired.
 */
export function verifyAccessToken<T = TokenPayload>(token: string): T {
  return jwt.verify(token, ACCESS_SECRET) as T;
}

/**
 * Verifies dan decode refresh token. Throws jika token invalid/expired.
 */
export function verifyRefreshToken<T = TokenPayload>(token: string): T {
  return jwt.verify(token, REFRESH_SECRET) as T;
}
